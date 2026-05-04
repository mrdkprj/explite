import path from "../path";
import util from "../util";
import { DEFAULT_LABLES, DEFAULT_SORT_TYPE, FONT_FOR_CALCULATION } from "../constants";
import { settings, SettingsUpdater } from "./settingsState.svelte";
import { slideState } from "./slideState.svelte";

type MaxColumnWidths = { [key in Mp.SortKey]: number };

type ListState = {
    currentDir: {
        fullPath: string;
        paths: string[];
    };
    files: Mp.MediaFile[];
    isHome: boolean;
    isRecycleBin: boolean;
    columns: Mp.Column[];
    adjustedWidths: MaxColumnWidths;
    sortType: Mp.SortType;
    clientWidth: number;
    expandedDir: { [key: string]: number };
};

const state: ListState = $state({
    currentDir: {
        fullPath: "",
        paths: [],
    },
    files: [],
    isHome: false,
    isRecycleBin: false,
    columns: DEFAULT_LABLES,
    adjustedWidths: { ddate: 0, directory: 0, name: 0, mdate: 0, cdate: 0, size: 0, extension: 0, orig_path: 0 },
    sortType: DEFAULT_SORT_TYPE,
    clientWidth: 0,
    expandedDir: {},
});

export { state as listState };

let canvas: HTMLCanvasElement;

export class ListUpdater {
    static reset = () => {
        state.files = [];
    };

    static appendChildren = (parent: Mp.MediaFile, files: Mp.MediaFile[]) => {
        const index = state.files.findIndex((file) => file.id == parent.id);

        if (index >= 0) {
            const target = state.files[index];
            const info = target.treeState ?? { level: 0, opened: true };
            info.opened = true;
            target.treeState = info;
            state.expandedDir[util.getRealPath(target)] = info.level + 1;

            files.forEach((file) => (file.treeState = { level: info.level + 1, opened: false }));
            util.sort(files, state.sortType.asc, state.sortType.key);
            state.files.splice(index + 1, 0, ...files);
        }
    };

    static removeChildren = (parent: Mp.MediaFile) => {
        const index = state.files.findIndex((file) => file.id == parent.id);
        if (index >= 0) {
            const childresn = state.files.filter((file) => util.getRealPath(file).startsWith(util.getRealPath(parent)));
            const target = state.files[index];
            state.files.splice(index + 1, childresn.length - 1);
            delete state.expandedDir[util.getRealPath(target)];
            if (target.treeState?.level == 0) {
                target.treeState = undefined;
            }
        }
    };

    static clearTreeState = () => {
        const files = state.files
            .map((file) => {
                // Clear treeState of root item
                if (file.treeState && file.treeState.level == 0) {
                    file.treeState = undefined;
                }
                return file;
            })
            .filter((file) => !file.treeState);
        state.expandedDir = {};
        state.files = files;
    };

    private static changeDirectory = (directory: string) => {
        if (state.currentDir.fullPath != directory) {
            state.currentDir = {
                fullPath: directory,
                paths: util.isHome(directory) ? [] : path.split(directory),
            };
            state.isHome = util.isHome(directory);
            state.isRecycleBin = util.isRecycleBin(directory);
            this.swichColumns();
            SettingsUpdater.validateColumnHistory(directory);
        }
    };

    static sort = (files: Mp.MediaFile[]) => {
        if (files.length) {
            settings.data.treeView ? util.sortByGroup(files, state.sortType.asc, state.sortType.key) : util.sort(files, state.sortType.asc, state.sortType.key);
        }
    };

    static replaceFiles = (files: Mp.MediaFile[]) => {
        this.sort(files);
        state.files = files;
    };

    static load = (e: Mp.LoadEvent) => {
        this.changeDirectory(e.directory);
        this.sort(e.files);
        state.files = e.files;
    };

    static updateFiles = (files: Mp.MediaFile[]) => {
        state.files = files;
    };

    static swichColumns = () => {
        state.columns = state.currentDir.fullPath in settings.data.columnHistory ? settings.data.columnHistory[state.currentDir.fullPath].columns : DEFAULT_LABLES;
        state.sortType = state.currentDir.fullPath in settings.data.columnHistory ? settings.data.columnHistory[state.currentDir.fullPath].sortType : DEFAULT_SORT_TYPE;
    };

    static calculateColumnWidths = (items: Mp.MediaFile[]) => {
        if (!items.length) {
            state.adjustedWidths = { ddate: 0, directory: 0, name: 0, mdate: 0, cdate: 0, size: 0, extension: 0, orig_path: 0 };
            return;
        }
        const iconWidth = 21;
        const widths: MaxColumnWidths = { ddate: 0, directory: 0, name: 0, mdate: 0, cdate: 0, size: 0, extension: 0, orig_path: 0 };

        const _canvas = canvas || (canvas = document.createElement("canvas"));
        const context = _canvas.getContext("2d");
        if (!context) return widths;

        context.font = `normal 12px ${FONT_FOR_CALCULATION}`;
        items.forEach((item) => {
            const { dir, name, mdateString, cdateString, sizeString, extension, originalPath, ddateString } = item;
            widths.directory = Math.max(widths.directory, context.measureText(dir).width);
            widths.name = Math.max(widths.name, context.measureText(name).width + iconWidth);
            widths.mdate = Math.max(widths.mdate, context.measureText(mdateString).width);
            widths.cdate = Math.max(widths.cdate, context.measureText(cdateString).width);
            widths.size = Math.max(widths.size, context.measureText(sizeString).width);
            widths.extension = Math.max(widths.extension, context.measureText(extension).width);
            widths.orig_path = Math.max(widths.orig_path, context.measureText(originalPath).width);
            widths.ddate = Math.max(widths.ddate, context.measureText(ddateString).width);
        });
        state.adjustedWidths = widths;
    };

    static swichWidth = (key: Mp.SortKey) => {
        const column = state.columns.find((column) => column.sortKey == key);
        if (!column) return;
        column.width = state.adjustedWidths[key];
    };

    static swichAllWidths = () => {
        state.columns.forEach((column) => (column.width = state.adjustedWidths[column.sortKey]));
    };

    static toggleVisibleColumn = (key: Mp.SortKey) => {
        const column = state.columns.find((column) => column.sortKey == key);
        if (!column) return;
        column.visible = !column.visible;
    };

    static updateWidth = (width: number) => {
        const column = state.columns.filter((column) => column.sortKey == slideState.target)[0];
        const newWidth = slideState.initial + width;
        if (newWidth <= 50) {
            return;
        }
        column.width = slideState.initial + width;
    };

    static updateSortType = (key: Mp.SortKey) => {
        const asc = state.sortType.key == key ? !state.sortType.asc : true;
        state.sortType = {
            key,
            asc,
        };
    };
}
