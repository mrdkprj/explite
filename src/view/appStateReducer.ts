import { writable } from "svelte/store";
import { dispatchList } from "./listStateReducer";
import { DEFAULT_LABLES } from "../constants";

type SlideState = {
    target: "Area" | Mp.SortKey;
    initial: number;
    startX: number;
    sliding: boolean;
};

type Clip = {
    startId: string;
    clipping: boolean;
    moved: boolean;
    clipAreaStyle: string;
    clipPosition: ClipPosition;
};

type ClipPosition = {
    startX: number;
    startY: number;
};

type SearchState = {
    searching: boolean;
    key: string;
};

type DragHandlerType = "View" | "Column" | "Favorite";

type AppState = {
    drives: Mp.DriveInfo[];
    isMaximized: boolean;
    isFullScreen: boolean;
    pathEditing: boolean;
    headerLabels: Mp.HeaderLabel[];
    canGoBack: boolean;
    canGoForward: boolean;
    sort: Mp.SortType;
    preventBlur: boolean;
    selection: Mp.ItemSelection;
    favorites: Mp.MediaFile[];
    leftWidth: number;
    slideState: SlideState;
    copyCutTargets: {
        op: Mp.ClipboardOperation;
        ids: string[];
        files: Mp.MediaFile[];
    };
    dragTargetId: string;
    dragHandler: DragHandlerType;
    clip: Clip;
    incrementalKey: string;
    search: SearchState;
    hoverFavoriteId: string;
    prefVisible: boolean;
    theme: Mp.Theme;
    allowMoveColumn: boolean;
    appMenuItems: Mp.AppMenuItem[];
    symlinkVisible: boolean;
};

export const initialAppState: AppState = {
    drives: [],
    isMaximized: false,
    isFullScreen: false,
    pathEditing: false,
    headerLabels: DEFAULT_LABLES,
    canGoBack: false,
    canGoForward: false,
    sort: {
        asc: true,
        key: "name",
    },
    preventBlur: false,
    selection: { selectedId: "", selectedIds: [] },
    favorites: [],
    leftWidth: 250,
    slideState: {
        target: "Area",
        initial: 0,
        sliding: false,
        startX: 0,
    },
    copyCutTargets: {
        op: "None",
        ids: [],
        files: [],
    },
    dragTargetId: "",
    dragHandler: "View",
    clip: {
        startId: "",
        clipAreaStyle: "",
        clipping: false,
        clipPosition: {
            startX: 0,
            startY: 0,
        },
        moved: false,
    },
    incrementalKey: "",
    search: {
        searching: false,
        key: "",
    },
    hoverFavoriteId: "",
    prefVisible: false,
    theme: "system",
    allowMoveColumn: true,
    appMenuItems: [],
    symlinkVisible: false,
};

type AppAction =
    | { type: "reset" }
    | { type: "isMaximized"; value: boolean }
    | { type: "isFullScreen"; value: boolean }
    | { type: "pathEditing"; value: boolean }
    | { type: "startSearch" }
    | { type: "endSearch" }
    | { type: "headerLabels"; value: Mp.HeaderLabel[] }
    | { type: "history"; value: { canGoBack: boolean; canGoForward: boolean } }
    | { type: "sort"; value: Mp.SortType }
    | { type: "updateFiles"; value: { files: Mp.MediaFile[] } }
    | { type: "startRename"; value: { rect: Mp.PartialRect; oldName: string; fullPath: string; uuid: string } }
    | { type: "endRename" }
    | { type: "preventBlur"; value: boolean }
    | { type: "selectedId"; value: string }
    | { type: "setSelectedIds"; value: string[] }
    | { type: "removeSelectedIds"; value: string[] }
    | { type: "clearSelection" }
    | { type: "appendSelectedIds"; value: string[] }
    | { type: "updateSelection"; value: Mp.ItemSelection }
    | { type: "changeInputWidth"; value: number }
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
    | { type: "setPreference"; value: { theme: Mp.Theme; appMenuItems: Mp.AppMenuItem[]; allowMoveColumn: boolean } }
    | { type: "togglePreference" }
    | { type: "toggleCreateSymlink" }
    | { type: "load"; value: { event: Mp.LoadEvent } };

