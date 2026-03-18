import { writable } from "svelte/store";
import Deferred from "../deferred";
import path from "../path";
import { HOME, RECYCLE_BIN } from "../constants";
import { ListUpdater, listState } from "../states/listState.svelte";
import { RenameUpdater } from "../states/renameState.svelte";
import { ClipUpdater } from "../states/clipState.svelte";
import { driveState, DriveUpdater } from "../states/driveState.svelte";
import { headerState, HeaderUpdater } from "../states/headerState.svelte";
import { SlidUpdater, slideState } from "../states/slideState.svelte";
import { settings, SettingsUpdater } from "../states/settingsState.svelte";
export { listState } from "../states/listState.svelte";
export { renameState } from "../states/renameState.svelte";
export { clipState } from "../states/clipState.svelte";
export { driveState } from "../states/driveState.svelte";
export { headerState } from "../states/headerState.svelte";
export { slideState } from "../states/slideState.svelte";
export { settings } from "../states/settingsState.svelte";
export const icons: Mp.IconCache = $state({ cache: {} });

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

type DragHandlerType = "View" | "Column" | "Favorite";

type AppState = {
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
    symlinkVisible: boolean;
    isInGridView: boolean;
    scrolling: boolean;
};

export const initialAppState: AppState = {
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
    symlinkVisible: false,
    isInGridView: false,
    scrolling: false,
};

type AppAction =
    | { type: "reset" }
    | { type: "isMaximized"; value: boolean }
    | { type: "setBounds"; value: Mp.Bounds }
    | { type: "pathEditing"; value: boolean }
    | { type: "startSearch" }
    | { type: "endSearch" }
    | { type: "calculateColumnWidths"; value: Mp.MediaFile[] }
    | { type: "adjustColumnWidth"; value: Mp.SortKey }
    | { type: "toggleVisibleColumn"; value: Mp.SortKey }
    | { type: "navigated"; value: { canGoBack: boolean; canGoForward: boolean } }
    | { type: "updateSortType"; value: Mp.SortKey }
    | { type: "replaceFiles"; value: Mp.MediaFile[] }
    | { type: "sortInPlace"; value: Mp.MediaFile[] }
    | { type: "preventBlur"; value: boolean }
    | { type: "selectedId"; value: string }
    | { type: "setSelectedIds"; value: string[] }
    | { type: "removeSelectedIds"; value: string[] }
    | { type: "clearSelection" }
    | { type: "appendSelectedIds"; value: string[] }
    | { type: "updateSelection"; value: Mp.ItemSelection }
    | { type: "selectionAnchor"; value: string }
    | { type: "addToFavorites" }
    | { type: "removeFromFavorites" }
    | { type: "changeFavorites"; value: Mp.MediaFile[] }
    | { type: "startSlide"; value: { target: "Area" | Mp.SortKey; startX: number } }
    | { type: "slide"; value: number }
    | { type: "endSlide" }
    | { type: "copyCut"; value: { operation: Mp.ClipboardOperation; ids: string[]; files: Mp.MediaFile[] } }
    | { type: "clearCopyCut" }
    | { type: "dragEnter"; value: string }
    | { type: "dragLeave" }
    | { type: "startClip"; value: { position: Mp.Position; startId: string } }
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
    | { type: "adjustAllColumnWidths" }
    | { type: "settings"; value: Mp.Settings }
    | { type: "clearColumnHistory" }
    | { type: "updateColumnSetting"; value: { sortType: Mp.SortType | null; columns: Mp.Column[] | null } }
    | { type: "columns"; value: Mp.Column[] }
    | { type: "updateIconCache"; value: { key: string; small: string; large: string } }
    | { type: "load"; value: { event: Mp.LoadEvent } };

