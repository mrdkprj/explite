export const handleKeyEvent = () => {
    /**/
};

export const HOME = "PC";

export const OS = {
    windows: "Windows",
    linux: "Linux",
};

export const SEPARATOR = navigator.userAgent.includes(OS.windows) ? "\\" : "/";

export const DEFAULT_SORT_TYPE: Mp.SortType = {
    asc: true,
    key: "name",
};

export const BROWSER_SHORTCUT_KEYS = ["f", "p", "r", "+", "-", "u", "g", "j"];

export const DEFAULT_LABLES: Mp.HeaderLabel[] = [
    {
        label: "名前",
        width: 500,
        sortKey: "name",
    },
    {
        label: "フォルダー",
        width: 400,
        sortKey: "directory",
    },
    {
        label: "種類",
        width: 200,
        sortKey: "extension",
    },
    {
        label: "更新日時",
        width: 200,
        sortKey: "mdate",
    },
    {
        label: "作成日時",
        width: 200,
        sortKey: "cdate",
    },
    {
        label: "サイズ",
        width: 400,
        sortKey: "size",
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

export const WinUserRootDir = "C:\\Users";
export const LinuxUserRootDir = "/home/";

export const WIN_SPECIAL_FOLDERS = {
    Desktop: new RegExp(/C:\\Users\\.*\\Desktop$/),
    Documents: new RegExp(/C:\\Users\\.*\\Documents$/),
    Downloads: new RegExp(/C:\\Users\\.*\\Downloads$/),
    Music: new RegExp(/C:\\Users\\.*\\Music$/),
    Pictures: new RegExp(/C:\\Users\\.*\\Pictures$/),
    Videos: new RegExp(/C:\\Users\\.*\\Videos$/),
};
