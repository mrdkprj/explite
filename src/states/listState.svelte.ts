import { path } from "../path";
import { HOME } from "../constants";

export type ListState = {
    currentDir: {
        fullPath: string;
        paths: string[];
    };
    files: Mp.MediaFile[];
};

export const state: ListState = $state({
    currentDir: {
        fullPath: "",
        paths: [],
    },
    files: [],
});

export { state as listState };

export const reset = () => {
    state.files = [];
};

export const load = (e: Mp.LoadEvent) => {
    state.files = e.files;
    state.currentDir = {
        fullPath: e.directory,
        paths: e.directory == HOME ? [] : path.split(e.directory),
    };
};

export const updateFiles = (files: Mp.MediaFile[]) => {
    state.files = files;
};
