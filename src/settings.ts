import { appDataDir } from "@tauri-apps/api/path";
import { DEFAULT_SETTINGS } from "./constants";
import { IPC } from "./ipc";
import { path } from "./path";

const ipc = new IPC("View");
const SETTING_FILE_NAME = "explite.settings.json";
const EXCEPTION_KEYS = ["columnHistory"];

export default class Settings {
    private file = "";
    private dataDir = "";

    async init() {
        let data: Mp.Settings = DEFAULT_SETTINGS;
        this.dataDir = await appDataDir();
        const settingPath = path.join(this.dataDir, "temp");
        this.file = path.join(settingPath, SETTING_FILE_NAME);
        const fileExists = await ipc.invoke("exists", this.file);

        if (fileExists) {
            const rawData = await ipc.invoke("read_text_file", this.file);
            if (rawData) {
                data = this.createSettings(JSON.parse(rawData));
            }
        } else {
            await ipc.invoke("mkdir_all", settingPath);
            await ipc.invoke("create", this.file);
            await ipc.invoke("write_text_file", { fullPath: this.file, data: JSON.stringify(data) });
        }

        return data;
    }

    private createSettings(rawSettings: any): Mp.Settings {
        const config = { ...DEFAULT_SETTINGS } as any;

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

    async save(data: Mp.Settings) {
        await ipc.invoke("write_text_file", { fullPath: this.file, data: JSON.stringify(data, null, 2) });
    }
}
