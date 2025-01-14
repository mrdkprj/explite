import { BrowserWindow, nativeImage } from "electron";
import { fileURLToPath } from "url";
import path from "path";
import icon from "../assets/icon.ico";
import { Menu } from "wcpopup-node";
import { Builder } from "./menuBuilder";

const isDev = process.env.NODE_ENV === "development";

const load = (window: BrowserWindow, name: RendererName) => {
    if (isDev) {
        return window.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/${name.toLowerCase()}/index.html`);
    }

    return window.loadFile(fileURLToPath(new URL(`../renderer/${name.toLowerCase()}/index.html`, import.meta.url)));
};

class Helper {
    private settings: Mp.Settings;
    private menuBuilder: Builder;
    private menus: { [key in Mp.ContextMenuName]: Menu };

    constructor(settings: Mp.Settings) {
        this.settings = settings;
        this.menuBuilder = new Builder();
        this.menus = {
            FileList: this.menuBuilder.empty(),
            Favorite: this.menuBuilder.empty(),
        };
    }

    createMainWindow() {
        const window = new BrowserWindow({
            width: this.settings.bounds.width,
            height: this.settings.bounds.height,
            x: this.settings.bounds.x,
            y: this.settings.bounds.y,
            autoHideMenuBar: true,
            show: false,
            icon: nativeImage.createFromDataURL(icon),
            frame: false,
            fullscreenable: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(fileURLToPath(new URL("../preload/preload.js", import.meta.url))),
            },
        });

        load(window, "View");

        return window;
    }

    async popup(name: Mp.ContextMenuName, x: number, y: number) {
        await this.menuBuilder.popup(this.menus[name], x, y);
    }

    createMainContextMenu(name: Mp.ContextMenuName, window: BrowserWindow, onClick: Mp.MainContextMenuCallback<keyof Mp.MainContextMenuSubTypeMap>) {
        this.menus[name] = this.menuBuilder.createMainContextMenu(window, onClick, this.settings);
    }

    createFavContextMenu(name: Mp.ContextMenuName, window: BrowserWindow, onClick: Mp.FavContextMenuCallback<keyof Mp.FavContextMenuSubTypeMap>) {
        this.menus[name] = this.menuBuilder.createFavContextMenu(window, onClick);
    }
}

export { Helper };
