<script lang="ts">
    import { onMount, tick } from "svelte";
    import { appState, dispatch } from "./appStateReducer";
    import { listState } from "./listStateReducer";
    import Bar from "./Bar.svelte";
    import Header from "./Header.svelte";
    import Left from "./Left.svelte";
    import Preference from "./Preference.svelte";

    import FileSvg from "../svg/FileSvg.svelte";
    import ImageSvg from "../svg/ImageSvg.svelte";
    import VideoSvg from "../svg/VideoSvg.svelte";
    import AudioSvg from "../svg/AudioSvg.svelte";
    import AppSvg from "../svg/AppSvg.svelte";
    import FolderSvg from "../svg/FolderSvg.svelte";
    import Zip from "../svg/Zip.svelte";
    import Symlink from "./Symlink.svelte";
    import DirDesktop from "../svg/DirDesktop.svelte";
    import DirDocuments from "../svg/DirDocuments.svelte";
    import DirDownloads from "../svg/DirDownloads.svelte";
    import DirMusic from "../svg/DirMusic.svelte";
    import DirImage from "../svg/DirImage.svelte";
    import DirVideo from "../svg/DirVideo.svelte";

    import VirtualList from "./VirtualList.svelte";
    import Home from "./Home.svelte";
    import Column from "./Column.svelte";
    import { BROWSER_SHORTCUT_KEYS, DEFAULT_SORT_TYPE, HOME, OS, RECYCLE_BIN, handleKeyEvent } from "../constants";
    import { IPC } from "../ipc";
    import main from "../main";
    import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
    import util from "../util";
    import { path } from "../path";
    import Deferred from "../deferred";

    let fileListContainer = $state<HTMLDivElement>();
    let clipRegion = $state<DOMRectReadOnly>();
    let virtualList = $state<VirtualList<Mp.MediaFile>>();
    let searchInterval = 0;
    let visibleStartIndex = $state(0);
    let visibleEndIndex = $state(0);

    let header: Header;
    let canvas: HTMLCanvasElement;
    let folderUpdatePromise: Deferred<number> | null;
    // Linux only
    let handleKeyUp = false;

    const ipc = new IPC("View");
    const HEADER_DIVIDER_WIDTh = 10;
    const GRID_ITEM_WIDTH = 110 + 10 + 10;
    const DATE_OPTION: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "numeric", second: "numeric" };
    const BACKWARD: Mp.NavigationHistory[] = [];
    const FORWARD: Mp.NavigationHistory[] = [];

    const showErrorMessage = async (message: string) => {
        await main.showErrorMessage(message);
    };

    const onListContextMenu = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if ($listState.rename.renaming) return;

        if ($listState.currentDir.fullPath != HOME) {
            onRowClick(e);
            const file = $listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
            let itemPath = "";
            if (file) {
                itemPath = file.linkPath ? file.linkPath : file.fullPath;
            }
            if (navigator.userAgent.includes(OS.windows)) {
                await main.openListContextMenu({ x: e.screenX, y: e.screenY }, itemPath, e.shiftKey, isRecycleBin());
            } else {
                await main.openListContextMenu({ x: e.clientX, y: e.clientY }, itemPath, e.shiftKey, isRecycleBin());
            }
        }
    };

    const onWindowSizeChanged = async () => {
        const isMaximized = await WebviewWindow.getCurrent().isMaximized();
        dispatch({ type: "isMaximized", value: isMaximized });
    };

    const safePromise = async () => {
        if (!folderUpdatePromise) return;
        await folderUpdatePromise.promise;
    };

    /* list */
    const clearSelection = () => {
        dispatch({ type: "clearSelection" });
    };

    const getChildIndex = (id: string | null | undefined) => {
        return $listState.files.findIndex((file) => file.id == id);
    };

    const scrollToElement = async (id: string) => {
        if (!fileListContainer || !virtualList) return;

        await tick();
        const element = document.getElementById(id);

        if (!element) {
            const index = $listState.files.findIndex((file) => file.id == id);
            if (index <= visibleStartIndex) {
                await virtualList.scrollToIndex(index, { behavior: "instant" }, false);
            } else {
                await virtualList.scrollToIndex(index, { behavior: "instant" }, true);
            }
            return;
        }

        const rect = element.getBoundingClientRect();
        const containerRect = fileListContainer.getBoundingClientRect();
        const containerTop = containerRect.top + 30;
        if (rect.top <= containerTop) {
            fileListContainer.scrollBy(0, rect.top - containerTop);
        }

        if (rect.bottom > containerRect.bottom) {
            fileListContainer.scrollBy(0, rect.height);
        }
    };

    const onColSliderMousedown = (e: MouseEvent, key: Mp.SortKey) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch({ type: "startSlide", value: { target: key, startX: e.clientX } });
    };

    const onAreaSliderMousedown = (e: MouseEvent) => {
        e.preventDefault();
        dispatch({ type: "startSlide", value: { target: "Area", startX: e.clientX } });
    };

    const onMouseDown = (e: MouseEvent) => {
        if (!shouldHandleMouseEvent(e)) return;

        if (e.ctrlKey || e.shiftKey) return;

        startClip(e);
    };

    /* Column item is selected on mousedown. Row is selected on click */
    const colDetailMouseDown = async (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        e.stopPropagation();
        const id = e.target.getAttribute("data-file-id");
        if (!id) return;
        if ($appState.selection.selectedIds.includes(id)) return;

        await toggleSelect(e);
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        if ($appState.slideState.sliding) {
            const dist = e.clientX - $appState.slideState.startX;
            dispatch({ type: "slide", value: dist });
            return;
        }

        if (!fileListContainer) return;

        const alredyMoved = $appState.clip.moved;
        if ($appState.clip.clipping) {
            dispatch({ type: "moveClip", value: { x: e.clientX - fileListContainer.parentElement!.offsetLeft, y: e.clientY - fileListContainer.parentElement!.offsetTop } });
            if (!alredyMoved && $appState.clip.moved) {
                clearSelection();
            }
        }
    };

    const shouldHandleMouseEvent = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return false;
        if ($appState.scrolling) {
            dispatch({ type: "scrolling", value: false });
            return false;
        }
        if (!fileListContainer) return false;
        if ($listState.rename.renaming) return false;
        if ($appState.dragHandler != "View") return false;

        /* Clipping must handle event outside of view */
        if ($appState.clip.clipping) return true;

        if (e.target.hasAttribute("data-path") || e.target.classList.contains("button")) return false;

        if (e.offsetX > e.target.clientWidth || e.offsetY > e.target.clientHeight) {
            dispatch({ type: "scrolling", value: true });
            return false;
        }

        const containerRect = fileListContainer.getBoundingClientRect();
        if (containerRect.x > e.clientX || containerRect.y > e.clientY) {
            dispatch({ type: "scrolling", value: true });
            return false;
        }

        return true;
    };

    const onMouseUp = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        if ($appState.slideState.sliding) {
            const dist = e.clientX - $appState.slideState.startX;
            dispatch({ type: "slide", value: dist });
            dispatch({ type: "endSlide" });
            onColumnHeaderChanged();
        }

        if (!shouldHandleMouseEvent(e)) return;

        if (!$appState.clip.moved && e.target.hasAttribute("data-v-list")) {
            clearSelection();
        }

        endClip();
    };

    const onColumnHeaderChanged = () => {
        main.onColumnHeaderChanged({ leftWidth: $appState.leftWidth, labels: $appState.headerLabels });
    };

    const startDrag = async (e: DragEvent) => {
        e.preventDefault();

        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (!$appState.selection.selectedIds.length) return;
        if ($appState.clip.moved) return;
        if ($appState.dragHandler != "View") return;

        const id = e.target.getAttribute("data-file-id") ?? "";
        if (!$appState.selection.selectedIds.includes(id)) return;

        const paths = $listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id)).map((file) => file.fullPath);
        if (!paths.length) return;

        await ipc.invoke("register_drop_target", undefined);

        await main.startDrag(paths);
    };

    const onDragOver = (e: DragEvent) => {
        if ($appState.dragHandler == "View") {
            e.preventDefault();
        }
    };

    const onDragEnter = (e: DragEvent) => {
        if ($appState.dragHandler != "View") return;
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        const id = e.target.getAttribute("data-file-id") ?? "";

        if (id) {
            dispatch({ type: "dragEnter", value: id });
        } else {
            dispatch({ type: "dragLeave" });
        }
    };

    const onDragLeave = (e: DragEvent) => {
        if ($appState.dragHandler != "View") return;
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        const id = e.target.getAttribute("data-file-id") ?? "";
        if ($appState.dragTargetId == id) {
            dispatch({ type: "dragLeave" });
        }
    };

    const onFileDrop = async (e: Mp.FileDropEvent) => {
        if ($appState.dragHandler != "View") return;
        const dragTargetId = $appState.dragTargetId;

        dispatch({ type: "dragLeave" });

        if ($listState.currentDir.fullPath == HOME || !e.paths) return;

        const destPath = getDropTarget(dragTargetId);

        const sourcePaths = e.paths;

        if (destPath == path.dirname(sourcePaths[0]) || sourcePaths.includes(destPath)) return;

        const shouldCopy = util.getRootDirectory(destPath) != util.getRootDirectory(sourcePaths[0]);

        await moveItems(sourcePaths, destPath, shouldCopy);
    };

    const getDropTarget = (dragTargetId: string): string => {
        const defaultTarget = $listState.currentDir.fullPath;

        if (!dragTargetId) return defaultTarget;

        const destinationFile = $listState.files.find((file) => file.id == dragTargetId);

        if (!destinationFile) return defaultTarget;

        if (destinationFile.isFile) return defaultTarget;

        return destinationFile.fullPath;
    };

    const startClip = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (!fileListContainer) return;
        if (e.target.hasAttribute("data-column")) return;

        const id = e.target.getAttribute("data-file-id") ?? "";

        if ($appState.selection.selectedIds.includes(id)) return;

        if (e.button != 2) {
            dispatch({
                type: "startClip",
                value: { position: { startX: e.clientX - fileListContainer.parentElement!.offsetLeft, startY: e.clientY - fileListContainer.parentElement!.offsetTop }, startId: id },
            });
        }
    };

    const getClipRect = (e: MouseEvent): Mp.Rect => {
        const inverseX = $appState.clip.inverseX;
        const inverseY = $appState.clip.inverseY;
        const left = e.clientX - fileListContainer!.parentElement!.offsetLeft;
        const top = e.clientY - fileListContainer!.parentElement!.offsetTop;
        const right = inverseX ? left - clipRegion!.width : left + clipRegion!.width;
        const bottom = inverseY ? top - clipRegion!.height : top + clipRegion!.height;
        return {
            top: inverseY ? bottom : top,
            left: inverseX ? right : left,
            right: inverseX ? left : right,
            bottom: inverseY ? top : bottom,
        };
    };

    const getItemRect = (el: HTMLElement): Mp.Rect => {
        const left = el.offsetLeft - fileListContainer!.scrollLeft;
        const top = el.offsetTop - fileListContainer!.scrollTop;
        const right = left + el.clientWidth;
        const bottom = top + el.clientHeight;
        return {
            top,
            left,
            right,
            bottom,
        };
    };

    const isRectInRect = (rect: Mp.Rect, rect2: Mp.Rect) => {
        return !(rect2.left >= rect.right || rect2.right <= rect.left || rect2.top >= rect.bottom || rect2.bottom <= rect.top);
    };

    const clipMouseEnter = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (!$appState.clip.clipping) return;

        const rect = getClipRect(e);

        const selected: string[] = [];
        document.querySelectorAll(".selectable").forEach((e) => {
            const rect2 = getItemRect(e as HTMLElement);
            const id = e.getAttribute("data-file-id");
            if (!id) return;
            if (isRectInRect(rect, rect2) && !$appState.selection.selectedIds.includes(id)) {
                selected.push(id);
            }
        });

        if (selected.length) {
            dispatch({ type: "appendSelectedIds", value: selected });
        }
    };

    const clipMouseLeave = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (!$appState.clip.clipping) return;

        const rect = getClipRect(e);

        const unselected: string[] = [];
        document.querySelectorAll(".selectable").forEach((e) => {
            const rect2 = getItemRect(e as HTMLElement);
            const id = e.getAttribute("data-file-id");
            if (!id) return;
            if (!isRectInRect(rect, rect2) && $appState.selection.selectedIds.includes(id)) {
                unselected.push(id);
            }
        });

        if (unselected.length) {
            dispatch({ type: "removeSelectedIds", value: unselected });
        }
    };

    const endClip = () => {
        if ($appState.clip.clipping) {
            dispatch({ type: "endClip" });
        }
    };

    const onColumnHeaderClick = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        if (e.button != 2) {
            const key = (e.target.getAttribute("data-sort-key") as Mp.SortKey) ?? "name";

            const asc = $appState.sort.key == key ? !$appState.sort.asc : true;
            const type: Mp.SortType = {
                key,
                asc,
            };
            dispatch({ type: "sort", value: type });
            const result = main.sort({ files: $listState.files, type });
            onSorted(result);
        }
    };

    const onRowClick = async (e: MouseEvent) => {
        await toggleSelect(e);
    };

    const toggleSelect = async (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        const id = e.target.getAttribute("data-file-id");

        if (!id) {
            return;
        }

        if (e.ctrlKey) {
            await selectByCtrl(id);
            return;
        }

        if (e.shiftKey) {
            selectByShift(id);
            return;
        }

        await selectByClick(id);
    };

    const select = async (id: string) => {
        clearSelection();

        dispatch({ type: "updateSelection", value: { selectedId: id, selectedIds: [id] } });

        await scrollToElement(id);
    };

    const selectMultiple = async (ids: string[]) => {
        clearSelection();

        const lastItem = ids[ids.length - 1];
        dispatch({ type: "updateSelection", value: { selectedId: lastItem, selectedIds: ids } });

        await scrollToElement(lastItem);
    };

    const selectByClick = async (id: string) => {
        await select(id);
    };

    const selectByShift = (id: string) => {
        dispatch({ type: "setSelectedIds", value: [] });

        const range = [];

        if ($appState.selection.selectedId) {
            range.push(getChildIndex($appState.selection.selectedId));
        } else {
            range.push(0);
        }

        range.push(getChildIndex(id));

        range.sort((a, b) => a - b);

        const ids: string[] = [];
        for (let i = range[0]; i <= range[1]; i++) {
            ids.push($listState.files[i].id);
        }

        dispatch({ type: "setSelectedIds", value: ids });
    };

    const selectByCtrl = async (id: string) => {
        if (!$appState.selection.selectedId) {
            await selectByClick(id);
            return;
        }

        dispatch({ type: "appendSelectedIds", value: [id] });
    };

    const selectAll = () => {
        clearSelection();

        const ids = $listState.files.map((file) => file.id);

        dispatch({ type: "appendSelectedIds", value: ids });
    };

    const moveSelectionByShit = async (key: string) => {
        if (!$appState.selection.selectedIds.length) {
            await select($listState.files[0].id);
        }

        const downward = $appState.selection.selectedId == $appState.selection.selectedIds[0];

        const currentId = downward ? $appState.selection.selectedIds[$appState.selection.selectedIds.length - 1] : $appState.selection.selectedIds[0];
        const currentIndex = getChildIndex(currentId);
        const nextId = key === "ArrowDown" ? $listState.files[currentIndex + 1]?.id : $listState.files[currentIndex - 1]?.id;

        if (!nextId) return;

        return selectByShift(nextId);
    };

    const moveSelection = async (e: KeyboardEvent) => {
        if (!$listState.files.length) return;

        if (e.shiftKey) {
            return await moveSelectionByShit(e.key);
        }

        const currentId = $appState.selection.selectedId ? $appState.selection.selectedId : $listState.files[0].id;
        const currentIndex = getChildIndex(currentId);
        const nextId = e.key === "ArrowDown" ? $listState.files[currentIndex + 1]?.id : $listState.files[currentIndex - 1]?.id;

        if (!nextId) return;

        clearSelection();
        await select(nextId);
    };

    const selectUpto = async (e: KeyboardEvent) => {
        if (!$listState.files.length) return;
        if (e.key == "Home") {
            await select($listState.files[0].id);
        } else {
            await select($listState.files[$listState.files.length - 1].id);
        }
    };

    const moveSelectionUpto = async (e: KeyboardEvent) => {
        if (!$listState.files.length) return;

        e.preventDefault();

        const targetId = e.key === HOME ? $listState.files[0].id : $listState.files[$listState.files.length - 1].id;

        if (!targetId) return;

        selectByShift(targetId);
        await scrollToElement(targetId);
    };

    /* rename */
    const startEditFileName = () => {
        if (isRecycleBin()) return;

        const file = $listState.files.find((file) => file.id == $appState.selection.selectedId);

        if (!file) return;

        const selectedElement = document.getElementById(file.uuid);

        if (!selectedElement) return;

        const rect = selectedElement.getBoundingClientRect();

        dispatch({
            type: "startRename",
            value: {
                rect: {
                    top: rect.top - 2,
                    left: rect.left - 2,
                    width: rect.width,
                    height: rect.height,
                },
                oldName: path.basename(file.fullPath),
                fullPath: file.fullPath,
                uuid: file.uuid,
            },
        });

        dispatch({ type: "preventBlur", value: false });
    };

    const endRename = () => {
        dispatch({ type: "endRename" });
    };

    const endEditFileName = () => {
        if (!$listState.rename.renaming) return;

        if ($listState.rename.oldName === $listState.rename.newName) {
            endRename();
        } else {
            requestRename();
        }
    };

    const requestRename = async () => {
        dispatch({ type: "preventBlur", value: true });
        folderUpdatePromise = new Deferred();
        const result = await main.renameItem($listState.rename.fullPath, $listState.rename.newName);
        endRename();
        if (!result.done) {
            folderUpdatePromise = null;
            const files = $listState.files.filter((file) => file.fullPath == $listState.rename.fullPath);
            select(files[0].id);
            return;
        }

        await safePromise();
        select(result.newId);
    };

    const setFocusAndSelect = (node: HTMLInputElement) => {
        node.focus();
        node.setSelectionRange(0, node.value.lastIndexOf("."));
    };

    const onRenameInputKeyDown = (e: KeyboardEvent) => {
        if (!e.target || !(e.target instanceof HTMLInputElement)) return;

        if (e.key === "Enter") {
            e.stopPropagation();
            e.preventDefault();
            endEditFileName();
            return;
        }
    };

    const onRenameInput = (e: Event) => {
        if (!e.target || !(e.target instanceof HTMLInputElement)) return;

        const _canvas = canvas || (canvas = document.createElement("canvas"));
        const context = _canvas.getContext("2d");
        if (!context) {
            return {
                visiblePaths: $listState.currentDir.paths,
                overflownPaths: [],
            };
        }
        context.font = 'normal 12px "Segoe UI"';
        let width = 5;
        const metrics = context.measureText($listState.rename.newName);
        width += metrics.width;
        dispatch({ type: "changeInputWidth", value: Math.ceil(width) });
    };

    const createItem = async (isFile: boolean) => {
        folderUpdatePromise = new Deferred();
        const result = await main.createItem(isFile);

        if (result.success) {
            await safePromise();
            await select(result.newItemId);
            startEditFileName();
        } else {
            folderUpdatePromise = null;
        }
    };

    const trashItem = async () => {
        if (!$appState.selection.selectedIds.length) return;
        const files = $listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));
        await main.trashItems({ files });
    };

    const deleteItem = async () => {
        if (!$appState.selection.selectedIds.length) return;

        const files = $listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));
        await main.deleteItems({ files });
    };

    const undeleteItem = async () => {
        if (!$appState.selection.selectedIds.length) return;
        const files = $listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));
        const items = files.map((file) => {
            return {
                fullPath: file.originalPath,
                deletedDate: file.ddate,
            };
        });
        await main.undeleteItems({ undeleteSpecific: true, items });
        await reload(false);
    };

    const deleteFromRecycleBin = async () => {
        if (!$appState.selection.selectedIds.length) return;
        const files = $listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));
        const items = files.map((file) => {
            return {
                fullPath: file.originalPath,
                deletedDate: file.ddate,
            };
        });
        await main.deleteFromRecycleBin({ undeleteSpecific: true, items });
        await reload(false);
    };

    const writeFullPathToClipboard = async () => {
        const fullPaths = $appState.selection.selectedIds.length
            ? $listState.files
                  .filter((file) => $appState.selection.selectedIds.includes(file.id))
                  .map((file) => file.fullPath)
                  .join("\r\n")
            : $listState.currentDir.fullPath;
        await main.writeFullpathToClipboard(fullPaths);
    };

    const markCopyCut = async (copy: boolean) => {
        const files = $listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));
        dispatch({ type: "copyCut", value: { operation: copy ? "Copy" : "Move", ids: $appState.selection.selectedIds, files } });
        await main.writeClipboard({ files, operation: copy ? "Copy" : "Move" });
    };

    const moveItems = async (fullPaths: string[], dir: string, copy: boolean) => {
        folderUpdatePromise = new Deferred(fullPaths.length - 1);
        const result = await main.moveItems({ fullPaths, dir, copy });
        if (!result.done) {
            folderUpdatePromise = null;
            return;
        }
        dispatch({ type: "clearCopyCut" });
        await safePromise();
        onPasteEnd(result);
    };

    const pasteItems = async () => {
        const result = await main.getUrlsFromClipboard($appState.copyCutTargets.files, $appState.copyCutTargets.op);
        if (result.fullPaths.length) {
            await moveItems(result.fullPaths, result.dir, result.copy);
        }
    };

    const onPasteEnd = async (e: Mp.MoveItemResult) => {
        const ids = $listState.files.filter((file) => e.fullPaths.includes(file.fullPath)).map((file) => file.id);
        await selectMultiple(ids);
    };

    const sendRemovingFavorite = () => {
        if ($appState.hoverFavoriteId) {
            const result = main.removeFavorite($appState.hoverFavoriteId);
            onFavoriteChanged(result);
            dispatch({ type: "hoverFavoriteId", value: "" });
        }
    };

    const reload = async (includeDrive: boolean) => {
        if ($appState.search.searching) {
            await endSearch(true);
        } else {
            const result = await main.reload(includeDrive);
            if (result) {
                load(result);
            }
        }
    };

    const searchNext = (key: string) => {
        if ($appState.selection.selectedIds.length) {
            const selectedId = $appState.selection.selectedIds[0];
            const current = $listState.files.findIndex((file) => file.id == selectedId);
            const indexes: number[] = [];
            $listState.files.forEach((file, index) => {
                if (file.name.toLowerCase().startsWith(key) && file.id != selectedId) {
                    indexes.push(index);
                }
            });

            if (!indexes.length) {
                return null;
            }

            const next = indexes.filter((i) => i > current);
            if (next.length) {
                return $listState.files[next[0]];
            } else {
                return $listState.files[indexes[0]];
            }
        } else {
            return $listState.files.find((file) => file.name.toLowerCase().startsWith(key));
        }
    };

    const startSearch = async () => {
        dispatch({ type: "clearCopyCut" });
        dispatch({ type: "startSearch" });
        const result = await main.search({ dir: $listState.currentDir.fullPath, key: $appState.search.key, refresh: false });
        onSearched(result);
    };

    const onSearched = (e: Mp.SearchResult) => {
        dispatch({ type: "updateFiles", value: { files: e.files } });
    };

    const clearSearchHighlight = () => {
        CSS.highlights.clear();
    };

    const endSearch = async (refresh: boolean) => {
        clearSearchHighlight();

        if (refresh) {
            await main.onSearchEnd(true);
            const result = await main.search({ dir: $listState.currentDir.fullPath, key: $appState.search.key, refresh: false });
            onSearched(result);
        } else {
            dispatch({ type: "endSearch" });
            const result = await main.onSearchEnd(false);
            onSearched(result);
        }
    };

    const incrementalSearch = (key: string) => {
        let file;
        let incrementalKey = $appState.incrementalKey;
        if (!$appState.incrementalKey) {
            incrementalKey = key.toLowerCase();
            file = searchNext(incrementalKey);
        } else {
            const value = $appState.incrementalKey == key ? "" : key;
            incrementalKey = ($appState.incrementalKey + value).toLowerCase();

            if (incrementalKey != $appState.incrementalKey) {
                file = $listState.files.find((file) => file.name.toLowerCase().startsWith(incrementalKey));
            } else {
                file = searchNext(incrementalKey);
            }
        }

        if (file) {
            dispatch({ type: "incremental", value: incrementalKey });
            select(file.id);
        }
    };

    const searchHighlight = (nodes: HTMLElement[]) => {
        if (!$appState.search.key || !$listState.files.length) {
            clearSearchHighlight();
            return;
        }

        const searchTextHighlight = new Highlight();

        Array.from(nodes).forEach((node) => {
            const nameNode = node.querySelectorAll(".name")[0];
            const text = nameNode.textContent;
            if (text) {
                if (text.match(/[\!#\$\%&'\(\)\=\~\^\-\|`@\{\[\+;\]\}\,\_\s]/g)) {
                    highlightNameOneByOne(text, nameNode, searchTextHighlight);
                } else {
                    highlightName(text, nameNode, searchTextHighlight);
                }
            }
        });

        CSS.highlights.set("searched", searchTextHighlight);
    };

    const highlightName = (text: string, nameNode: Element, searchTextHighlight: Highlight) => {
        const start = text.toLocaleLowerCase().indexOf($appState.search.key.toLocaleLowerCase());
        const end = $appState.search.key.length;

        const range = new Range();
        range.setStart(nameNode.childNodes[0], start);
        range.setEnd(nameNode.childNodes[0], start + end);
        searchTextHighlight.add(range);
    };

    const highlightNameOneByOne = (text: string, nameNode: Element, searchTextHighlight: Highlight) => {
        const texts = text.toLocaleLowerCase().split("");
        const keys = $appState.search.key.toLocaleLowerCase().split("");

        texts.forEach((text, i) => {
            if (keys.length - 1 < i) {
                return;
            }
            const key = keys[i];
            if (text != key && !key.match(/[\!#\$\%&'\(\)\=\~\^\-\|`@\{\[\+;\]\}\,\_\s]/g)) {
                return keys.splice(i, 0, text);
            }

            if (text == key) {
                const start = i;
                const end = 1;

                const range = new Range();
                range.setStart(nameNode.childNodes[0], start);
                range.setEnd(nameNode.childNodes[0], start + end);
                searchTextHighlight.add(range);
            }
        });
    };

    const onSorted = async (e: Mp.SortResult) => {
        dispatch({ type: "updateFiles", value: { files: e.files } });

        if ($appState.selection.selectedIds.length) {
            await tick();
            select($appState.selection.selectedIds[0]);
        }
    };

    const onFavoriteChanged = (e: Mp.MediaFile[]) => {
        dispatch({ type: "changeFavorites", value: e });
    };

    const changeFavorites = () => {
        main.changeFavorites($appState.favorites);
    };

    const undo = async () => {
        await main.undo();
    };

    const redo = async () => {
        await main.redo();
    };

    const onSelect = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        if (e.target.classList.contains("nofocus")) return;

        const id = e.target.getAttribute("data-file-id");

        if (!id) {
            dispatch({ type: "reset" });
            return;
        }

        const file = $listState.files.find((file) => file.id == id);

        if (file) {
            requestLoad(file.linkPath ? file.linkPath : file.fullPath, file.isFile, "Direct");
        } else {
            dispatch({ type: "reset" });
        }
    };

    const goBack = async () => {
        if (!$appState.canGoBack) return;

        if ($appState.search.searching) {
            return await endSearch(false);
        }

        const navigationHistory = BACKWARD[BACKWARD.length - 1];
        requestLoad(navigationHistory.fullPath, false, "Back");
    };

    const goForward = async () => {
        if (!$appState.canGoForward) return;

        if ($appState.search.searching) {
            return await endSearch(false);
        }

        const navigationHistory = FORWARD[FORWARD.length - 1];
        requestLoad(navigationHistory.fullPath, false, "Forward");
    };

    const requestLoad = async (fullPath: string, isFile: boolean, navigation: Mp.Navigation) => {
        if (!isFile && $appState.search.searching) {
            await endSearch(false);
        }

        if (fullPath != $listState.currentDir.fullPath) {
            const result = await main.onSelect({ fullPath, isFile, navigation });
            if (result) {
                load(result);
            }
        }
    };

    const restoreSelection = (navigationHistory: Mp.NavigationHistory | undefined) => {
        if (!navigationHistory) return;

        if (navigationHistory.selection.selectedIds.length == 1) {
            dispatch({ type: "updateSelection", value: navigationHistory.selection });
        }
    };

    const setTitle = async () => {
        const title = $listState.currentDir.paths.length ? $listState.currentDir.paths[$listState.currentDir.paths.length - 1] : HOME;
        await WebviewWindow.getCurrent().setTitle(title);
    };

    const isRecycleBin = () => $listState.currentDir.fullPath == RECYCLE_BIN;

    const shouldDisplayLabel = (key: Mp.SortKey) => {
        if (key == "directory" && (!$appState.search.searching || isRecycleBin())) return false;

        if (key == "ddate" && !isRecycleBin()) return false;

        if (key == "orig_path" && !isRecycleBin()) return false;

        return true;
    };

    const navigate = (e: Mp.LoadEvent) => {
        if (e.navigation == "Reload") {
            dispatch({ type: "load", value: { event: e } });
            return false;
        }

        if (e.navigation == "Back") {
            FORWARD.push({ fullPath: $listState.currentDir.fullPath, selection: $appState.selection });
            const navigationHistory = BACKWARD.pop();
            restoreSelection(navigationHistory);
        }

        if (e.navigation == "Forward") {
            BACKWARD.push({ fullPath: $listState.currentDir.fullPath, selection: $appState.selection });
            const navigationHistory = FORWARD.pop();
            restoreSelection(navigationHistory);
        }

        if (e.navigation == "Direct" || e.navigation == "PathSelect") {
            dispatch({ type: "endSearch" });
            FORWARD.pop();
            BACKWARD.push({ fullPath: $listState.currentDir.fullPath, selection: $appState.selection });

            if (e.navigation == "PathSelect") {
                const navigationHistory = BACKWARD.find((navhistory) => navhistory.fullPath == e.directory);
                restoreSelection(navigationHistory);
            }
        }

        return true;
    };

    const load = async (e: Mp.LoadEvent) => {
        if (e.failed) return;

        if (!navigate(e)) return;

        visibleStartIndex = 0;
        visibleEndIndex = 0;
        dispatch({ type: "toggleGridView", value: false });
        dispatch({ type: "headerLabels", value: e.headers });
        dispatch({ type: "history", value: { canGoBack: BACKWARD.length > 0, canGoForward: FORWARD.length > 0 } });
        dispatch({ type: "sort", value: e.sortType });
        dispatch({ type: "load", value: { event: e } });

        if (e.drives) {
            dispatch({ type: "drives", value: e.drives });
        }

        await setTitle();

        await tick();

        if (fileListContainer) {
            fileListContainer.scrollTop = 0;
            fileListContainer.scrollLeft = 0;
        }

        if ($appState.selection.selectedIds.length) {
            await select($appState.selection.selectedIds[0]);
        }
    };

    const init = async (e: Mp.LoadEvent) => {
        dispatch({ type: "sort", value: e.sortType });
        dispatch({ type: "load", value: { event: e } });
        await setTitle();
    };

    const openSettingsAsJson = async () => {
        await main.openConfigFileJson();
    };

    const handleContextMenuEvent = async (e: keyof Mp.MainContextMenuSubTypeMap | keyof Mp.FavContextMenuSubTypeMap) => {
        switch (e) {
            case "Open": {
                const file = $listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
                if (!file) return;
                const result = await main.onSelect({ fullPath: file.fullPath, isFile: file.isFile, navigation: "Direct" });
                if (result) {
                    load(result);
                }
                break;
            }

            case "OpenInNewWindow": {
                const file = $listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
                if (!file) return;
                await main.openInNewWindow(file.fullPath);
                break;
            }

            case "SelectApp": {
                const file = $listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
                if (!file) return;
                await main.showAppSelector(file.fullPath);
                break;
            }

            case "Copy": {
                await markCopyCut(true);
                break;
            }

            case "Cut": {
                await markCopyCut(false);
                break;
            }

            case "Trash": {
                await trashItem();
                break;
            }

            case "Delete": {
                await deleteItem();
                break;
            }

            case "Undelete": {
                await undeleteItem();
                break;
            }

            case "DeleteFromRecycleBin":
                await deleteFromRecycleBin();
                break;

            case "EmptyRecycleBin":
                const emptied = await main.emptyRecycleBin();
                if (emptied) {
                    await reload(false);
                }
                break;

            case "Paste": {
                await pasteItems();
                break;
            }

            case "CopyFullpath": {
                await writeFullPathToClipboard();
                break;
            }

            case "Property": {
                if ($appState.hoverFavoriteId) {
                    await main.openPropertyDielog($appState.hoverFavoriteId);
                    dispatch({ type: "hoverFavoriteId", value: "" });
                    break;
                }

                const file = $listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
                await main.openPropertyDielog(file ?? util.toFolder($listState.currentDir.fullPath));

                break;
            }

            case "AddToFavorite": {
                const file = $listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
                if (!file) return;

                if (!file.isFile) {
                    const favorites = main.addFavorite(file);
                    onFavoriteChanged(favorites);
                }
                break;
            }

            case "Settings":
                await openSettingsAsJson();
                break;

            case "RemoveFromFavorite":
                sendRemovingFavorite();
                break;

            case "Refresh":
                const result = await util.getDriveInfo();
                dispatch({ type: "drives", value: result });
                break;

            case "Terminal":
                await main.openTerminal($listState.currentDir.fullPath, false);
                break;

            case "AdminTerminal":
                await main.openTerminal($listState.currentDir.fullPath, true);
                break;

            default: {
                const file = $listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
                if (!file) return;
                await main.openFileWith(file.fullPath, e as string);
            }
        }
    };

    const onkeyup = async (e: KeyboardEvent) => {
        if (navigator.userAgent.includes(OS.windows)) return;

        if (e.key == "Delete") {
            e.preventDefault();
            if (e.shiftKey) {
                return await deleteItem();
            } else {
                return await trashItem();
            }
        }

        if (!handleKeyUp) return;

        if (e.key == "Control") {
            return;
        }

        if (e.key == "c") {
            handleKeyUp = false;
            e.preventDefault();
            markCopyCut(true);
        }

        if (e.key == "x") {
            handleKeyUp = false;
            e.preventDefault();
            return markCopyCut(false);
        }

        if (e.key == "v") {
            handleKeyUp = false;
            e.preventDefault();
            return pasteItems();
        }

        handleKeyUp = false;
    };

    const onkeydown = async (e: KeyboardEvent) => {
        if (e.ctrlKey) {
            handleKeyUp = true;
        }

        if (e.ctrlKey && BROWSER_SHORTCUT_KEYS.includes(e.key)) {
            e.preventDefault();
        }

        if (e.key == "F3" || e.key == "F5") {
            e.preventDefault();
        }

        if ($listState.rename.renaming) return;
        if ($appState.pathEditing) return;
        if ($appState.prefVisible) return;
        if ($appState.symlinkVisible) return;
        if (header.hasSearchInputFocus()) return;

        if (e.ctrlKey && e.key == "f") {
            e.preventDefault();
            header.focusSearchInput();
            return;
        }

        if (e.key == "Enter") {
            if ($appState.selection.selectedIds.length == 1) {
                const file = $listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
                if (file) {
                    e.preventDefault();
                    requestLoad(file.linkPath ? file.linkPath : file.fullPath, file.isFile, "Direct");
                }
                return;
            }
        }

        if (e.key == "F2") {
            startEditFileName();
            return;
        }

        if (e.key == "F5") {
            e.preventDefault();
            reload(true);
            return;
        }

        if (e.ctrlKey && e.key === "a") {
            e.preventDefault();
            return selectAll();
        }

        if (e.ctrlKey && e.key === "z") {
            e.preventDefault();
            return undo();
        }

        if (e.ctrlKey && e.key === "y") {
            e.preventDefault();
            return redo();
        }

        if (e.ctrlKey && e.key === "t") {
            if ($listState.currentDir.fullPath != HOME && !isRecycleBin()) {
                e.preventDefault();
                return dispatch({ type: "toggleGridView", value: !$appState.isInGridView });
            }
        }

        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            return await moveSelection(e);
        }

        if (e.altKey && e.key == "ArrowLeft") {
            e.preventDefault();
            await goBack();
            return;
        }

        if (e.altKey && e.key == "ArrowRight") {
            e.preventDefault();
            await goForward();
            return;
        }

        if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            if (e.shiftKey) {
                return await moveSelectionUpto(e);
            } else {
                return await selectUpto(e);
            }
        }

        if (e.ctrlKey && e.key == "c") {
            e.preventDefault();
            return markCopyCut(true);
        }

        if (e.ctrlKey && e.key == "x") {
            e.preventDefault();
            return markCopyCut(false);
        }

        if (e.ctrlKey && e.key == "v") {
            e.preventDefault();
            return pasteItems();
        }

        if (e.key == "Delete") {
            e.preventDefault();
            if (e.shiftKey) {
                return await deleteItem();
            } else {
                return await trashItem();
            }
        }

        if (e.key == "Escape") {
            e.preventDefault();
            dispatch({ type: "clearCopyCut" });
            return;
        }

        if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
            if (e.key.length == 1 && $listState.files.length) {
                if (searchInterval) {
                    window.clearTimeout(searchInterval);
                }
                incrementalSearch(e.key);
                searchInterval = window.setTimeout(() => {
                    dispatch({ type: "clearIncremental" });
                }, 300);

                return;
            }
        }

        if (e.ctrlKey || e.shiftKey || e.altKey || e.key.length > 1) {
            e.preventDefault();
        }
    };

    const clearHeaderHistory = () => {
        main.clearHeaderHistory();
    };

    const onPreferenceChange = async (isAppMenuItemChanged: boolean) => {
        await main.onPreferenceChanged({ theme: $appState.theme, appMenuItems: $appState.appMenuItems, allowMoveColumn: $appState.allowMoveColumn });
        if (isAppMenuItemChanged) {
            await main.changeAppMenuItems($appState.appMenuItems);
        }
    };

    const getSymlinkTargetItem = async (currentDir: string, folder: boolean) => {
        return main.showFileFolderDialog("Select a file/folder", currentDir, folder);
    };

    const createSymlink = async (path: string, linkPath: string) => {
        await main.createSymlink(path, linkPath);
    };

    const toChunk = () => {
        if (!fileListContainer) return [];
        const chunks = [];
        const files = structuredClone($listState.files);
        const chunkSize = Math.floor(fileListContainer.clientWidth / GRID_ITEM_WIDTH);
        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            chunks.push(chunk);
        }
        return chunks;
    };

    const onDeviceEvent = async (e: Mp.DeviceEvent) => {
        if (!e.name.includes("Disk") && !e.name.includes("Storage")) return;

        const drives = await util.getDriveInfo();

        if (e.event == "Removed") {
            const newMountPoints = drives.map((info) => info.path);
            const removedMountPoints = $appState.drives.filter((info) => !newMountPoints.includes(info.path)).map((info) => info.path);
            const currentDirRoot = util.getRootDirectory($listState.currentDir.fullPath);

            if (removedMountPoints.includes(currentDirRoot)) {
                await requestLoad(HOME, false, "Direct");
            }

            // If any paths of removed drive exist in history, clear history
            const invalidBackHistory = BACKWARD.filter((history) => removedMountPoints.includes(util.getRootDirectory(history.fullPath)));
            if (invalidBackHistory.length) {
                BACKWARD.length = 0;
            }

            const invalidForwardHistory = FORWARD.filter((history) => removedMountPoints.includes(util.getRootDirectory(history.fullPath)));
            if (invalidForwardHistory.length) {
                FORWARD.length = 0;
            }

            dispatch({ type: "history", value: { canGoBack: BACKWARD.length > 0, canGoForward: FORWARD.length > 0 } });
        }

        dispatch({ type: "drives", value: drives });
    };

    const onWatchEvent = async (e: Mp.WatchEvent) => {
        dispatch({ type: "clearSelection" });
        const files = await main.onWatchEvent(e);
        if (files) {
            dispatch({ type: "updateFiles", value: { files } });
        }

        await resolvePromise();
    };

    const resolvePromise = async () => {
        if (!folderUpdatePromise) return;

        if (!folderUpdatePromise.value) {
            await tick();
            folderUpdatePromise.resolve(0);
            folderUpdatePromise = null;
            return;
        }

        if (folderUpdatePromise.value == 0) {
            await tick();
            folderUpdatePromise.resolve(0);
            folderUpdatePromise = null;
        } else {
            folderUpdatePromise.value = folderUpdatePromise.value--;
        }
    };

    const prepare = async () => {
        const e = await main.onMainReady("viewContent");

        await main.changeTheme(e.settings.theme);
        await main.changeAppMenuItems(e.settings.appMenuItems);
        dispatch({ type: "setPreference", value: { theme: e.settings.theme, appMenuItems: e.settings.appMenuItems, allowMoveColumn: e.settings.allowMoveColumn } });
        dispatch({ type: "headerLabels", value: e.settings.headerLabels });
        dispatch({ type: "leftWidth", value: e.settings.leftAreaWidth });
        dispatch({ type: "sort", value: DEFAULT_SORT_TYPE });
        dispatch({ type: "changeFavorites", value: e.settings.favorites });

        await init(e.data);
        await tick();
        if (e.selectId) {
            await select(e.selectId);
        }
        const webview = WebviewWindow.getCurrent();
        await webview.setSize(util.toPhysicalSize(e.settings.bounds));
        await webview.setPosition(util.toPhysicalPosition(e.settings.bounds));
        await webview.show();
    };

    onMount(() => {
        prepare();
        ipc.receiveTauri("tauri://resize", onWindowSizeChanged);
        // ipc.receiveTauri("tauri://theme-changed", (e) => console.log(e));
        ipc.receive("contextmenu_event", handleContextMenuEvent);
        ipc.receive("watch_event", onWatchEvent);
        ipc.receive("device_event", onDeviceEvent);
        ipc.receiveTauri<Mp.FileDropEvent>("tauri://drag-drop", onFileDrop);

        return () => {
            ipc.release();
        };
    });
