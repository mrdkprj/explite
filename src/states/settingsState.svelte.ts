import { DEFAULT_LABLES, DEFAULT_SETTINGS, DEFAULT_SORT_TYPE, HOME } from "../constants";

type SettingsState = {
    data: Mp.Settings;
};
const state: SettingsState = $state({ data: DEFAULT_SETTINGS });
export { state as settings };

type PrefAction = { theme: Mp.Theme; appMenuItems: Mp.AppMenuItem[]; allowMoveColumn: boolean; useOSIcon: boolean; rememberColumns: boolean };
export const updatePreference = (action: PrefAction) => {
    state.data.theme = action.theme;
    state.data.allowMoveColumn = action.allowMoveColumn;
    state.data.appMenuItems = action.appMenuItems;
    state.data.useOSIcon = action.useOSIcon;
    state.data.rememberColumns = action.rememberColumns;
};

export const updateColumnHistory = (directory: string, sortType: Mp.SortType | null, labels: Mp.ColumnLabel[] | null) => {
    if (directory == HOME) return;

    if (Object.keys(state.data.columnHistory).length == 100) {
        const oldestEntry = Object.entries(state.data.columnHistory).reduce((prev, curr) => (prev[1].time < curr[1].time ? prev : curr));
        delete state.data.columnHistory[oldestEntry[0]];
    }

    if (state.data.columnHistory[directory]) {
        state.data.columnHistory[directory].time = new Date().getTime();
        state.data.columnHistory[directory].sortType = sortType ?? state.data.columnHistory[directory].sortType;
        state.data.columnHistory[directory].labels = labels ?? state.data.columnHistory[directory].labels;
    } else {
        state.data.columnHistory[directory] = { time: new Date().getTime(), sortType: sortType ?? DEFAULT_SORT_TYPE, labels: labels ?? DEFAULT_LABLES };
    }
};

export const getApplicableColumnLabels = (directory: string) => {
    return state.data.columnHistory[directory] ? state.data.columnHistory[directory].labels : DEFAULT_LABLES;
};

export const validateColumnHistory = (directory: string) => {
    if (state.data.columnHistory[directory]) {
        state.data.columnHistory[directory].time = new Date().getTime();
    }
};

export const cleanColumnHistory = async () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    const monthBefore = date.getTime();
    const newHistory: { [key: string]: Mp.ColumnSetting } = {};
    Object.entries(state.data.columnHistory)
        .filter(([_, value]) => value.time > monthBefore)
        .forEach(([key, value]) => (newHistory[key] = value));
    state.data.columnHistory = newHistory;
};

export const clearColumnHistory = () => {
    state.data.columnHistory = {};
};
