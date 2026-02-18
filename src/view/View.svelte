<script lang="ts">
    import { onMount, tick } from "svelte";
    import { appState, dispatch, renameState, listState, slideState, clipState, driveState, headerState, awaitContextMenu, resolveContextMenu, columnState } from "./appStateReducer.svelte";
    import TopBar from "./TopBar.svelte";
    import BottomBar from "./BottomBar.svelte";
    import Header from "./Header.svelte";
    import Left from "./Left.svelte";
    import Preference from "./Preference.svelte";
    import Symlink from "./Symlink.svelte";
    import VirtualList from "./VirtualList.svelte";
    import Home from "./Home.svelte";
    import GridView from "./GridView.svelte";
    import ListView from "./ListView.svelte";
    import Rename from "./Rename.svelte";

    import { BROWSER_SHORTCUT_KEYS, COLUMN_HEADER_HEIGHT, DEFAULT_SORT_TYPE, GRID_VERTICAL_MARGIN, HOME, OS, RECYCLE_BIN, handleKeyEvent } from "../constants";
    import { IPC } from "../ipc";
    import main from "../main";
    import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
    import util from "../util";
    import { path } from "../path";
    import Deferred from "../deferred";

    let fileListContainer = $state<HTMLDivElement>();
    let clipRegion = $state<DOMRectReadOnly>();
    let virtualList = $state<VirtualList<Mp.MediaFile> | VirtualList<Mp.MediaFile[]>>();
    let searchInterval = 0;
    let visibleStartIndex = $state(0);
    let visibleEndIndex = $state(0);
    let header: Header;
    let folderUpdatePromise: Deferred<number> | null;
    // Linux only
    let handleKeyUp = false;

    const ipc = new IPC("View");
    const BACKWARD: Mp.NavigationHistory[] = [];
    const FORWARD: Mp.NavigationHistory[] = [];

    const showErrorMessage = async (message: string) => {
        await main.showErrorMessage(message);
    };

    const onListContextMenu = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (renameState.renaming) return;

        if (listState.currentDir.fullPath != HOME) {
            onRowClick(e);
            const file = listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
            let itemPath = "";
            if (file) {
                itemPath = file.linkPath ? file.linkPath : file.fullPath;
            }
            if (navigator.userAgent.includes(OS.windows)) {
                await main.openListContextMenu({ x: e.screenX, y: e.screenY }, itemPath, e.shiftKey, isRecycleBin());
            } else {
                await awaitContextMenu();
                await main.openListContextMenu({ x: e.clientX, y: e.clientY }, itemPath, e.shiftKey, isRecycleBin());
            }
        }
    };

    const onFavoriteContextMenu = async (e: MouseEvent) => {
        if (navigator.userAgent.includes(OS.windows)) {
            await main.openFavContextMenu({ x: e.screenX, y: e.screenY });
        } else {
            await awaitContextMenu();
            await main.openFavContextMenu({ x: e.clientX, y: e.clientY });
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

    const clearSelection = () => {
        dispatch({ type: "clearSelection" });
    };

    const getChildIndex = (id: string | null | undefined) => {
        return listState.files.findIndex((file) => file.id == id);
    };

    const onScroll = async () => {
        await endEditFileName();
    };

    const scrollToElement = async (id: string) => {
        if (!fileListContainer || !virtualList) return;

        await tick();
        const element = document.getElementById(id);

        // If not rendered
        if (!element) {
            const index = listState.files.findIndex((file) => file.id == id);
            if (index <= visibleStartIndex) {
                await virtualList.scrollToIndex(index, { behavior: "instant" }, false);
            } else {
                await virtualList.scrollToIndex(index, { behavior: "instant" }, true);
            }
            return;
        }

        const rect = element.getBoundingClientRect();
        const containerRect = fileListContainer.getBoundingClientRect();

        const containerTop = $appState.isInGridView ? containerRect.top + GRID_VERTICAL_MARGIN : containerRect.top + COLUMN_HEADER_HEIGHT;
        const scrollHeight = fileListContainer.offsetHeight - fileListContainer.clientHeight;
        const containerBottom = containerRect.bottom - scrollHeight;

        if (rect.top <= containerTop) {
            fileListContainer.scrollBy(0, rect.top - containerTop);
        }

        if (rect.bottom > containerBottom) {
            fileListContainer.scrollBy(0, rect.bottom - containerBottom);
        }
    };

    const shouldHandleMouseEvent = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return false;
        if ($appState.scrolling) {
            dispatch({ type: "scrolling", value: false });
            return false;
        }

        if (!fileListContainer) return false;
        if (renameState.renaming) return false;
        if ($appState.dragHandler != "View") return false;

        /* Clipping must handle event outside of view */
        if (clipState.clipping) return true;

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

        if (slideState.sliding) {
            const dist = e.clientX - slideState.startX;
            dispatch({ type: "slide", value: dist });
            return;
        }

        if (!fileListContainer) return;

        const alredyMoved = clipState.moved;
        if (clipState.clipping) {
            dispatch({ type: "moveClip", value: { x: e.clientX - fileListContainer.parentElement!.offsetLeft, y: e.clientY - fileListContainer.parentElement!.offsetTop } });
            if (!alredyMoved && clipState.moved) {
                clearSelection();
            }
        }
    };

    const onMouseUp = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;

        resolveContextMenu();

        if (slideState.sliding) {
            const dist = e.clientX - slideState.startX;
            dispatch({ type: "slide", value: dist });
            dispatch({ type: "endSlide" });
            onColumnHeaderChanged();
        }

        if (!shouldHandleMouseEvent(e)) return;

        if (!clipState.moved && e.target.hasAttribute("data-v-list")) {
            clearSelection();
        }

        endClip();
    };

    const onColumnHeaderClick = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (slideState.sliding) return;

        if (e.button != 2) {
            const key = (e.target.getAttribute("data-sort-key") as Mp.SortKey) ?? "name";

            const asc = $appState.sort.key == key ? !$appState.sort.asc : true;
            const type: Mp.SortType = {
                key,
                asc,
            };
            dispatch({ type: "sort", value: type });
            const result = main.sort({ files: listState.files, type });
            onSorted(result);
        }
    };

    const onRowClick = async (e: MouseEvent) => {
        await toggleSelect(e);
    };

    const onColumnHeaderChanged = () => {
        main.onColumnHeaderChanged({ leftWidth: driveState.leftWidth, labels: columnState.columnLabels });
    };

    const startDrag = async (e: DragEvent) => {
        e.preventDefault();

        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (!$appState.selection.selectedIds.length) return;
        if (clipState.moved) return;
        if ($appState.dragHandler != "View") return;

        const id = e.target.getAttribute("data-file-id") ?? "";
        if (!$appState.selection.selectedIds.includes(id)) return;

        const paths = listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id)).map((file) => file.fullPath);
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

        if (listState.currentDir.fullPath == HOME || !e.paths) return;

        const destPath = getDropTarget(dragTargetId);

        const sourcePaths = e.paths;

        if (destPath == path.dirname(sourcePaths[0]) || sourcePaths.includes(destPath)) return;

        const shouldCopy = util.getRootDirectory(destPath) != util.getRootDirectory(sourcePaths[0]);

        await moveItems(sourcePaths, destPath, shouldCopy);
    };

    const getDropTarget = (dragTargetId: string): string => {
        const defaultTarget = listState.currentDir.fullPath;

        if (!dragTargetId) return defaultTarget;

        const destinationFile = listState.files.find((file) => file.id == dragTargetId);

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
        const inverseX = clipState.inverseX;
        const inverseY = clipState.inverseY;
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
        if (!clipState.clipping) return;

        const clipRect = getClipRect(e);

        const selected: string[] = [];
        document.querySelectorAll(".selectable").forEach((e) => {
            const id = e.getAttribute("data-file-id");
            if (!id) return;
            const itemRect = getItemRect(e as HTMLElement);
            if (isRectInRect(clipRect, itemRect) && !$appState.selection.selectedIds.includes(id)) {
                selected.push(id);
            }
        });

        if (selected.length) {
            dispatch({ type: "appendSelectedIds", value: selected });
        }
    };

    const clipMouseLeave = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (!clipState.clipping) return;

        const clipRect = getClipRect(e);

        const unselected: string[] = [];
        document.querySelectorAll(".selectable").forEach((e) => {
            const id = e.getAttribute("data-file-id");
            if (!id) return;
            const itemRect = getItemRect(e as HTMLElement);
            if (!isRectInRect(clipRect, itemRect) && $appState.selection.selectedIds.includes(id)) {
                unselected.push(id);
            }
        });

        if (unselected.length) {
            dispatch({ type: "removeSelectedIds", value: unselected });
        }
    };

    const endClip = () => {
        if (clipState.clipping) {
            dispatch({ type: "endClip" });
        }
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
        const range = [];

        if ($appState.selection.selectedId) {
            if (!$appState.selectionAnchor) {
                dispatch({ type: "selectionAnchor", value: $appState.selection.selectedId });
            }
            range.push(getChildIndex($appState.selectionAnchor));
        } else {
            range.push(0);
        }

        range.push(getChildIndex(id));

        range.sort((a, b) => a - b);

        const ids: string[] = [];
        for (let i = range[0]; i <= range[1]; i++) {
            ids.push(listState.files[i].id);
        }

        dispatch({ type: "updateSelection", value: { selectedId: id, selectedIds: ids } });
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

        const ids = listState.files.map((file) => file.id);

        dispatch({ type: "appendSelectedIds", value: ids });
    };

    const moveSelectionByShit = async (key: string) => {
        if (!$appState.selection.selectedIds.length) {
            await select(listState.files[0].id);
        }

        const downward = $appState.selectionAnchor == $appState.selection.selectedIds[0];
        const currentId = downward ? $appState.selection.selectedIds[$appState.selection.selectedIds.length - 1] : $appState.selection.selectedIds[0];
        const currentIndex = getChildIndex(currentId);
        const nextId = getNextItemId(key, currentIndex);

        if (!nextId) return;

        return selectByShift(nextId);
    };

    const moveSelection = async (e: KeyboardEvent) => {
        if (!listState.files.length) return;

        if (e.shiftKey) {
            return await moveSelectionByShit(e.key);
        }

        const currentId = $appState.selection.selectedId ? $appState.selection.selectedId : listState.files[0].id;
        const currentIndex = getChildIndex(currentId);
        const nextId = getNextItemId(e.key, currentIndex);

        if (!nextId) return;

        clearSelection();
        await select(nextId);
    };

    const getNextItemId = (key: string, currentIndex: number) => {
        if (!$appState.isInGridView) {
            return key === "ArrowDown" ? listState.files[currentIndex + 1]?.id : listState.files[currentIndex - 1]?.id;
        }

        if (key == "ArrowLeft" || key == "ArrowRight") {
            return key === "ArrowRight" ? listState.files[currentIndex + 1]?.id : listState.files[currentIndex - 1]?.id;
        }

        return key === "ArrowDown" ? listState.files[currentIndex + listState.chunkSize]?.id : listState.files[currentIndex - listState.chunkSize]?.id;
    };

    const selectUpto = async (e: KeyboardEvent) => {
        if (!listState.files.length) return;
        if (e.key == "Home") {
            await select(listState.files[0].id);
        } else {
            await select(listState.files[listState.files.length - 1].id);
        }
    };

    const moveSelectionUpto = async (e: KeyboardEvent) => {
        if (!listState.files.length) return;

        e.preventDefault();

        const targetId = e.key === HOME ? listState.files[0].id : listState.files[listState.files.length - 1].id;

        if (!targetId) return;

        selectByShift(targetId);
        await scrollToElement(targetId);
    };

    const startEditFileName = () => {
        if (isRecycleBin()) return;

        const file = listState.files.find((file) => file.id == $appState.selection.selectedId);

        if (!file) return;

        const selectedElement = document.getElementById(file.uuid);

        if (!selectedElement) return;

        const rect = selectedElement.getBoundingClientRect();

        const partialRect = {
            top: $appState.isInGridView ? rect.top : rect.top - 2,
            left: $appState.isInGridView ? rect.left - 4 : rect.left - 2,
            width: $appState.isInGridView ? rect.width + 8 : rect.width,
            height: rect.height,
        };

        dispatch({
            type: "startRename",
            value: {
                rect: partialRect,
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

    const endEditFileName = async () => {
        if (!renameState.renaming) return;

        if (renameState.oldName === renameState.newName) {
            endRename();
        } else {
            await requestRename();
        }
    };

    const requestRename = async () => {
        dispatch({ type: "preventBlur", value: true });
        folderUpdatePromise = new Deferred();
        const result = await main.renameItem(renameState.fullPath, renameState.newName);

        if (!result.done) {
            endRename();
            folderUpdatePromise = null;
            const files = listState.files.filter((file) => file.fullPath == renameState.fullPath);
            select(files[0].id);
            return;
        }

        await safePromise();
        endRename();
        select(result.newId);
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
        const files = listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));
        await main.trashItems({ files });
    };

    const deleteItem = async () => {
        if (!$appState.selection.selectedIds.length) return;

        const files = listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));
        await main.deleteItems({ files });
    };

    const undeleteItem = async () => {
        if (!$appState.selection.selectedIds.length) return;
        const files = listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));
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
        const files = listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));
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
            ? listState.files
                  .filter((file) => $appState.selection.selectedIds.includes(file.id))
                  .map((file) => file.fullPath)
                  .join("\r\n")
            : listState.currentDir.fullPath;
        await main.writeFullpathToClipboard(fullPaths);
    };

    const markCopyCut = async (copy: boolean) => {
        const files = listState.files.filter((file) => $appState.selection.selectedIds.includes(file.id));
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
        const ids = listState.files.filter((file) => e.fullPaths.includes(file.fullPath)).map((file) => file.id);
        await selectMultiple(ids);
    };

    const sendRemovingFavorite = () => {
        if (driveState.hoverFavoriteId) {
            const result = main.removeFavorite(driveState.hoverFavoriteId);
            onFavoriteChanged(result);
            dispatch({ type: "hoverFavoriteId", value: "" });
        }
    };

    const reload = async (includeDrive: boolean) => {
        if (headerState.search.searching) {
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
            const current = listState.files.findIndex((file) => file.id == selectedId);
            const indexes: number[] = [];
            listState.files.forEach((file, index) => {
                if (file.name.toLowerCase().startsWith(key) && file.id != selectedId) {
                    indexes.push(index);
                }
            });

            if (!indexes.length) {
                return null;
            }

            const next = indexes.filter((i) => i > current);
            if (next.length) {
                return listState.files[next[0]];
            } else {
                return listState.files[indexes[0]];
            }
        } else {
            return listState.files.find((file) => file.name.toLowerCase().startsWith(key));
        }
    };

    const startSearch = async () => {
        dispatch({ type: "clearCopyCut" });
        dispatch({ type: "startSearch" });
        const result = await main.search({ dir: listState.currentDir.fullPath, key: headerState.search.key, refresh: false });
        await onSearched(result);
    };

    const onSearched = async (e: Mp.SearchResult) => {
        dispatch({ type: "updateFiles", value: { files: e.files } });
        await tick();
    };

    const clearSearchHighlight = () => {
        CSS.highlights.clear();
    };

    const endSearch = async (reload: boolean) => {
        clearSearchHighlight();

        if (reload) {
            await main.onSearchEnd();
            const result = await main.search({ dir: listState.currentDir.fullPath, key: headerState.search.key, refresh: false });
            await onSearched(result);
        } else {
            dispatch({ type: "endSearch" });
            const result = await main.onSearchEnd();
            await onSearched(result);
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
                file = listState.files.find((file) => file.name.toLowerCase().startsWith(incrementalKey));
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
        if (!headerState.search.key || !listState.files.length) {
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
        const start = text.toLocaleLowerCase().indexOf(headerState.search.key.toLocaleLowerCase());
        const end = headerState.search.key.length;

        const range = new Range();
        range.setStart(nameNode.childNodes[0], start);
        range.setEnd(nameNode.childNodes[0], start + end);
        searchTextHighlight.add(range);
    };

    const highlightNameOneByOne = (text: string, nameNode: Element, searchTextHighlight: Highlight) => {
        const texts = text.toLocaleLowerCase().split("");
        const keys = headerState.search.key.toLocaleLowerCase().split("");

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
        main.changeFavorites(driveState.favorites);
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

        const file = listState.files.find((file) => file.id == id);

        if (file) {
            requestLoad(file.linkPath ? file.linkPath : file.fullPath, file.isFile, "Direct");
        } else {
            dispatch({ type: "reset" });
        }
    };

    const goBack = () => {
        if (!headerState.canGoBack) return;

        const navigationHistory = BACKWARD[BACKWARD.length - 1];
        requestLoad(navigationHistory.fullPath, false, "Back");
    };

    const goForward = () => {
        if (!headerState.canGoForward) return;

        const navigationHistory = FORWARD[FORWARD.length - 1];
        requestLoad(navigationHistory.fullPath, false, "Forward");
    };

    const goUpward = () => {
        if (!headerState.canGoUpward) return;

        const parent = path.dirname(listState.currentDir.fullPath);
        requestLoad(parent, false, "PathSelect");
    };

    const requestLoad = async (fullPath: string, isFile: boolean, navigation: Mp.Navigation) => {
        if (!isFile && headerState.search.searching) {
            dispatch({ type: "endSearch" });
            if (fullPath == listState.currentDir.fullPath) {
                const result = await main.onSearchEnd();
                dispatch({ type: "updateFiles", value: { files: result.files } });
            } else {
                dispatch({ type: "updateFiles", value: { files: [] } });
            }
            await tick();
        }

        if (fullPath != listState.currentDir.fullPath) {
            const result = await main.onSelect({ fullPath, isFile, navigation });
            if (result) {
                dispatch({ type: "calculateColumnWidths", value: result.files });
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
        const title = listState.currentDir.paths.length ? listState.currentDir.paths[listState.currentDir.paths.length - 1] : HOME;
        await WebviewWindow.getCurrent().setTitle(title);
    };

    const isRecycleBin = () => listState.currentDir.fullPath == RECYCLE_BIN;

    const navigate = (e: Mp.LoadEvent) => {
        if (e.navigation == "Reload") {
            dispatch({ type: "load", value: { event: e } });
            return false;
        }

        if (e.navigation == "Back") {
            FORWARD.push({ fullPath: listState.currentDir.fullPath, selection: $appState.selection });
            const navigationHistory = BACKWARD.pop();
            restoreSelection(navigationHistory);
        }

        if (e.navigation == "Forward") {
            BACKWARD.push({ fullPath: listState.currentDir.fullPath, selection: $appState.selection });
            const navigationHistory = FORWARD.pop();
            restoreSelection(navigationHistory);
        }

        if (e.navigation == "Direct" || e.navigation == "PathSelect") {
            dispatch({ type: "endSearch" });
            FORWARD.pop();
            BACKWARD.push({ fullPath: listState.currentDir.fullPath, selection: $appState.selection });

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
        dispatch({ type: "columnLabels", value: e.headers });
        dispatch({ type: "sort", value: e.sortType });
        dispatch({ type: "load", value: { event: e } });
        dispatch({ type: "navigated", value: { canGoBack: BACKWARD.length > 0, canGoForward: FORWARD.length > 0 } });

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
                const file = listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
                if (!file) return;
                const result = await main.onSelect({ fullPath: file.fullPath, isFile: file.isFile, navigation: "Direct" });
                if (result) {
                    load(result);
                }
                break;
            }

            case "OpenInNewWindow": {
                const file = listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
                if (!file) return;
                await main.openInNewWindow(file.fullPath);
                break;
            }

            case "SelectApp": {
                const file = listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
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
                if (driveState.hoverFavoriteId) {
                    await main.openPropertyDielog(driveState.hoverFavoriteId);
                    dispatch({ type: "hoverFavoriteId", value: "" });
                    break;
                }

                const file = listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
                await main.openPropertyDielog(file ?? util.toFolder(listState.currentDir.fullPath));

                break;
            }

            case "AddToFavorite": {
                const file = listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
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
                await main.openTerminal(listState.currentDir.fullPath, false);
                break;

            case "AdminTerminal":
                await main.openTerminal(listState.currentDir.fullPath, true);
                break;

            default: {
                const file = listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
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

        if (e.key == "Escape") {
            if (renameState.renaming) {
                endEditFileName();
            }
        }

        if (renameState.renaming) return;
        if (headerState.pathEditing) return;
        if ($appState.prefVisible) return;
        if ($appState.symlinkVisible) return;
        if (header.hasSearchInputFocus()) return;

        if (e.ctrlKey && e.key == "f") {
            e.preventDefault();
            header.focusSearchInput();
            return;
        }

        if (e.ctrlKey && e.key == "e") {
            await main.launchNew();
            return;
        }

        if (e.key == "Enter") {
            if ($appState.selection.selectedIds.length == 1) {
                const file = listState.files.find((file) => file.id == $appState.selection.selectedIds[0]);
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
            if (listState.currentDir.fullPath != HOME && !isRecycleBin()) {
                e.preventDefault();
                return dispatch({ type: "toggleGridView", value: !$appState.isInGridView });
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

        if (e.altKey && e.key == "ArrowLeft") {
            e.preventDefault();
            goBack();
            return;
        }

        if (e.altKey && e.key == "ArrowRight") {
            e.preventDefault();
            goForward();
            return;
        }

        if (e.altKey && e.key == "ArrowUp") {
            e.preventDefault();
            goUpward();
            return;
        }

        if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            return await moveSelection(e);
        }

        if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            if (e.shiftKey) {
                return await moveSelectionUpto(e);
            } else {
                return await selectUpto(e);
            }
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
            if (e.key.length == 1 && listState.files.length) {
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
        await main.onPreferenceChanged({
            theme: $appState.theme,
            appMenuItems: $appState.appMenuItems,
            allowMoveColumn: $appState.allowMoveColumn,
            useOSIcon: $appState.useOSIcon,
            rememberColumns: $appState.rememberColumns,
        });
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

    const minimize = async () => {
        await WebviewWindow.getCurrent().minimize();
    };

    const toggleMaximize = async () => {
        await main.toggleMaximize(WebviewWindow.getCurrent());
        dispatch({ type: "isMaximized", value: !$appState.isMaximized });
    };

    const launchNew = async () => {
        await main.launchNew();
    };

    const close = async () => {
        await main.closeWindow(WebviewWindow.getCurrent());
    };

    const onDeviceEvent = async (e: Mp.DeviceEvent) => {
        if (!e.name.includes("Disk") && !e.name.includes("Storage")) return;

        const drives = await util.getDriveInfo();

        if (e.event == "Removed") {
            const newMountPoints = drives.map((info) => info.path);
            const removedMountPoints = driveState.drives.filter((info) => !newMountPoints.includes(info.path)).map((info) => info.path);
            const currentDirRoot = util.getRootDirectory(listState.currentDir.fullPath);

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

            dispatch({ type: "navigated", value: { canGoBack: BACKWARD.length > 0, canGoForward: FORWARD.length > 0 } });
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
        dispatch({
            type: "setPreference",
            value: {
                theme: e.settings.theme,
                appMenuItems: e.settings.appMenuItems,
                allowMoveColumn: e.settings.allowMoveColumn,
                useOSIcon: e.settings.useOSIcon,
                rememberColumns: e.settings.rememberColumns,
            },
        });
        dispatch({ type: "columnLabels", value: e.settings.columnLabels });
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
        if (e.restorePosition) {
            await webview.setPosition(util.toPhysicalPosition(e.settings.bounds));
        }
        await webview.show();
    };

    onMount(() => {
        prepare();
        ipc.receiveTauri("tauri://resize", onWindowSizeChanged);
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

<div class="viewport" class:sliding={slideState.sliding}>
    <TopBar {minimize} {toggleMaximize} {launchNew} {close} />
    <div class="view">
        {#if $appState.prefVisible}
            <Preference preferenceChanged={onPreferenceChange} {openSettingsAsJson} {clearHeaderHistory} />
        {/if}
        {#if $appState.symlinkVisible}
            <Symlink {showErrorMessage} {getSymlinkTargetItem} {createSymlink} />
        {/if}
        {#if renameState.renaming}
            <Rename {endEditFileName} />
        {/if}
        <Header {requestLoad} {startSearch} {endSearch} {goBack} {goForward} {goUpward} {createItem} {reload} bind:this={header} />
        <div id="viewContent" class="body" ondragover={onDragOver} onkeydown={handleKeyEvent} role="button" tabindex="-1">
            <Left {requestLoad} {changeFavorites} {onFavoriteContextMenu} />
            <div class="area-divider" onmousedown={onAreaSliderMousedown} onkeydown={handleKeyEvent} role="button" tabindex="-1">
                <div class="line"></div>
            </div>
            <div
                class="main"
                class:clipping={clipState.clipping}
                oncontextmenu={onListContextMenu}
                onkeydown={handleKeyEvent}
                onscroll={endEditFileName}
                ondragstart={startDrag}
                role="button"
                tabindex="-1"
            >
                {#if clipState.moved}
                    <div bind:contentRect={clipRegion} class="clip-area" style={clipState.clipAreaStyle}></div>
                {/if}

                {#if listState.currentDir.fullPath == HOME}
                    <Home {requestLoad} />
                {:else if $appState.isInGridView}
                    <GridView
                        {visibleStartIndex}
                        {visibleEndIndex}
                        bind:fileListContainer
                        bind:virtualList
                        {searchHighlight}
                        {clipMouseEnter}
                        {clipMouseLeave}
                        {onRowClick}
                        {onSelect}
                        {colDetailMouseDown}
                        {onScroll}
                    />
                {:else}
                    <ListView
                        {visibleStartIndex}
                        {visibleEndIndex}
                        bind:fileListContainer
                        bind:virtualList
                        {searchHighlight}
                        {clipMouseEnter}
                        {clipMouseLeave}
                        {onRowClick}
                        {onSelect}
                        {onColumnHeaderClick}
                        {colDetailMouseDown}
                        columnHeaderChanged={onColumnHeaderChanged}
                        {onScroll}
                    />
                {/if}
            </div>
        </div>
    </div>
    <BottomBar clientWidth={fileListContainer?.clientWidth} />
</div>
