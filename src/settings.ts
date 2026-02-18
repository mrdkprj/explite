import { appDataDir } from "@tauri-apps/api/path";
import { DEFAULT_LABLES, DEFAULT_SORTKEY_ORDER } from "./constants";
import { IPC } from "./ipc";
import { t } from "./translation/useTranslation";
import { path } from "./path";

const ipc = new IPC("View");
const SETTING_FILE_NAME = "explite.settings.json";
const EXCEPTION_KEYS = ["headerHistory"];

const defaultSettings: Mp.Settings = {
    bounds: { width: 1200, height: 800, x: 0, y: 0 },
    isMaximized: false,
    columnLabels: DEFAULT_LABLES,
    favorites: [],
    leftAreaWidth: 0,
    headerHistory: {},
    theme: "system",
    allowMoveColumn: true,
    appMenuItems: [],
    useOSIcon: false,
    rememberColumns: true,
};

export default class Settings {
    data = defaultSettings;

    private file = "";
    private dataDir = "";

    async init() {
        this.dataDir = await appDataDir();
        const settingPath = path.join(this.dataDir, "temp");
        this.file = path.join(settingPath, SETTING_FILE_NAME);
        const fileExists = await ipc.invoke("exists", this.file);

        if (fileExists) {
            const rawData = await ipc.invoke("read_text_file", this.file);
            if (rawData) {
                this.data = this.createSettings(JSON.parse(rawData));
            }
        } else {
            await ipc.invoke("mkdir_all", settingPath);
            await ipc.invoke("create", this.file);
            await ipc.invoke("write_text_file", { fullPath: this.file, data: JSON.stringify(this.data) });
        }

        return this.data;
    }

    private createSettings(rawSettings: any): Mp.Settings {
        const config = { ...defaultSettings } as any;

        Object.keys(rawSettings).forEach((key) => {
            if (!(key in config)) return;

            const value = rawSettings[key];

            if (typeof value === "object" && !Array.isArray(value)) {
                Object.keys(value).forEach((valueKey) => {
                    if (valueKey in config[key] || EXCEPTION_KEYS.includes(key)) {
                        config[key][valueKey] = value[valueKey];
                    }
                });
            } else if (key == "columnLabels") {
                const defaultLabels: { [key: string]: Mp.ColumnLabel } = {};
                DEFAULT_LABLES.forEach((label) => (defaultLabels[label.sortKey] = label));
                const currentLabels: { [key: string]: Mp.ColumnLabel } = {};
                value.forEach((label: Mp.ColumnLabel) => (currentLabels[label.sortKey] = label));
                const labels: Mp.ColumnLabel[] = [];
                Object.entries(defaultLabels).forEach(([sortKey, defaultLabel]) => {
                    const label = sortKey in currentLabels ? currentLabels[sortKey] : defaultLabel;
                    label.label = this.getLabel(sortKey as Mp.SortKey);
                    labels.push(label);
                });
                labels.sort((a, b) => DEFAULT_SORTKEY_ORDER.indexOf(a.sortKey) - DEFAULT_SORTKEY_ORDER.indexOf(b.sortKey));
                config[key] = labels;
            } else {
                config[key] = value;
            }
        });

        return config;
    }

    private getLabel(sortKey: Mp.SortKey) {
        switch (sortKey) {
            case "cdate":
                return t("colCreated");

            case "ddate":
                return t("colDeleted");

            case "directory":
                return t("colDirectory");

            case "extension":
                return t("colExtension");

            case "mdate":
                return t("colModified");

            case "name":
                return t("colName");

            case "orig_path":
                return t("colOrigPath");

            case "size":
                return t("colSize");
        }
        return "";
    }

    getFilePath() {
        return this.file;
    }

    async save() {
        await ipc.invoke("write_text_file", { fullPath: this.file, data: JSON.stringify(this.data, null, 2) });
    }
}
