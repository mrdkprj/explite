import { writable } from "svelte/store";

const EMPTY_FILE: Mp.MediaFile = {
    id: "tempid",
    fullPath: "",
    encName: "temp-name-id",
    name: "新しいファイル.txt",
    mdate: 0,
    cdate: 0,
    size: 0,
    extension: ".txt",
    dir: "",
    isFile: true,
    fileType: "Normal",
};

const EMPTY_FOLDER: Mp.MediaFile = {
    id: "tempid",
    fullPath: "",
    encName: "temp-name-id",
    name: "新しいフォルダー",
    mdate: 0,
    cdate: 0,
    size: 0,
    extension: "",
    dir: "",
    isFile: false,
    fileType: "None",
};

type RenameState = {
    renaming: boolean;
    inputValue: string;
    rect: Mp.PartialRect;
};

type AppState = {
    files: Mp.MediaFile[];
    rename: RenameState;
    newItem: {
        inputValue: string;
        visible: boolean;
        rect: Mp.PartialRect;
    };
};

export const initialAppState: AppState = {
    files: [],
    rename: {
        renaming: false,
        inputValue: "",
        rect: {
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            origWidth: 0,
        },
    },
    newItem: {
        visible: false,
        inputValue: "",
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
    | { type: "startRename"; value: { rect: Mp.PartialRect; inputValue: string } }
    | { type: "changeInputWidth"; value: { target: "Rename" | "NewItem"; width: number } }
    | { type: "udpateName"; value: string }
    | { type: "rename"; value: { name: string; id: string } }
    | { type: "endRename" }
    | { type: "showNewItem"; value: { isFile: boolean } }
    | { type: "beginEditNewItem"; value: { rect: Mp.PartialRect; inputValue: string } }
    | { type: "hideNewItem" }
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
            return { ...state, rename: { ...state.rename, renaming: true, rect: action.value.rect, inputValue: action.value.inputValue } };

        case "changeInputWidth":
            if (action.value.target == "Rename") {
                return { ...state, rename: { ...state.rename, rect: { ...state.rename.rect, width: action.value.width } } };
            } else {
                return { ...state, newItem: { ...state.newItem, rect: { ...state.newItem.rect, width: action.value.width } } };
            }

        case "udpateName":
            return { ...state, rename: { ...state.rename, inputValue: action.value } };

        case "rename": {
            const files = [...state.files];
            const target = files.find((file) => file.id == action.value.id);
            if (target) {
                target.name = action.value.name;
            }

            return { ...state, files };
        }

        case "endRename":
            return { ...state, rename: { ...state.rename, renaming: false } };

        case "showNewItem": {
            const files = [...state.files];
            const newItem = action.value.isFile ? { ...EMPTY_FILE } : { ...EMPTY_FOLDER };
            newItem.cdate = new Date().getTime();
            newItem.mdate = new Date().getTime();
            files.push(newItem);
            return { ...state, files: files };
        }

        case "beginEditNewItem": {
            return { ...state, newItem: { ...state.newItem, rect: action.value.rect, visible: true, inputValue: action.value.inputValue } };
        }

        case "hideNewItem": {
            return { ...state, newItem: { ...state.newItem, visible: false, inputValue: "" } };
        }

        default:
            return state;
    }
};

const store = writable(initialAppState);

export const dispatchList = (action: AppAction) => {
    store.update((state) => updater(state, action));
};

export const listState = store;
