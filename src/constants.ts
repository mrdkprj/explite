export const handleKeyEvent = () => {
    /**/
};

export const OS = {
    windows: "Windows",
    linux: "Linux",
};

export const HOME = "PC";
export const RECYCLE_BIN = "Recycle Bin";
export const RECYCLE_BIN_ITEM = "Recycle Bin Item";

export const SEPARATOR = navigator.userAgent.includes(OS.windows) ? "\\" : "/";

export const DEFAULT_SORTKEY_ORDER: Mp.SortKey[] = ["name", "directory", "orig_path", "ddate", "extension", "mdate", "cdate", "size"];
export const DEFAULT_SORT_TYPE: Mp.SortType = {
    asc: true,
    key: "name",
};

export const DEFAULT_SETTINGS: Mp.Settings = {
    bounds: { width: 1200, height: 800, x: 0, y: 0 },
    isMaximized: false,
    favorites: [],
    leftAreaWidth: 0,
    columnHistory: {},
    theme: "system",
    allowMoveColumn: true,
    appMenuItems: [],
    useOSIcon: false,
    rememberColumns: true,
};

export const BROWSER_SHORTCUT_KEYS = ["f", "p", "r", "+", "-", "u", "g", "j"];

export const DATE_OPTION: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "numeric", second: "numeric" };

export const DEFAULT_LABLES: Mp.Column[] = [
    {
        width: 300,
        sortKey: "name",
        visible: true,
    },
    {
        width: 300,
        sortKey: "directory",
        visible: true,
    },
    {
        width: 300,
        sortKey: "orig_path",
        visible: true,
    },
    {
        width: 150,
        sortKey: "ddate",
        visible: true,
    },
    {
        width: 100,
        sortKey: "extension",
        visible: true,
    },
    {
        width: 150,
        sortKey: "mdate",
        visible: true,
    },
    {
        width: 150,
        sortKey: "cdate",
        visible: true,
    },
    {
        width: 100,
        sortKey: "size",
        visible: true,
    },
];

export const MIME_TYPE = {
    Audio: "audio",
    Video: "video",
    Image: "image",
    App: "application",
    Link: "shortcut",
};

export const ARCHIVE_EXT = [".zip", ".tar", ".7z", ".gz", ".bz", ".xz"];

export const WIN_USER_ROOT_DIR = "C:\\Users";
export const LINUX_USER_ROOT_DIR = "/home/";

export const WIN_SPECIAL_FOLDERS = {
    Desktop: new RegExp(/C:\\Users\\.*\\Desktop$/),
    Documents: new RegExp(/C:\\Users\\.*\\Documents$/),
    Downloads: new RegExp(/C:\\Users\\.*\\Downloads$/),
    Music: new RegExp(/C:\\Users\\.*\\Music$/),
    Pictures: new RegExp(/C:\\Users\\.*\\Pictures$/),
    Videos: new RegExp(/C:\\Users\\.*\\Videos$/),
};

export const LINUX_SPECIAL_FOLDERS = {
    Desktop: new RegExp(/\/home\/.*\/Desktop$/),
    Documents: new RegExp(/\/home\/.*\/.*\/Documents$/),
    Downloads: new RegExp(/\/home\/.*\/.*\/Downloads$/),
    Music: new RegExp(/\/home\/.*\/.*\/Music$/),
    Pictures: new RegExp(/\/home\/.*\/.*\/Pictures$/),
    Videos: new RegExp(/\/home\/.*\/.*\/Videos$/),
};

export const WSL_ROOT = "\\\\wsl.localhost";

export const INPUT_TEXT_BORDER_WIDTH = 2;
export const COLUMN_HEADER_HEIGHT = 30;
export const GRID_VERTICAL_MARGIN = 10;
export const LIST_ITEM_HEIGHT = 30;
export const GRID_ITEM_HEIGHT = 140;
export const LARGE_ICON_SIZE = 100;
export const HEADER_DIVIDER_WIDTh = 10;

// width + padding + margin
export const GRID_ITEM_WIDTH = 100 + 10 + 10;
