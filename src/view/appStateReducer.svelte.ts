import { writable } from "svelte/store";
import { load, updateFiles, reset, listState } from "../states/listState.svelte";
import { DEFAULT_LABLES, HOME, RECYCLE_BIN } from "../constants";
import { endRename, startRename } from "../states/renameState.svelte";
import { ClipPosition, endClip, moveClip, startClip } from "../states/clipState.svelte";
import { driveState, updateDrives } from "../states/driveState.svelte";
import { edit, headerState, resetSearch, startSearch } from "../states/headerState.svelte";
import { startSlide, endSlide, slideState } from "../states/slideState.svelte";
import Deferred from "../deferred";
import { path } from "../path";
export { listState } from "../states/listState.svelte";
export { renameState } from "../states/renameState.svelte";
export { clipState } from "../states/clipState.svelte";
export { driveState } from "../states/driveState.svelte";
export { headerState } from "../states/headerState.svelte";
export { slideState } from "../states/slideState.svelte";
// Linux only
type ContextMenuState = {
    deferred: Deferred<number> | null;
};
const contextMenuState: ContextMenuState = $state({ deferred: null });
export const awaitContextMenu = async () => {
    contextMenuState.deferred = new Deferred();
    await contextMenuState.deferred.promise;
};
export const resolveContextMenu = () => {
    if (contextMenuState.deferred) {
        contextMenuState.deferred.resolve(0);
        contextMenuState.deferred = null;
    }
};

export const icons: Mp.IconCache = $state({ cache: {} });

type DragHandlerType = "View" | "Column" | "Favorite";

type AppState = {
    isMaximized: boolean;
    isFullScreen: boolean;
    headerLabels: Mp.HeaderLabel[];
    sort: Mp.SortType;
    preventBlur: boolean;
    selection: Mp.ItemSelection;
    selectionAnchor: string;
    copyCutTargets: {
        op: Mp.ClipboardOperation;
        ids: string[];
        files: Mp.MediaFile[];
    };
    dragTargetId: string;
    dragHandler: DragHandlerType;
    incrementalKey: string;
    prefVisible: boolean;
    theme: Mp.Theme;
    allowMoveColumn: boolean;
    appMenuItems: Mp.AppMenuItem[];
    symlinkVisible: boolean;
    isInGridView: boolean;
    scrolling: boolean;
    useOSIcon: boolean;
    rememberColumns: boolean;
};

export const initialAppState: AppState = {
    isMaximized: false,
    isFullScreen: false,
    headerLabels: DEFAULT_LABLES,
    sort: {
        asc: true,
        key: "name",
    },
    preventBlur: false,
    selection: { selectedId: "", selectedIds: [] },
    selectionAnchor: "",
    copyCutTargets: {
        op: "None",
        ids: [],
        files: [],
    },
    dragTargetId: "",
    dragHandler: "View",
    incrementalKey: "",
    prefVisible: false,
    theme: "system",
    allowMoveColumn: true,
    appMenuItems: [],
    symlinkVisible: false,
    isInGridView: false,
    scrolling: false,
    useOSIcon: false,
    rememberColumns: true,
};

type AppAction =
    | { type: "reset" }
    | { type: "isMaximized"; value: boolean }
    | { type: "isFullScreen"; value: boolean }
    | { type: "pathEditing"; value: boolean }
    | { type: "startSearch" }
    | { type: "endSearch" }
    | { type: "headerLabels"; value: Mp.HeaderLabel[] }
    | { type: "navigated"; value: { canGoBack: boolean; canGoForward: boolean } }
    | { type: "sort"; value: Mp.SortType }
    | { type: "updateFiles"; value: { files: Mp.MediaFile[] } }
    | { type: "preventBlur"; value: boolean }
    | { type: "selectedId"; value: string }
    | { type: "setSelectedIds"; value: string[] }
    | { type: "removeSelectedIds"; value: string[] }
    | { type: "clearSelection" }
    | { type: "appendSelectedIds"; value: string[] }
    | { type: "updateSelection"; value: Mp.ItemSelection }
    | { type: "selectionAnchor"; value: string }
    | { type: "changeFavorites"; value: Mp.MediaFile[] }
    | { type: "leftWidth"; value: number }
    | { type: "startSlide"; value: { target: "Area" | Mp.SortKey; startX: number } }
    | { type: "slide"; value: number }
    | { type: "endSlide" }
    | { type: "copyCut"; value: { operation: Mp.ClipboardOperation; ids: string[]; files: Mp.MediaFile[] } }
    | { type: "clearCopyCut" }
    | { type: "dragEnter"; value: string }
    | { type: "dragLeave" }
    | { type: "startClip"; value: { position: ClipPosition; startId: string } }
    | { type: "moveClip"; value: { x: number; y: number } }
    | { type: "endClip" }
    | { type: "incremental"; value: string }
    | { type: "clearIncremental" }
    | { type: "hoverFavoriteId"; value: string }
    | { type: "drives"; value: Mp.DriveInfo[] }
    | { type: "startDrag"; value: { id: string; type: DragHandlerType } }
    | { type: "endDrag" }
    | { type: "startRename"; value: { rect: Mp.PartialRect; oldName: string; fullPath: string; uuid: string } }
    | { type: "endRename" }
    | { type: "setPreference"; value: { theme: Mp.Theme; appMenuItems: Mp.AppMenuItem[]; allowMoveColumn: boolean; useOSIcon: boolean; rememberColumns: boolean } }
    | { type: "togglePreference" }
    | { type: "toggleCreateSymlink" }
    | { type: "toggleGridView"; value: boolean }
    | { type: "scrolling"; value: boolean }
    | { type: "chunkSize"; value: number }
    | { type: "load"; value: { event: Mp.LoadEvent } };

