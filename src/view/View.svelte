<script lang="ts">
    import { onMount, tick } from "svelte";
    import { appState, dispatch } from "./appStateReducer";
    import { listState } from "./listStateReducer";
    import Bar from "./Bar.svelte";
    import Header from "./Header.svelte";
    import Left from "./Left.svelte";
    import FileSvg from "../svg/FileSvg.svelte";
    import ImageSvg from "../svg/ImageSvg.svelte";
    import VideoSvg from "../svg/VideoSvg.svelte";
    import AudioSvg from "../svg/AudioSvg.svelte";
    import AppSvg from "../svg/AppSvg.svelte";
    import FolderSvg from "../svg/FolderSvg.svelte";
    import VirtualList from "./VirtualList.svelte";
    import Home from "./Home.svelte";
    import Column from "./Column.svelte";
    import { BROWSER_SHORTCUT_KEYS, DEFAULT_LABLES, DEFAULT_SORT_TYPE, HOME, OS, handleKeyEvent } from "../constants";
    import { IPC } from "../ipc";
    import main from "../main";
    import { webviewWindow } from "@tauri-apps/api";
    import util from "../util";
    import { path } from "../path";
    import Deferred from "../deferred";
    import { t } from "../translation/useTranslation";

    let fileListContainer = $state<HTMLDivElement>();
    let virtualList = $state<VirtualList<Mp.MediaFile>>();
    let searchInterval = 0;
    let visibleStartIndex = $state(0);
    let visibleEndIndex = $state(0);

    let header: Header;
    let canvas: HTMLCanvasElement;
    let folderUpdatePromise: Deferred<number> | null;
    let handleMouseEvent = false;
    // Prevent drop from other apps
    let dragging = false;
    // Linux only
    let handleKeyUp = false;

    const ipc = new IPC("View");
    const HEADER_DIVIDER_WIDTh = 10;

    const DATE_OPTION: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "numeric", second: "numeric" };
    const BACKWARD: Mp.NavigationHistory[] = [];
    const FORWARD: Mp.NavigationHistory[] = [];

    const onListContextMenu = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if ($listState.rename.renaming) return;

        if ($listState.currentDir.fullPath != HOME) {
            onRowClick(e);
            const file = $listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
            if (navigator.userAgent.includes(OS.windows)) {
                await main.openListContextMenu({ x: e.screenX, y: e.screenY }, file ? file.fullPath : "");
            } else {
                await main.openListContextMenu({ x: e.clientX, y: e.clientY }, file ? file.fullPath : "");
            }
        }
    };

    const onWindowSizeChanged = async () => {
        const isMaximized = await webviewWindow.getCurrentWebviewWindow().isMaximized();
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

    const onMouseDown = (e: MouseEvent) => {
        handleMouseEvent = shouldHandleMouseEvent(e);
        if (!handleMouseEvent) return;

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

        if ($appState.clip.clipping) {
            dispatch({ type: "moveClip", value: { x: e.clientX - fileListContainer.parentElement!.offsetLeft, y: e.clientY - fileListContainer.parentElement!.offsetTop } });
        }
    };

    const shouldHandleMouseEvent = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return false;
        if (!fileListContainer) return false;
        if ($listState.rename.renaming) return false;

        if (e.target.hasAttribute("data-path") || e.target.classList.contains("button")) return false;

        if (e.offsetX > e.target.clientWidth || e.offsetY > e.target.clientHeight) {
            return false;
        }

        const containerRect = fileListContainer.getBoundingClientRect();
        if (containerRect.x > e.clientX || containerRect.y > e.clientY) {
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
            main.onWidthChange({ leftWidth: $appState.leftWidth, labels: $appState.headerLabels });
        }

        if (!handleMouseEvent) return;

        if (!$appState.clip.moved && e.target.id == "list") {
            clearSelection();
        }

        endClip();
    };

    const startDrag = async (e: DragEvent) => {
        e.preventDefault();

        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (!$appState.selection.selectedIds.length) return;
        if ($appState.clip.moved) return;

        const id = e.target.getAttribute("data-file-id") ?? "";
        if (!$appState.selection.selectedIds.includes(id)) return;

        const paths = $listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id)).map((file) => file.fullPath);
        if (!paths.length) return;

        await ipc.invoke("register_drop_target", undefined);
        dragging = true;
        await main.startDrag(paths);
    };

    const onDragEnter = (e: DragEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        const id = e.target.getAttribute("data-file-id") ?? "";

        if (id) {
            dispatch({ type: "dragEnter", value: id });
        } else {
            dispatch({ type: "dragLeave" });
        }
    };

    const onItemDrop = async (e: DragEvent) => {
        e.preventDefault();
        dispatch({ type: "dragLeave" });

        if (!dragging) return;

        dragging = false;

        if (!e.target || !(e.target instanceof HTMLElement)) return;

        const id = e.target.getAttribute("data-file-id");
        if (!id) return;

        const destinationFile = $listState.files.find((file) => file.id == id);
        if (!destinationFile) return;

        if (destinationFile.isFile) return;

        if ($appState.selection.selectedIds.includes(destinationFile.id)) return;

        const files = $listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));

        if (!files.length) return;

        const fullPaths = files.map((file) => file.fullPath);

        await moveItems(fullPaths, destinationFile.fullPath, false);
    };

    const startClip = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (!fileListContainer) return;

        const id = e.target.getAttribute("data-file-id") ?? "";

        if ($appState.selection.selectedIds.includes(id)) return;

        if (e.button != 2) {
            dispatch({
                type: "startClip",
                value: { position: { startX: e.clientX - fileListContainer.parentElement!.offsetLeft, startY: e.clientY - fileListContainer.parentElement!.offsetTop }, startId: id },
            });
        }
    };

    const clipMouseEnter = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (!$appState.clip.clipping) return;

        const id = e.target.getAttribute("data-file-id");

        if (id && !$appState.selection.selectedIds.includes(id)) {
            dispatch({ type: "appendSelectedIds", value: [id] });
        }
    };

    const clipMouseLeave = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (!e.relatedTarget || !(e.relatedTarget instanceof HTMLElement)) return;
        if (!$appState.clip.clipping) return;

        if (e.relatedTarget.classList.contains("nofocus")) return;

        const id = e.target.getAttribute("data-file-id");
        const enterId = e.relatedTarget.getAttribute("data-file-id");

        if (id == enterId) return;

        if ($appState.selection.selectedId == id) {
            dispatch({ type: "setSelectedIds", value: [id] });
        }

        if (id && !enterId && !$appState.clip.startId) {
            dispatch({ type: "removeSelectedIds", value: [id] });
            return;
        }

        if (enterId && $appState.selection.selectedIds.includes(enterId)) {
            const ids = $appState.selection.selectedIds.filter((sid) => sid != id);
            dispatch({ type: "setSelectedIds", value: ids });
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
            load(result);
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
        const result = await main.search({ dir: $listState.currentDir.fullPath, key: $appState.search.key, refresh: false });
        dispatch({ type: "clearCopyCut" });
        dispatch({ type: "startSearch" });

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
            const nameNode = node.childNodes[0].childNodes[0].childNodes[0].childNodes[2];
            const text = nameNode.textContent;

            if (text) {
                const start = text.toLocaleLowerCase().indexOf($appState.search.key.toLocaleLowerCase());
                const end = $appState.search.key.length;

                const range = new Range();
                range.setStart(nameNode.childNodes[0], start);
                range.setEnd(nameNode.childNodes[0], start + end);
                searchTextHighlight.add(range);
            }
        });

        CSS.highlights.set("searched", searchTextHighlight);
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
            requestLoad(file.fullPath, file.isFile, "Direct");
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
        await webviewWindow.getCurrentWebviewWindow().setTitle(title);
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

        dispatch({ type: "history", value: { canGoBack: BACKWARD.length > 0, canGoForward: FORWARD.length > 0 } });
        dispatch({ type: "sort", value: e.sortType });
        dispatch({ type: "load", value: { event: e } });

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

            case "Delete": {
                await trashItem();
                break;
            }

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
                await main.openConfigFileJson();
                break;

            case "RemoveFromFavorite":
                sendRemovingFavorite();
                break;

            case "Refresh":
                const result = await util.getDriveInfo();
                dispatch({ type: "drives", value: result });
                break;

            case "Terminal":
                await main.openTerminal($listState.currentDir.fullPath);
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
                    requestLoad(file.fullPath, file.isFile, "Direct");
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

    const onDeviceEvent = async (e: Mp.DeviceEvent) => {
        if (!e.name.includes("Disk") || !e.name.includes("Storage")) return;

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
        const e = await main.onMainReady();

        window.lang = e.locale;
        const headerLabels: Mp.HeaderLabels = DEFAULT_LABLES;
        Object.entries(e.settings.headerLabels).forEach((entry) => {
            const header = entry[1];
            let label = "";
            switch (header.sortKey) {
                case "cdate":
                    label = t("colCreated");
                    break;
                case "directory":
                    label = t("colDirectory");
                    break;
                case "extension":
                    label = t("colExtension");
                    break;
                case "mdate":
                    label = t("colModified");
                    break;
                case "name":
                    label = t("colName");
                    break;
                case "size":
                    label = t("colSize");
                    break;
            }
            header.label = label;
            headerLabels[header.sortKey] = header;
        });
        dispatch({ type: "headerLabels", value: headerLabels });
        dispatch({ type: "leftWidth", value: e.settings.leftAreaWidth });
        dispatch({ type: "sort", value: DEFAULT_SORT_TYPE });
        dispatch({ type: "changeFavorites", value: e.settings.favorites });
        await init(e.data);
        await tick();
        if (e.selectId) {
            await select(e.selectId);
        }
        const webview = webviewWindow.getCurrentWebviewWindow();
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

        return () => {
            ipc.release();
        };
    });
