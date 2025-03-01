import { writable } from "svelte/store";
import { dispatchList } from "./listStateReducer";
import { DEFAULT_LABLES, SEPARATOR } from "../constants";

type SlideState = {
    target: "Area" | Mp.SortKey;
    initial: number;
    startX: number;
    sliding: boolean;
};

type Clip = {
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

type AppState = {
    disks: Mp.DriveInfo[];
    isMaximized: boolean;
    isFullScreen: boolean;
    pathEditing: boolean;
    currentDir: {
        fullPath: string;
        paths: string[];
    };
    headerLabels: Mp.HeaderLabels;
    canUndo: boolean;
    canRedo: boolean;
    prevSelection: Mp.ItemSelection | null;
    sort: Mp.SortType;
    preventBlur: boolean;
    selection: Mp.ItemSelection;
    favorites: Mp.MediaFile[];
    leftWidth: number;
    slideState: SlideState;
    copyCutTargets: {
        op: "Cut" | "Copy";
        ids: string[];
        files: Mp.MediaFile[];
    };
    dragTargetId: string;
    clip: Clip;
    incrementalKey: string;
    search: SearchState;
    hoverFavoriteId: string;
};

export const initialAppState: AppState = {
    disks: [],
    isMaximized: false,
    isFullScreen: false,
    pathEditing: false,
    currentDir: {
        fullPath: "",
        paths: [],
    },
    headerLabels: DEFAULT_LABLES,
    canUndo: false,
    canRedo: false,
    prevSelection: null,
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
        op: "Copy",
        ids: [],
        files: [],
    },
    dragTargetId: "",
    clip: {
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
};

type AppAction =
    | { type: "init"; value: { disks: Mp.DriveInfo[]; files: Mp.MediaFile[]; directory: string } }
    | { type: "reset" }
    | { type: "isMaximized"; value: boolean }
    | { type: "isFullScreen"; value: boolean }
    | { type: "pathEditing"; value: boolean }
    | { type: "startSearch" }
    | { type: "endSearch" }
    | { type: "headerLabels"; value: Mp.HeaderLabels }
    | { type: "history"; value: { canUndo: boolean; canRedo: boolean } }
    | { type: "sort"; value: Mp.SortType }
    | { type: "updateFiles"; value: { files: Mp.MediaFile[]; reload: boolean } }
    | { type: "startRename"; value: { rect: Mp.PartialRect; inputValue: string } }
    | { type: "rename"; value: { name: string; id: string } }
    | { type: "endRename" }
    | { type: "preventBlur"; value: boolean }
    | { type: "selectedId"; value: string }
    | { type: "setSelectedIds"; value: string[] }
    | { type: "replaceSelectedIds"; value: string[] }
    | { type: "clearSelection"; value?: boolean }
    | { type: "appendSelectedIds"; value: string[] }
    | { type: "updateSelection"; value: Mp.ItemSelection }
    | { type: "udpateName"; value: string }
    | { type: "changeInputWidth"; value: { target: "Rename" | "NewItem"; width: number } }
    | { type: "changeFavorites"; value: Mp.MediaFile[] }
    | { type: "leftWidth"; value: number }
    | { type: "startSlide"; value: { target: "Area" | Mp.SortKey; startX: number } }
    | { type: "slide"; value: number }
    | { type: "endSlide" }
    | { type: "showNewItem"; value: { isFile: boolean } }
    | { type: "beginEditNewItem"; value: { rect: Mp.PartialRect; inputValue: string } }
    | { type: "hideNewItem" }
    | { type: "copyCut"; value: { operation: "Cut" | "Copy"; ids: string[]; files: Mp.MediaFile[] } }
    | { type: "clearCopyCut" }
    | { type: "dragEnter"; value: string }
    | { type: "dragLeave" }
    | { type: "startClip"; value: { position: ClipPosition } }
    | { type: "moveClip"; value: { x: number; y: number } }
    | { type: "endClip" }
    | { type: "incremental"; value: string }
    | { type: "clearIncremental" }
    | { type: "hoverFavoriteId"; value: string }
    | { type: "disks"; value: Mp.DriveInfo[] }
    | { type: "load"; value: Mp.LoadEvent };

const updater = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case "init":
            dispatchList({ type: "init", value: action.value.files });
            return {
                ...state,
                pathEditing: false,
                disks: action.value.disks,
                currentDir: {
                    fullPath: action.value.directory,
                    paths: action.value.directory == "Home" ? [] : action.value.directory.split(SEPARATOR).filter((i) => i),
                },
            };

        case "reset":
            dispatchList({ type: "reset" });
            return {
                ...state,
                pathEditing: false,
            };

        case "isMaximized":
            return { ...state, isMaximized: action.value };

        case "isFullScreen":
            return { ...state, isFullScreen: action.value };

        case "pathEditing": {
            return { ...state, pathEditing: action.value };
        }

        case "load": {
            dispatchList({ type: "load", value: action.value });
            const changed = state.currentDir.fullPath != action.value.directory && action.value.navigation != "Direct";
            if (changed) {
                return {
                    ...state,
                    pathEditing: false,
                    search: { ...state.search, searching: false, key: "" },
                    currentDir: {
                        fullPath: action.value.directory,
                        paths: action.value.directory == "Home" ? [] : action.value.directory.split(SEPARATOR).filter((i) => i),
                    },
                    selection: state.prevSelection ?? { selectedId: "", selectedIds: [] },
                    prevSelection: state.selection,
                };
            } else {
                return {
                    ...state,
                    pathEditing: false,
                    search: { ...state.search, searching: false, key: "" },
                    currentDir: {
                        fullPath: action.value.directory,
                        paths: action.value.directory == "Home" ? [] : action.value.directory.split(SEPARATOR).filter((i) => i),
                    },
                    selection: { selectedId: "", selectedIds: [] },
                    prevSelection: state.selection,
                };
            }
        }

        case "updateFiles":
            dispatchList({ type: "updateFiles", value: action.value.files });
            if (action.value.reload) {
                return { ...state, copyCutTargets: { op: "Copy", ids: [], files: [] } };
            } else {
                return state;
            }

        case "disks":
            return { ...state, disks: action.value };

        case "startSearch":
            return { ...state, search: { ...state.search, searching: true } };

        case "endSearch":
            return { ...state, search: { ...state.search, searching: false, key: "" } };

        case "incremental": {
            return { ...state, incrementalKey: action.value };
        }

        case "clearIncremental": {
            return { ...state, incrementalKey: "" };
        }

        case "headerLabels": {
            return { ...state, headerLabels: action.value };
        }

        case "history":
            return { ...state, canUndo: action.value.canUndo, canRedo: action.value.canRedo };

        case "sort":
            return { ...state, sort: action.value };

        case "selectedId":
            return { ...state, selection: { ...state.selection, selectedId: action.value } };

        case "setSelectedIds":
            return { ...state, selection: { ...state.selection, selectedIds: action.value } };

        case "clearSelection":
            if (action.value) {
                const selectedIds = state.selection.selectedIds.length ? [state.selection.selectedIds[0]] : [];
                return { ...state, selection: { ...state.selection, selectedId: "", selectedIds } };
            } else {
                return { ...state, selection: { ...state.selection, selectedId: "", selectedIds: [] } };
            }

        case "appendSelectedIds":
            return { ...state, selection: { ...state.selection, selectedIds: [...state.selection.selectedIds, ...action.value] } };

        case "replaceSelectedIds":
            return { ...state, selection: { ...state.selection, selectedIds: action.value } };

        case "updateSelection":
            return { ...state, selection: { ...state.selection, selectedId: action.value.selectedId, selectedIds: action.value.selectedIds } };

        case "startRename":
            dispatchList({ type: "startRename", value: action.value });
            return state;

        case "udpateName":
            dispatchList({ type: "udpateName", value: action.value });
            return state;

        case "changeInputWidth":
            dispatchList({ type: "changeInputWidth", value: action.value });
            return state;

        case "rename":
            dispatchList({ type: "rename", value: action.value });
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

            const label = state.headerLabels[action.value.target];
            return { ...state, slideState: { ...state.slideState, sliding: true, target: action.value.target, initial: label.width, startX: action.value.startX } };
        }

        case "slide": {
            if (state.slideState.target == "Area") {
                return { ...state, leftWidth: state.slideState.initial + action.value };
            }
            const headerLabels = { ...state.headerLabels };
            const label = headerLabels[state.slideState.target];
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

        case "showNewItem":
            dispatchList({ type: "showNewItem", value: action.value });
            return state;

        case "beginEditNewItem":
            dispatchList({ type: "beginEditNewItem", value: action.value });
            return state;

        case "hideNewItem":
            dispatchList({ type: "hideNewItem" });
            return state;

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
                clip: {
                    ...state.clip,
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
                    selection: { ...state.selection, selectedId: "", selectedIds: [] },
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
            return { ...state, clip: { ...state.clip, clipping: false, moved: false } };
        }

        case "hoverFavoriteId": {
            return { ...state, hoverFavoriteId: action.value };
        }

        default:
            return state;
    }
};

const store = writable(initialAppState);

export const dispatch = (action: AppAction) => {
    store.update((state) => updater(state, action));
};

export const appState = store;