const updater = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case "reset":
            dispatchList({ type: "reset" });
            return {
                ...state,
                pathEditing: false,
            };

        case "setPreference":
            return { ...state, theme: action.value.theme, allowMoveColumn: action.value.allowMoveColumn, appMenuItems: action.value.appMenuItems };

        case "isMaximized":
            return { ...state, isMaximized: action.value };

        case "isFullScreen":
            return { ...state, isFullScreen: action.value };

        case "pathEditing": {
            return { ...state, pathEditing: action.value };
        }

        case "load": {
            dispatchList({ type: "load", value: action.value.event });

            if (action.value.event.navigation == "Reload") {
                return {
                    ...state,
                    pathEditing: false,
                    drives: action.value.event.drives ?? state.drives,
                    search: { ...state.search, searching: false, key: "" },
                    copyCutTargets: { op: "Copy", ids: [], files: [] },
                    selection: {
                        selectedId: "",
                        selectedIds: [],
                    },
                };
            }

            return {
                ...state,
                pathEditing: false,
                drives: action.value.event.drives ?? state.drives,
                search: { ...state.search, searching: false, key: "" },
            };
        }

        case "updateFiles":
            dispatchList({ type: "updateFiles", value: action.value.files });
            return state;

        case "drives":
            return { ...state, drives: action.value };

        case "startSearch":
            return { ...state, search: { ...state.search, searching: true, key: state.search.key.trim() } };

        case "endSearch":
            return { ...state, search: { ...state.search, searching: false, key: "" } };

        case "incremental":
            return { ...state, incrementalKey: action.value };

        case "clearIncremental":
            return { ...state, incrementalKey: "" };

        case "headerLabels":
            return { ...state, headerLabels: action.value };

        case "history":
            return { ...state, canGoBack: action.value.canGoBack, canGoForward: action.value.canGoForward };

        case "sort":
            return { ...state, sort: action.value };

        case "selectedId":
            return { ...state, selection: { ...state.selection, selectedId: action.value } };

        case "setSelectedIds":
            return { ...state, selection: { ...state.selection, selectedIds: action.value } };

        case "clearSelection":
            return { ...state, selection: { ...state.selection, selectedId: "", selectedIds: [] } };

        case "appendSelectedIds":
            return { ...state, selection: { ...state.selection, selectedIds: [...state.selection.selectedIds, ...action.value] } };

        case "removeSelectedIds":
            const ids = state.selection.selectedIds.filter((id) => !action.value.includes(id));
            return { ...state, selection: { ...state.selection, selectedIds: ids } };

        case "updateSelection":
            return { ...state, selection: { ...state.selection, selectedId: action.value.selectedId, selectedIds: action.value.selectedIds } };

        case "startRename":
            dispatchList({ type: "startRename", value: action.value });
            return state;

        case "changeInputWidth":
            dispatchList({ type: "changeInputWidth", value: action.value });
            return state;

        case "endRename":
            dispatchList({ type: "endRename" });
            return state;

        case "preventBlur":
            return { ...state, preventBlur: action.value };

        case "changeFavorites":
            return { ...state, favorites: action.value };

        case "leftWidth":
            return { ...state, leftWidth: action.value };

        case "startSlide": {
            if (action.value.target == "Area") {
                return { ...state, slideState: { ...state.slideState, sliding: true, target: action.value.target, initial: state.leftWidth, startX: action.value.startX } };
            }
            const label = state.headerLabels.filter((label) => label.sortKey == action.value.target)[0];
            return { ...state, slideState: { ...state.slideState, sliding: true, target: action.value.target, initial: label.width, startX: action.value.startX } };
        }

        case "slide": {
            if (state.slideState.target == "Area") {
                return { ...state, leftWidth: state.slideState.initial + action.value };
            }
            const headerLabels = structuredClone(state.headerLabels);
            const label = headerLabels.filter((label) => label.sortKey == state.slideState.target)[0];
            const newWidth = state.slideState.initial + action.value;
            if (newWidth <= 50) {
                return state;
            }
            label.width = state.slideState.initial + action.value;
            return { ...state, headerLabels };
        }

        case "endSlide": {
            return { ...state, slideState: { ...state.slideState, sliding: false, target: "Area" } };
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

        case "startClip": {
            return {
                ...state,
                selection: { ...state.selection, selectedId: action.value.startId },
                clip: {
                    ...state.clip,
                    startId: action.value.startId,
                    clipping: true,
                    moved: false,
                    clipPosition: { startY: action.value.position.startY, startX: action.value.position.startX },
                    clipAreaStyle: `width:0px; height:0px; top:${action.value.position.startY}px; left:${action.value.position.startX}`,
                },
            };
        }

        case "moveClip": {
            const moveX = action.value.x - state.clip.clipPosition.startX;
            const moveY = action.value.y - state.clip.clipPosition.startY;
            const scaleX = moveX >= 0 ? 1 : -1;
            const scaleY = moveY >= 0 ? 1 : -1;
            const width = Math.abs(moveX);
            const height = Math.abs(moveY);
            const moved = Math.abs(moveX) > 10 || Math.abs(moveY) > 10;
            if (!state.clip.moved && moved) {
                return {
                    ...state,
                    clip: {
                        ...state.clip,
                        moved: true,
                        clipAreaStyle: `transform:scale(${scaleX}, ${scaleY}); width:${width}px; height:${height}px; top:${state.clip.clipPosition.startY}px; left:${state.clip.clipPosition.startX}px;`,
                    },
                };
            }

            return {
                ...state,
                clip: {
                    ...state.clip,
                    clipAreaStyle: `transform:scale(${scaleX}, ${scaleY}); width:${width}px; height:${height}px; top:${state.clip.clipPosition.startY}px; left:${state.clip.clipPosition.startX}px;`,
                },
            };
        }

        case "endClip": {
            return { ...state, clip: { ...state.clip, clipping: false, moved: false, startId: "" } };
        }

        case "hoverFavoriteId": {
            return { ...state, hoverFavoriteId: action.value };
        }

        case "startDrag":
            return { ...state, dragTargetId: action.value.id, dragHandler: action.value.type };

        case "endDrag":
            return { ...state, dragTargetId: "", dragHandler: "View" };

        case "togglePreference":
            return { ...state, prefVisible: !state.prefVisible };

        case "toggleCreateSymlink":
            return { ...state, symlinkVisible: !state.symlinkVisible };

        default:
            return state;
    }
};

const store = writable(initialAppState);

export const dispatch = (action: AppAction) => {
    store.update((state) => updater(state, action));
};

export const appState = store;
