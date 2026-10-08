import { ChangedSettings, DEFAULT_LABLES, DEFAULT_SETTINGS, DEFAULT_SORT_TYPE } from "../constants";
import { driveState } from "./driveState.svelte";
import { listState, ListUpdater } from "./listState.svelte";

type SettingsState = {
    data: Mp.Settings;
};

const state: SettingsState = $state({ data: DEFAULT_SETTINGS });

export { state as settings };

export type PreferenceAction = { theme: Mp.Theme; appMenuItems: Mp.AppMenuItem[]; allowMoveColumn: boolean; useOSIcon: boolean; rememberColumns: boolean; treeView: boolean; tabMode: boolean };

let changeCallback: (e: ChangedSettings) => void = () => {};

export class SettingsUpdater {
    static init = (data: Mp.Settings, callback: (e: ChangedSettings) => void) => {
        state.data = data;
        changeCallback = callback;
    };

    static isMaximized = (isMaximized: boolean) => {
        state.data.isMaximized = isMaximized;
    };

    static setBounds = (bounds: Mp.Bounds) => {
        state.data.bounds = bounds;
    };

    static clearColumnHistory = () => {
        state.data.columnHistory = {};
    };

    static toggleTabMode = (tabMode: boolean) => {
        state.data.tabMode = tabMode;
    };

    static update = (data: Mp.Settings) => {
        const newAppMenuItems = data.appMenuItems.filter((item) => item.path != "");
        let changedSettings = ChangedSettings.None;
        if (this.isAppMenuItemChanged(newAppMenuItems)) {
            changedSettings |= ChangedSettings.MenuItem;
        }
        if (data.theme != state.data.theme) {
            changedSettings |= ChangedSettings.Theme;
        }
        if (data.tabMode != state.data.tabMode) {
            changedSettings |= ChangedSettings.TabMode;
        }

        if (state.data.treeView != data.treeView) {
            if (!data.treeView) {
                ListUpdater.clearTreeState();
            }
        }

        state.data = data;
        changeCallback(changedSettings);
    };

    private static isAppMenuItemChanged = (newAppMenuItems: Mp.AppMenuItem[]): boolean => {
        if (newAppMenuItems.length != state.data.appMenuItems.length) return true;

        return newAppMenuItems.some(
            (item, index) => state.data.appMenuItems[index].label != item.label || state.data.appMenuItems[index].path != item.path || state.data.appMenuItems[index].target != item.target,
        );
    };

    static updateColumnSetting = (sortType: Mp.SortType | null, columns: Mp.Column[] | null) => {
        if (listState.isHome) return;

        const directory = listState.currentDir.fullPath;

        if (Object.keys(state.data.columnHistory).length > 100) {
            const oldestEntry = Object.entries(state.data.columnHistory).reduce((prev, curr) => (prev[1].time < curr[1].time ? prev : curr));
            delete state.data.columnHistory[oldestEntry[0]];
        }

        if (directory in state.data.columnHistory) {
            state.data.columnHistory[directory].time = new Date().getTime();
            state.data.columnHistory[directory].sortType = sortType ?? state.data.columnHistory[directory].sortType;
            state.data.columnHistory[directory].columns = columns ?? state.data.columnHistory[directory].columns;
        } else {
            state.data.columnHistory[directory] = { time: new Date().getTime(), sortType: sortType ?? DEFAULT_SORT_TYPE, columns: columns ?? DEFAULT_LABLES };
            ListUpdater.swichColumns();
        }
        changeCallback(ChangedSettings.Column);
    };

    static validateColumnHistory = (directory: string) => {
        if (state.data.columnHistory[directory]) {
            state.data.columnHistory[directory].time = new Date().getTime();
        }
    };

    static cleanColumnHistory = () => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        const monthBefore = date.getTime();
        const newHistory: { [key: string]: Mp.ColumnSetting } = {};
        Object.entries(state.data.columnHistory)
            .filter(([_, value]) => value.time > monthBefore)
            .forEach(([key, value]) => (newHistory[key] = value));
        state.data.columnHistory = newHistory;
    };

    static updateFavorite = (files: Mp.MediaFile[]) => {
        state.data.favorites = files;
        changeCallback(ChangedSettings.Favorite);
    };

    static addToFavorites = (file: Mp.MediaFile | undefined) => {
        if (file && !file.isFile) {
            state.data.favorites.push(file);
            changeCallback(ChangedSettings.Favorite);
        }
    };

    static removeFromFavorites = () => {
        if (driveState.hoverFavoriteId) {
            const newFavorites = state.data.favorites.filter((file) => file.id != driveState.hoverFavoriteId);
            state.data.favorites = newFavorites;
            changeCallback(ChangedSettings.Favorite);
        }
    };

    static updateLeftWidth = (width: number) => {
        state.data.leftAreaWidth = width;
    };
}