</script>

<svelte:window oncontextmenu={(e) => e.preventDefault()} />
<svelte:document {onkeydown} {onkeyup} onmousemove={onMouseMove} onmousedown={onMouseDown} onmouseup={onMouseUp} ondragover={onDragOver} ondragenter={onDragEnter} ondragleave={onDragLeave} />

<div class="viewport" class:full-screen={$appState.isFullScreen} class:sliding={$appState.slideState.sliding}>
    <Bar />
    <div class="view">
        {#if $appState.prefVisible}
            <Preference preferenceChanged={onPreferenceChange} {openSettingsAsJson} {clearHeaderHistory} />
        {/if}
        {#if $appState.symlinkVisible}
            <Symlink {showErrorMessage} {getSymlinkTargetItem} {createSymlink} />
        {/if}
        <Header {requestLoad} {startSearch} {endSearch} {goBack} {goForward} {createItem} {reload} bind:this={header} />
        <div id="viewContent" class="body" ondragover={onDragOver} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <Left {requestLoad} {changeFavorites} />
            <div class="area-divider" onmousedown={onAreaSliderMousedown} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                <div class="line"></div>
            </div>
            <div
                class="main"
                class:clipping={$appState.clip.clipping}
                class:searched={$appState.search.searching}
                oncontextmenu={onListContextMenu}
                onkeydown={handleKeyEvent}
                onscroll={endEditFileName}
                ondragstart={startDrag}
                role="button"
                tabindex="-1"
            >
                {#if $appState.clip.moved}
                    <div bind:contentRect={clipRegion} class="clip-area" style={$appState.clip.clipAreaStyle}></div>
                {/if}

                {#if $listState.rename.renaming}
                    <input
                        type="text"
                        class="input rename"
                        style="top:{$listState.rename.rect.top}px; left:{$listState.rename.rect.left}px; width:{$listState.rename.rect.width}px; height:{$listState.rename.rect.height}px"
                        spellCheck="false"
                        onblur={$appState.preventBlur ? undefined : endEditFileName}
                        onkeydown={onRenameInputKeyDown}
                        oninput={onRenameInput}
                        bind:value={$listState.rename.newName}
                        use:setFocusAndSelect
                        autocomplete="one-time-code"
                    />
                {/if}

                {#if $listState.currentDir.fullPath == HOME}
                    <Home {requestLoad} />
                {:else if $appState.isInGridView}
                    <VirtualList
                        items={toChunk()}
                        bind:viewport={fileListContainer}
                        bind:start={visibleStartIndex}
                        bind:end={visibleEndIndex}
                        itemHeight={140}
                        headerHeight={0}
                        onRefresh={searchHighlight}
                        thumbnail={true}
                    >
                        {#snippet header()}{/snippet}
                        {#snippet item(items)}
                            {#each items as item (item.uuid)}
                                <div
                                    id={item.id}
                                    class="thumb-column selectable"
                                    draggable="true"
                                    class:selected={$appState.selection.selectedIds.includes(item.id)}
                                    class:being-selected={$appState.selection.selectedId == item.id}
                                    class:cut={$appState.copyCutTargets.ids.includes(item.id) && $appState.copyCutTargets.op == "Move"}
                                    class:drag-highlight={!item.isFile && $appState.dragTargetId == item.id}
                                    onmouseover={clipMouseEnter}
                                    onmouseout={clipMouseLeave}
                                    onfocus={() => {}}
                                    onblur={() => {}}
                                    onclick={onRowClick}
                                    ondblclick={onSelect}
                                    onkeydown={handleKeyEvent}
                                    data-file-id={item.id}
                                    role="button"
                                    tabindex="-1"
                                >
                                    <div class="thumb-col-detail" data-file-id={item.id}>
                                        <div
                                            class="thumb-entry-name draggable"
                                            title={$appState.search.searching ? item.fullPath : item.name}
                                            data-file-id={item.id}
                                            onmousedown={colDetailMouseDown}
                                            role="button"
                                            tabindex="-1"
                                        >
                                            <div
                                                class="icon"
                                                class:folder={item.entityType == "Folder" || item.entityType == "SymlinkFolder"}
                                                class:hidden-folder={item.fileType == "HiddenFolder"}
                                                data-file-id={item.id}
                                            >
                                                {#if item.linkPath}
                                                    <div class="symlink-icon"><div class="symlink-arrow"></div></div>
                                                {/if}
                                                {#if item.isFile}
                                                    {#if item.fileType == "Audio"}
                                                        <AudioSvg />
                                                    {:else if item.fileType == "Video"}
                                                        {#await main.toVideoThumbnail(item.fullPath)}
                                                            <div style="width: 100px;height:90px;"></div>
                                                        {:then data}
                                                            <div class="cover">
                                                                <div class="film"></div>
                                                                <img src={data} class="thumbnail-video" alt="" loading="lazy" decoding="async" />
                                                                <div class="film"></div>
                                                            </div>
                                                        {/await}
                                                    {:else if item.fileType == "Image"}
                                                        {#await main.toImageThumbnail(item.fullPath)}
                                                            <div style="width: 100px;height:90px;"></div>
                                                        {:then data}
                                                            <img src={data} class="thumbnail-img" alt="" loading="lazy" decoding="async" />
                                                        {/await}
                                                    {:else if item.fileType == "Zip"}
                                                        <Zip />
                                                    {:else if item.fileType == "App"}
                                                        <AppSvg />
                                                    {:else}
                                                        <FileSvg />
                                                    {/if}
                                                {:else if item.fileType == "Desktop"}
                                                    <DirDesktop />
                                                {:else if item.fileType == "Documents"}
                                                    <DirDocuments />
                                                {:else if item.fileType == "Downloads"}
                                                    <DirDownloads />
                                                {:else if item.fileType == "Music"}
                                                    <DirMusic />
                                                {:else if item.fileType == "Pictures"}
                                                    <DirImage />
                                                {:else if item.fileType == "Videos"}
                                                    <DirVideo />
                                                {:else}
                                                    <FolderSvg />
                                                {/if}
                                            </div>
                                            <div class="name" id={item.uuid} data-file-id={item.id} class:rename-hidden={$listState.rename.targetUUID == item.uuid}>
                                                {item.name}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        {/snippet}
                        {#snippet empty()}{/snippet}
                    </VirtualList>
                {:else}
                    <VirtualList
                        items={$listState.files}
                        bind:this={virtualList}
                        bind:viewport={fileListContainer}
                        bind:start={visibleStartIndex}
                        bind:end={visibleEndIndex}
                        itemHeight={30}
                        headerHeight={30}
                        onRefresh={searchHighlight}
                    >
                        {#snippet header()}
                            <div class="list-header nofocus" onclick={onColumnHeaderClick} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                                {#each $appState.headerLabels as label}
                                    {#if shouldDisplayLabel(label.sortKey)}
                                        <Column {onColSliderMousedown} {label} columnHeaderChanged={onColumnHeaderChanged} />
                                    {/if}
                                {/each}
                            </div>
                        {/snippet}
                        {#snippet item(item)}
                            <div
                                id={item.id}
                                class="row selectable"
                                draggable="true"
                                class:selected={$appState.selection.selectedIds.includes(item.id)}
                                class:being-selected={$appState.selection.selectedId == item.id}
                                class:cut={$appState.copyCutTargets.ids.includes(item.id) && $appState.copyCutTargets.op == "Move"}
                                class:drag-highlight={!item.isFile && $appState.dragTargetId == item.id}
                                onmouseover={clipMouseEnter}
                                onmouseout={clipMouseLeave}
                                onfocus={() => {}}
                                onblur={() => {}}
                                onclick={onRowClick}
                                ondblclick={onSelect}
                                onkeydown={handleKeyEvent}
                                data-file-id={item.id}
                                role="button"
                                tabindex="-1"
                            >
                                {#each $appState.headerLabels as label}
                                    {#if label.sortKey == "name"}
                                        <div class="col-detail" data-file-id={item.id} style="width: {label.width}px;">
                                            <div
                                                class="entry-name draggable"
                                                title={$appState.search.searching ? item.fullPath : item.name}
                                                data-file-id={item.id}
                                                onmousedown={colDetailMouseDown}
                                                role="button"
                                                tabindex="-1"
                                            >
                                                <div
                                                    class="icon"
                                                    class:folder={item.entityType == "Folder" || item.entityType == "SymlinkFolder"}
                                                    class:hidden-folder={item.fileType == "HiddenFolder"}
                                                    data-file-id={item.id}
                                                >
                                                    {#if item.linkPath}
                                                        <div class="symlink-icon"><div class="symlink-arrow"></div></div>
                                                    {/if}
                                                    {#if item.isFile}
                                                        {#if item.fileType == "Audio"}
                                                            <AudioSvg />
                                                        {:else if item.fileType == "Video"}
                                                            <VideoSvg />
                                                        {:else if item.fileType == "Image"}
                                                            <ImageSvg />
                                                        {:else if item.fileType == "Zip"}
                                                            <Zip />
                                                        {:else if item.fileType == "App"}
                                                            <AppSvg />
                                                        {:else}
                                                            <FileSvg />
                                                        {/if}
                                                    {:else if item.fileType == "Desktop"}
                                                        <DirDesktop />
                                                    {:else if item.fileType == "Documents"}
                                                        <DirDocuments />
                                                    {:else if item.fileType == "Downloads"}
                                                        <DirDownloads />
                                                    {:else if item.fileType == "Music"}
                                                        <DirMusic />
                                                    {:else if item.fileType == "Pictures"}
                                                        <DirImage />
                                                    {:else if item.fileType == "Videos"}
                                                        <DirVideo />
                                                    {:else}
                                                        <FolderSvg />
                                                    {/if}
                                                </div>
                                                <div class="name" id={item.uuid} data-file-id={item.id} class:rename-hidden={$listState.rename.targetUUID == item.uuid}>
                                                    {item.name}
                                                </div>
                                            </div>
                                        </div>
                                    {:else if label.sortKey == "directory"}
                                        {#if $appState.search.searching && !isRecycleBin()}
                                            <div class="col-detail" data-file-id={item.id} style="width: {label.width + HEADER_DIVIDER_WIDTh}px;">
                                                <div class="draggable" title={item.dir} data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{item.dir}</div>
                                            </div>
                                        {/if}
                                    {:else if label.sortKey == "orig_path"}
                                        {#if isRecycleBin()}
                                            <div class="col-detail" data-file-id={item.id} style="width: {label.width + HEADER_DIVIDER_WIDTh}px;">
                                                <div class="draggable" title={item.originalPath} data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{item.dir}</div>
                                            </div>
                                        {/if}
                                    {:else if label.sortKey == "ddate"}
                                        {#if isRecycleBin()}
                                            <div class="col-detail" data-file-id={item.id} style="width: {label.width + HEADER_DIVIDER_WIDTh}px;">
                                                <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                                                    {new Date(item.ddate).toLocaleString("jp-JP", DATE_OPTION)}
                                                </div>
                                            </div>
                                        {/if}
                                    {:else if label.sortKey == "extension"}
                                        <div class="col-detail" data-file-id={item.id} style="width: {label.width + HEADER_DIVIDER_WIDTh}px;">
                                            <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{item.extension}</div>
                                        </div>
                                    {:else if label.sortKey == "mdate"}
                                        <div class="col-detail" data-file-id={item.id} style="width: {label.width + HEADER_DIVIDER_WIDTh}px;">
                                            <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                                                {new Date(item.mdate).toLocaleString("ja-JP", DATE_OPTION)}
                                            </div>
                                        </div>
                                    {:else if label.sortKey == "cdate"}
                                        <div class="col-detail" data-file-id={item.id} style="width: {label.width + HEADER_DIVIDER_WIDTh}px;">
                                            <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                                                {new Date(item.cdate).toLocaleString("jp-JP", DATE_OPTION)}
                                            </div>
                                        </div>
                                    {:else if label.sortKey == "size"}
                                        <div class="col-detail size" data-file-id={item.id} style="width: {label.width + HEADER_DIVIDER_WIDTh}px;">
                                            <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                                                {item.size > 0 || (item.size == 0 && item.isFile)
                                                    ? `${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, roundingPriority: "morePrecision" }).format(item.size)} KB`
                                                    : ""}
                                            </div>
                                        </div>
                                    {/if}
                                {/each}
                            </div>
                        {/snippet}
                        {#snippet empty()}{/snippet}
                    </VirtualList>
                {/if}
            </div>
        </div>
    </div>
</div>