</script>

<svelte:window oncontextmenu={(e) => e.preventDefault()} />
<svelte:document {onkeydown} {onkeyup} onmousemove={onMouseMove} onmousedown={onMouseDown} onmouseup={onMouseUp} ondragover={(e) => e.preventDefault()} ondragenter={onDragEnter} />

<div class="viewport" class:full-screen={$appState.isFullScreen} class:sliding={$appState.slideState.sliding}>
    <Bar />
    <div class="view">
        <Header {requestLoad} {startSearch} {endSearch} {goBack} {goForward} {createItem} {reload} bind:this={header} />
        <div class="body" ondragover={(e) => e.preventDefault()} ondrop={onItemDrop} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <Left {requestLoad} />
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
                    <div class="clip-area" style={$appState.clip.clipAreaStyle}></div>
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
                {:else}
                    <VirtualList
                        id="list"
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
                                {#if $appState.search.searching}
                                    {#each Object.values($appState.headerLabels) as label}
                                        <Column {onColSliderMousedown} {label} />
                                    {/each}
                                {:else}
                                    {#each Object.values($appState.headerLabels) as label}
                                        {#if label.sortKey != "directory"}
                                            <Column {onColSliderMousedown} {label} />
                                        {/if}
                                    {/each}
                                {/if}
                            </div>
                        {/snippet}
                        {#snippet item(item)}
                            <div
                                id={item.id}
                                class="row"
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
                                <div class="col-detail" data-file-id={item.id} style="width: {$appState.headerLabels.name.width}px;">
                                    <div
                                        class="entry-name draggable"
                                        title={$appState.search.searching ? item.fullPath : item.name}
                                        data-file-id={item.id}
                                        onmousedown={colDetailMouseDown}
                                        role="button"
                                        tabindex="-1"
                                    >
                                        <div class="icon" data-file-id={item.id}>
                                            {#if item.isFile}
                                                {#if item.fileType == "Audio"}
                                                    <AudioSvg />
                                                {:else if item.fileType == "Video"}
                                                    <VideoSvg />
                                                {:else if item.fileType == "Image"}
                                                    <ImageSvg />
                                                {:else if item.fileType == "App"}
                                                    <AppSvg />
                                                {:else}
                                                    <FileSvg />
                                                {/if}
                                            {:else}
                                                <FolderSvg />
                                            {/if}
                                        </div>
                                        <div class="name" id={item.uuid} data-file-id={item.id} class:rename-hidden={$listState.rename.targetUUID == item.uuid}>
                                            {item.name}
                                        </div>
                                    </div>
                                </div>
                                {#if $appState.search.searching}
                                    <div class="col-detail" data-file-id={item.id} style="width: {$appState.headerLabels.directory.width + HEADER_DIVIDER_WIDTh}px;">
                                        <div class="draggable" title={item.dir} data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{item.dir}</div>
                                    </div>
                                {/if}
                                <div class="col-detail" data-file-id={item.id} style="width: {$appState.headerLabels.extension.width + HEADER_DIVIDER_WIDTh}px;">
                                    <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">{item.extension}</div>
                                </div>
                                <div class="col-detail" data-file-id={item.id} style="width: {$appState.headerLabels.mdate.width + HEADER_DIVIDER_WIDTh}px;">
                                    <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                                        {new Date(item.mdate).toLocaleString("ja-JP", DATE_OPTION)}
                                    </div>
                                </div>
                                <div class="col-detail" data-file-id={item.id} style="width: {$appState.headerLabels.cdate.width + HEADER_DIVIDER_WIDTh}px;">
                                    <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                                        {new Date(item.cdate).toLocaleString("jp-JP", DATE_OPTION)}
                                    </div>
                                </div>
                                <div class="col-detail size" data-file-id={item.id} style="width: {$appState.headerLabels.size.width + HEADER_DIVIDER_WIDTh}px;">
                                    <div class="draggable" data-file-id={item.id} onmousedown={colDetailMouseDown} role="button" tabindex="-1">
                                        {item.size > 0 || (item.size == 0 && item.isFile)
                                            ? `${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, roundingPriority: "morePrecision" }).format(item.size)} KB`
                                            : ""}
                                    </div>
                                </div>
                            </div>
                        {/snippet}
                        {#snippet empty()}{/snippet}
                    </VirtualList>
                {/if}
            </div>
        </div>
    </div>
</div>
