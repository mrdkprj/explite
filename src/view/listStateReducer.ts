import { writable } from "svelte/store";

type RenameState = {
    renaming: boolean;
    newName: string;
    oldName: string;
    fullPath: string;
    rect: Mp.PartialRect;
};

type AppState = {
    files: Mp.MediaFile[];
    rename: RenameState;
};

export const initialAppState: AppState = {
    files: [],
    rename: {
        renaming: false,
        oldName: "",
        newName: "",
        fullPath: "",
        rect: {
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            origWidth: 0,
        },
    },
};

type AppAction =
    | { type: "init"; value: Mp.MediaFile[] }
    | { type: "reset" }
    | { type: "updateFiles"; value: Mp.MediaFile[] }
    | { type: "startRename"; value: { rect: Mp.PartialRect; oldName: string; fullPath: string } }
    | { type: "changeInputWidth"; value: number }
    | { type: "endRename" }
    | { type: "load"; value: Mp.LoadEvent };

const updater = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case "init":
            return {
                ...state,
                files: action.value,
            };

        case "reset":
            return {
                ...state,
                files: [],
            };

        case "load":
            return {
                ...state,
                files: action.value.files,
            };

        case "updateFiles":
            return { ...state, files: action.value };

        case "startRename":
            return { ...state, rename: { ...state.rename, renaming: true, rect: action.value.rect, oldName: action.value.oldName, newName: action.value.oldName, fullPath: action.value.fullPath } };

        case "changeInputWidth":
            return { ...state, rename: { ...state.rename, rect: { ...state.rename.rect, width: action.value } } };

        case "endRename":
            return { ...state, rename: { ...state.rename, renaming: false } };

        default:
            return state;
    }
};

const store = writable(initialAppState);

export const dispatchList = (action: AppAction) => {
    store.update((state) => updater(state, action));
};

export const listState = store;
