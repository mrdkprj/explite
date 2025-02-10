export const handleKeyEvent = () => {
    /**/
};

export const HOME = "PC";

export const SEPARATOR = navigator.userAgent.includes("Windows") ? "\\" : "/";

export const DEFAULT_SORT_TYPE: Mp.SortType = {
    asc: true,
    key: "name",
};

export const BROWSER_SHORTCUT_KEYS = ["f", "p", "r", "+", "-", "u", "g", "j"];

export const DEFAULT_LABLES: Mp.HeaderLabels = {
    name: {
        label: "名前",
        width: 500,
        sortKey: "name",
    },
    directory: {
        label: "フォルダー",
        width: 400,
        sortKey: "directory",
    },
    extension: {
        label: "種類",
        width: 200,
        sortKey: "extension",
    },
    mdate: {
        label: "更新日時",
        width: 200,
        sortKey: "mdate",
    },
    cdate: {
        label: "作成日時",
        width: 200,
        sortKey: "cdate",
    },
    size: {
        label: "サイズ",
        width: 400,
        sortKey: "size",
    },
};

export const MIME_TYPE = {
    Audio: "audio",
    Video: "video",
    Image: "image",
    App: "application",
};