const updater = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case "reset":
            reset();
            edit(false);
            return state;

        case "setPreference":
            return {
                ...state,
                theme: action.value.theme,
                allowMoveColumn: action.value.allowMoveColumn,
                appMenuItems: action.value.appMenuItems,
                useOSIcon: action.value.useOSIcon,
                rememberColumns: action.value.rememberColumns,
            };

        case "isMaximized":
            return { ...state, isMaximized: action.value };

        case "isFullScreen":
            return { ...state, isFullScreen: action.value };

        case "pathEditing": {
            edit(action.value);
            return state;
        }

        case "load": {
            load(action.value.event);
            edit(false);
            updateDrives(action.value.event.drives);
            resetSearch();
            if (action.value.event.navigation == "Reload") {
                return {
                    ...state,
                    copyCutTargets: { op: "Copy", ids: [], files: [] },
                    selection: {
                        selectedId: "",
                        selectedIds: [],
                    },
                };
            }

            return state;
        }

        case "updateFiles":
            updateFiles(action.value.files);
            return state;

        case "drives":
            updateDrives(action.value);
            return state;

        case "startSearch":
            startSearch();
            return state;

        case "endSearch":
            resetSearch();
            return state;

        case "incremental":
            return { ...state, incrementalKey: action.value };

        case "clearIncremental":
            return { ...state, incrementalKey: "" };

        case "headerLabels":
            return { ...state, headerLabels: action.value };

        case "navigated":
            headerState.canGoBack = action.value.canGoBack;
            headerState.canGoForward = action.value.canGoForward;
            headerState.canGoUpward = !!path.dirname(listState.currentDir.fullPath) && listState.currentDir.fullPath != HOME && listState.currentDir.fullPath != RECYCLE_BIN;
            return state;

        case "sort":
            return { ...state, sort: action.value };

        case "selectedId":
            return { ...state, selection: { ...state.selection, selectedId: action.value } };

        case "setSelectedIds":
            return { ...state, selection: { ...state.selection, selectedIds: action.value } };

        case "clearSelection":
            return { ...state, selection: { ...state.selection, selectedId: "", selectedIds: [] }, selectionAnchor: "" };

        case "appendSelectedIds":
            return { ...state, selection: { ...state.selection, selectedIds: [...state.selection.selectedIds, ...action.value] } };

        case "removeSelectedIds":
            const ids = state.selection.selectedIds.filter((id) => !action.value.includes(id));
            return { ...state, selection: { ...state.selection, selectedIds: ids } };

        case "updateSelection":
            return { ...state, selection: { ...state.selection, selectedId: action.value.selectedId, selectedIds: action.value.selectedIds } };

        case "selectionAnchor":
            return { ...state, selectionAnchor: action.value };

        case "preventBlur":
            return { ...state, preventBlur: action.value };

        case "changeFavorites":
            driveState.favorites = action.value;
            return state;

        case "leftWidth":
            driveState.leftWidth = action.value;
            return state;

        case "startSlide": {
            startSlide(state.headerLabels, action.value.target, action.value.startX);
            return state;
        }
        case "slide": {
            if (slideState.target == "Area") {
                driveState.leftWidth = slideState.initial + action.value;
                return state;
            }
            const headerLabels = structuredClone(state.headerLabels);
            const label = headerLabels.filter((label) => label.sortKey == slideState.target)[0];
            const newWidth = slideState.initial + action.value;
            if (newWidth <= 50) {
                return state;
            }
            label.width = slideState.initial + action.value;
            return { ...state, headerLabels };
        }
        case "endSlide": {
            endSlide();
            return state;
        }

        case "copyCut": {
            return { ...state, copyCutTargets: { op: action.value.operation, ids: action.value.ids, files: action.value.files } };
        }
        case "clearCopyCut": {
            return { ...state, copyCutTargets: { op: "Copy", ids: [], files: [] } };
        }

        case "dragEnter": {
            return { ...state, dragTargetId: action.value };
        }
        case "dragLeave": {
            return { ...state, dragTargetId: "" };
        }
        case "startDrag":
            return { ...state, dragTargetId: action.value.id, dragHandler: action.value.type };
        case "endDrag":
            return { ...state, dragTargetId: "", dragHandler: "View" };

        case "startClip": {
            startClip(action.value.startId, action.value.position);
            return {
                ...state,
                selection: { ...state.selection, selectedId: action.value.startId },
            };
        }
        case "moveClip": {
            moveClip(action.value.x, action.value.y);
            return state;
        }
        case "endClip": {
            endClip();
            return state;
        }

        case "hoverFavoriteId": {
            driveState.hoverFavoriteId = action.value;
            return state;
        }

        case "startRename":
            startRename(action.value.rect, action.value.oldName, action.value.fullPath, action.value.uuid);
            return state;
        case "endRename":
            endRename();
            return state;

        case "togglePreference":
            return { ...state, prefVisible: !state.prefVisible };
        case "toggleCreateSymlink":
            return { ...state, symlinkVisible: !state.symlinkVisible };
        case "toggleGridView":
            return { ...state, isInGridView: action.value };

        case "scrolling":
            return { ...state, scrolling: action.value };

        case "chunkSize":
            listState.chunkSize = action.value;
            return state;

        default:
            return state;
    }
};

const store = writable(initialAppState);

export const dispatch = (action: AppAction) => {
    store.update((state) => updater(state, action));
};

export const appState = store;