const updater = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case "reset":
            ListUpdater.reset();
            headerState.pathEditing = false;
            return state;

        case "setPreference":
            SettingsUpdater.updatePreference(action.value);
            return state;

        case "pathEditing": {
            headerState.pathEditing = action.value;
            return state;
        }

        case "load": {
            ListUpdater.load(action.value.event);
            headerState.pathEditing = false;
            DriveUpdater.updateDrives(action.value.event.drives);
            HeaderUpdater.resetSearch();
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
        case "replaceFiles":
            ListUpdater.replaceFiles(action.value);
            return state;
        case "sortInPlace":
            ListUpdater.sort(action.value);
            return state;

        case "drives":
            DriveUpdater.updateDrives(action.value);
            return state;

        case "startSearch":
            HeaderUpdater.startSearch();
            return state;

        case "endSearch":
            HeaderUpdater.resetSearch();
            return state;

        case "incremental":
            return { ...state, incrementalKey: action.value };

        case "clearIncremental":
            return { ...state, incrementalKey: "" };

        case "navigated":
            headerState.canGoBack = action.value.canGoBack;
            headerState.canGoForward = action.value.canGoForward;
            headerState.canGoUpward = !!path.dirname(listState.currentDir.fullPath) && listState.currentDir.fullPath != HOME && listState.currentDir.fullPath != RECYCLE_BIN;
            return state;

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
            settings.data.favorites = action.value;
            return state;
        case "addToFavorites":
            const file = listState.files.find((file) => file.id == state.selection.selectedIds[0]);
            if (file && !file.isFile) {
                settings.data.favorites.push(file);
            }
            return state;
        case "removeFromFavorites":
            if (driveState.hoverFavoriteId) {
                const newFavorites = settings.data.favorites.filter((file) => file.id != driveState.hoverFavoriteId);
                settings.data.favorites = newFavorites;
            }
            return state;
        case "hoverFavoriteId": {
            driveState.hoverFavoriteId = action.value;
            return state;
        }

        case "startSlide": {
            SlidUpdater.startSlide(listState.columns, action.value.target, action.value.startX);
            return state;
        }
        case "slide": {
            if (slideState.target == "Area") {
                settings.data.leftAreaWidth = slideState.initial + action.value;
                return state;
            }
            ListUpdater.updateWidth(action.value);
            return state;
        }
        case "endSlide": {
            SlidUpdater.endSlide();
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
            ClipUpdater.startClip(action.value.startId, action.value.position);
            return {
                ...state,
                selection: { ...state.selection, selectedId: action.value.startId },
            };
        }
        case "moveClip": {
            ClipUpdater.moveClip(action.value.x, action.value.y);
            return state;
        }
        case "endClip": {
            ClipUpdater.endClip();
            return state;
        }

        case "startRename":
            RenameUpdater.startRename(action.value.rect, action.value.oldName, action.value.fullPath, action.value.uuid);
            return state;
        case "endRename":
            RenameUpdater.endRename();
            return state;

        case "togglePreference":
            return { ...state, prefVisible: !state.prefVisible };
        case "toggleCreateSymlink":
            return { ...state, symlinkVisible: !state.symlinkVisible };
        case "toggleGridView":
            return { ...state, isInGridView: action.value };

        case "scrolling":
            return { ...state, scrolling: action.value };

        case "columns":
            listState.columns = action.value;
            return state;
        case "calculateColumnWidths":
            ListUpdater.calculateColumnWidths(action.value);
            return state;
        case "toggleVisibleColumn":
            SettingsUpdater.updateColumnSetting(null, null);
            ListUpdater.toggleVisibleColumn(action.value);
            return state;
        case "adjustColumnWidth":
            ListUpdater.swichWidth(action.value);
            return state;
        case "adjustAllColumnWidths":
            ListUpdater.swichAllWidths();
            return state;
        case "updateSortType":
            ListUpdater.updateSortType(action.value);
            return state;

        case "settings":
            settings.data = action.value;
            return state;
        case "isMaximized":
            settings.data.isMaximized = action.value;
            return state;
        case "setBounds":
            settings.data.bounds = action.value;
            return state;
        case "clearColumnHistory":
            settings.data.columnHistory = {};
            return state;
        case "updateColumnSetting":
            SettingsUpdater.updateColumnSetting(action.value.sortType, action.value.columns);
            return state;

        case "updateIconCache":
            icons.cache[action.value.key] = { small: action.value.small, large: action.value.large };
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
