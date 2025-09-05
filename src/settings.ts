import { appDataDir, join } from "@tauri-apps/api/path";
import { DEFAULT_LABLES } from "./constants";
import { IPC } from "./ipc";

const ipc = new IPC("View");
const SETTING_FILE_NAME = "explite.settings.json";
const EXCEPTION_KEYS = ["headerHistory"];

const defaultSettings: Mp.Settings = {
    bounds: { width: 1200, height: 800, x: 0, y: 0 },
    isMaximized: false,
    headerLabels: DEFAULT_LABLES,
    favorites: [],
    leftAreaWidth: 0,
    headerHistory: {},
};

export default class Settings {
    data = defaultSettings;

    private file = "";
    private dataDir = "";

    async init() {
        this.dataDir = await appDataDir();
        const settingPath = await join(this.dataDir, "temp");
        this.file = await join(settingPath, SETTING_FILE_NAME);
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
            } else {
                config[key] = value;
            }
        });

        return config;
    }

    getFilePath() {
        return this.file;
    }

    async save() {
        await ipc.invoke("write_text_file", { fullPath: this.file, data: JSON.stringify(this.data, null, 2) });
    }
}
