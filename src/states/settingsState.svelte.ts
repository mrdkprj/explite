import { DEFAULT_LABLES, DEFAULT_SETTINGS, DEFAULT_SORT_TYPE } from "../constants";
import { listState, ListUpdater } from "./listState.svelte";

type SettingsState = {
    data: Mp.Settings;
};

const state: SettingsState = $state({ data: DEFAULT_SETTINGS });

export { state as settings };

export type PreferenceAction = { theme: Mp.Theme; appMenuItems: Mp.AppMenuItem[]; allowMoveColumn: boolean; useOSIcon: boolean; rememberColumns: boolean; treeView: boolean };

export class SettingsUpdater {
    static updatePreference = (action: PreferenceAction) => {
        state.data.theme = action.theme;
        state.data.allowMoveColumn = action.allowMoveColumn;
        state.data.appMenuItems = action.appMenuItems;
        state.data.useOSIcon = action.useOSIcon;
        state.data.rememberColumns = action.rememberColumns;
        if (state.data.treeView != action.treeView) {
            if (!action.treeView) {
                ListUpdater.clearTreeState();
            }
            state.data.treeView = action.treeView;
        }
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
}
