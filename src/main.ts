import Settings from "./settings";
import util from "./util";
import Deferred from "./deferred";
import { DEFAULT_SORT_TYPE, HOME } from "./constants";
import { IPC } from "./ipc";
import { path } from "./path";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
const ipc = new IPC("View");

class Main {
    settings = new Settings();
    searchCache: { [key: string]: string[] } = { "": [] };
    files: Mp.MediaFile[] = [];
    unfilteredFiles: Mp.MediaFile[] = [];
    currentDir = HOME;
    watchTarget = HOME;
    abortPromise: Deferred<boolean> | null = null;

    onMainReady = async (): Promise<Mp.ReadyEvent> => {
        await this.settings.init();
        await ipc.invoke("prepare_menu", undefined);
        const disks = await util.getDriveInfo();

        return {
            settings: this.settings.data,
            data: { files: this.files, disks, directory: this.currentDir, navigation: "Direct", sortType: DEFAULT_SORT_TYPE, failed: false },
        };
    };

    showErrorMessage = async (ex: any | string) => {
        if (typeof ex == "string") {
            await ipc.invoke("message", { dialog_type: "message", message: ex, kind: "error" });
        } else {
            await ipc.invoke("message", { dialog_type: "message", message: ex.message, kind: "error" });
        }
    };

    onSelect = async (e: Mp.SelectEvent): Promise<Mp.LoadEvent | null> => {
        if (e.isFile) {
            this.openFile(e.fullPath);
            return null;
        } else {
            return this.openFolder(e.fullPath, e.navigation);
        }
    };

    private openFile = async (fullPath: string) => {
        const found = await util.exists(fullPath);
        if (!found) {
            await this.showErrorMessage(`"${fullPath}" does not exist.`);
            return;
        }
        await ipc.invoke("open_path", fullPath);
    };

    openFileWith = async (fullPath: string, appPath: string) => {
        await ipc.invoke("open_path_with", { full_path: fullPath, app_path: appPath });
    };

    showAppSelector = async (fullPath: string) => {
        await ipc.invoke("show_app_selector", fullPath);
    };

    private openFolder = async (fullPath: string, navigation: Mp.Navigation): Promise<Mp.LoadEvent | null> => {
        const directory = fullPath;
        const found = await util.exists(directory);
        if (directory != HOME && !found) {
            await this.showErrorMessage(`"${directory}" does not exist.`);
            return null;
        }

        const cacheKey = Object.keys(this.searchCache)[0];
        if (cacheKey != directory) {
            delete this.searchCache[cacheKey];
        }

        const result = await this.readFiles(directory);

        return { files: this.files, directory, navigation, sortType: result.sortType, failed: !result.done };
    };

    openPropertyDielog = async (fileOrId: Mp.MediaFile | string) => {
        const file = typeof fileOrId == "string" ? this.settings.data.favorites.find((file) => file.id == fileOrId) : fileOrId;
        if (!file) return;
        await ipc.invoke("open_property_dielog", file.fullPath);
    };

    startWatch = async () => {
        if (!this.currentDir) return;

        await this.abortWatch();
        this.watchTarget = this.currentDir;
        await ipc.invoke("watch", this.watchTarget);
    };

    abortWatch = async () => {
        if (this.watchTarget == HOME) return;

        await ipc.invoke("unwatch", this.watchTarget);
    };

    readFiles = async (directory: string) => {
        if (directory == HOME) {
            this.abortWatch();
            this.files.length = 0;
            this.currentDir = directory;
            this.watchTarget = directory;
            return {
                done: true,
                sortType: DEFAULT_SORT_TYPE,
            };
        }

        const found = await util.exists(directory);
        if (!found) {
            return {
                done: false,
                sortType: DEFAULT_SORT_TYPE,
            };
        }

        try {
            const allDirents = await ipc.invoke("readdir", { directory, recursive: false });

            this.currentDir = directory;
            this.files.length = 0;
            allDirents
                .filter((dirent) => !dirent.attributes.is_system)
                .map((dirent) => util.toFile(dirent))
                .forEach((file) => this.files.push(file));

            const sortType = this.sortFiles(directory, this.files);

            this.startWatch();

            return {
                done: true,
                sortType,
            };
        } catch (ex: any) {
            this.showErrorMessage(ex);
            return {
                done: false,
                sortType: DEFAULT_SORT_TYPE,
            };
        }
    };

    onSortRequest = (e: Mp.SortRequest): Mp.SortResult => {
        this.sortFiles(this.currentDir, e.files, { asc: e.type.asc, key: e.type.key });
        return { files: this.files, type: e.type };
    };

    onSearchRequest = async (e: Mp.SearchRequest): Promise<Mp.SearchResult> => {
        if (!this.unfilteredFiles.length) {
            this.unfilteredFiles = [...this.files];
        }

        const key = e.key.toLocaleLowerCase();
        if (e.dir in this.searchCache) {
            const filetedFiles = await Promise.all(this.searchCache[e.dir].filter((fullPath) => this.found(path.basename(fullPath), key)).map(async (fullPath) => await util.toFileFromPath(fullPath)));
            return { files: filetedFiles };
        }

        const allDirents = await ipc.invoke("readdir", { directory: e.dir, recursive: true });
        this.searchCache[e.dir] = allDirents.filter((direcnt) => !direcnt.attributes.is_system).map((dirent) => path.join(dirent.parent_path, dirent.name));

        this.files.length = 0;
        const filetedFiles = await Promise.all(this.searchCache[e.dir].filter((fullPath) => this.found(path.basename(fullPath), key)).map(async (fullPath) => await util.toFileFromPath(fullPath)));
        filetedFiles.forEach((file) => this.files.push(file));

        return { files: filetedFiles };
    };

    private found = (value: string, key: string) => {
        if (value.includes(" ") || value.includes("　")) {
            return value.toLocaleLowerCase().includes(key);
        }

        return value.toLocaleLowerCase().startsWith(key);
    };

    onSearchEnd = (): Mp.SearchResult => {
        this.files.length = 0;
        this.unfilteredFiles.forEach((file) => this.files.push(file));
        this.unfilteredFiles = [];

        return { files: this.files };
    };

    renameItem = async (e: Mp.RenameRequest): Promise<Mp.RenameResult> => {
        const fileIndex = this.files.findIndex((file) => file.id == e.data.id);
        const file = this.files[fileIndex];
        const filePath = file.fullPath;
        const newPath = path.join(path.dirname(filePath), e.data.name);

        try {
            const found = await util.exists(newPath);
            if (found) {
                throw new Error(`File name "${e.data.name}" exists`);
            }

            await ipc.invoke("rename", { new: newPath, old: filePath });

            const newMediaFile = await util.updateFile(newPath, file);
            this.files[fileIndex] = newMediaFile;

            return { file: newMediaFile };
        } catch (ex) {
            this.showErrorMessage(ex);
            return { file: file, error: true };
        }
    };

    sortFile = (): Mp.SortResult => {
        const sortType = this.sortFiles(this.currentDir, this.files);
        return { files: this.files, type: sortType };
    };

    sortFiles = (directory: string, files: Mp.MediaFile[], sortType?: Mp.SortType): Mp.SortType => {
        if (sortType) {
            if (Object.keys(this.settings.data.sortHistory).length == 100) {
                const oldestEntry = Object.entries(this.settings.data.sortHistory).reduce((prev, curr) => (prev[1].time < curr[1].time ? prev : curr));
                delete this.settings.data.sortHistory[oldestEntry[0]];
            }
            this.settings.data.sortHistory[directory] = { time: new Date().getTime(), type: sortType };
        }

        const applicableSort = this.settings.data.sortHistory[directory] ? this.settings.data.sortHistory[directory].type : DEFAULT_SORT_TYPE;
        util.sort(files, applicableSort.asc, applicableSort.key);
        return applicableSort;
    };

    onUnmaximize = (): Mp.SettingsChangeEvent => {
        this.settings.data.isMaximized = false;
        return { settings: this.settings.data };
    };

    onMaximize = (): Mp.SettingsChangeEvent => {
        this.settings.data.isMaximized = true;
        return { settings: this.settings.data };
    };

    toggleMaximize = async (view: WebviewWindow) => {
        const maximized = await view.isMaximized();
        if (maximized) {
            view.unmaximize();
            view.setPosition(util.toPhysicalPosition(this.settings.data.bounds));
        } else {
            const position = await view.innerPosition();
            const size = await view.innerSize();
            this.settings.data.bounds = util.toBounds(position, size);
            await view.maximize();
        }
        this.settings.data.isMaximized = !maximized;
    };

    closeWindow = async (view: WebviewWindow) => {
        await this.abortWatch();

        if (!this.settings.data.isMaximized) {
            const position = await view.innerPosition();
            const size = await view.innerSize();
            this.settings.data.bounds = util.toBounds(position, size);
        }

        await this.settings.save();

        await view.close();
    };

    openListContextMenu = async (e: Mp.Position, fullPath: string) => {
        await ipc.invoke("open_list_context_menu", { position: e, full_path: fullPath });
    };

    openFavContextMenu = async (e: Mp.Position) => {
        await ipc.invoke("open_fav_context_menu", e);
    };

    openConfigFileJson = async () => {
        await ipc.invoke("open_path", this.settings.getFilePath());
    };

    onWidthChange = (e: Mp.WidthChangeEvent) => {
        this.settings.data.leftAreaWidth = e.leftWidth;
        this.settings.data.headerLabels = e.labels;
    };

    reload = async (): Promise<Mp.LoadEvent> => {
        const result = await this.readFiles(this.currentDir);
        return { files: this.files, directory: this.currentDir, navigation: "Reload", sortType: result.sortType, failed: !result.done };
    };

    startDrag = async (files: string[]) => {
        await ipc.invoke("start_drag", files);
    };

    createItem = async (e: Mp.CreateItemRequest): Promise<Mp.CreateItemResult> => {
        const fullPath = path.join(e.file.dir, e.file.name);

        try {
            if (e.file.isFile) {
                await ipc.invoke("create", fullPath);
            } else {
                await ipc.invoke("mkdir", fullPath);
            }
            const newFile = await util.toFileFromPath(fullPath);
            this.files.push(newFile);
            this.sortFiles(this.currentDir, this.files);
            return { files: this.files, newItemId: newFile.id, success: true };
        } catch (ex: any) {
            this.showErrorMessage(ex);
            return { files: this.files, newItemId: "", success: false };
        }
    };

    trashItems = async (e: Mp.TrashItemRequest): Promise<Mp.LoadEvent | null> => {
        try {
            const fullPaths = e.files.map((file) => file.fullPath);
            await ipc.invoke("trash", fullPaths);
            return this.reload();
        } catch (ex: any) {
            this.showErrorMessage(ex);
            return null;
        }
    };

    beforeMoveItems = async (directory: string, fullPaths: string[]) => {
        let cancelAll = false;

        const mapped = await Promise.all(
            fullPaths.map(async (fullPath) => {
                const dist = path.join(directory, path.basename(fullPath));

                if (dist == fullPath) return null;

                if (cancelAll) return null;

                const found = await util.exists(dist);
                if (found) {
                    const isOK = await ipc.invoke("message", {
                        dialog_type: "confirm",
                        message: `宛先には既に${path.basename(fullPath)}という名前のファイルが存在します\nファイルを置き換えますか`,
                        kind: "warning",
                        ok_label: "ファイルを置き換える",
                        cancel_label: "ファイルは置き換えずスキップする",
                    });

                    if (!isOK) {
                        cancelAll = true;
                        return null;
                    }
                }

                return fullPath;
            })
        );
        return mapped.filter((item) => item != null);
    };

    moveItems = async (e: Mp.MoveItemsRequest): Promise<Mp.MoveItemResult> => {
        if (path.dirname(e.fullPaths[0]) == e.dir) {
            return { files: this.files, done: false };
        }

        const targetFiles = navigator.userAgent.includes("Linux") ? await this.beforeMoveItems(e.dir, e.fullPaths) : e.fullPaths;

        if (!targetFiles.length) {
            return { files: this.files, done: false };
        }

        try {
            const from = e.fullPaths;
            const to = e.dir;
            if (e.copy) {
                await ipc.invoke("copy", { from, to });
            } else {
                await ipc.invoke("mv", { from, to });
            }
        } catch (ex: any) {
            this.showErrorMessage(ex);
        } finally {
            await this.readFiles(this.currentDir);
            return { files: this.files, done: true };
        }
    };

    removeFavorite = (id: string): Mp.MediaFile[] => {
        const newFavorites = this.settings.data.favorites.filter((file) => file.id != id);
        this.settings.data.favorites = newFavorites;
        return this.settings.data.favorites;
    };

    onPaste = async (): Promise<Mp.MoveItemResult | null> => {
        if (!this.currentDir) return null;

        const uriAvailable = await ipc.invoke("is_uris_available", undefined);
        if (uriAvailable) {
            const data = await ipc.invoke("read_uris", undefined);
            if (!data.urls.length) return null;

            const copy = data.operation == "None" ? util.getRootDirectory(data.urls[0]) != util.getRootDirectory(this.currentDir) : data.operation == "Copy";

            return this.moveItems({ fullPaths: data.urls, dir: this.currentDir, copy });
        }

        return null;
    };

    writeClipboard = async (e: Mp.WriteClipboardRequest) => {
        const fullPaths = e.files.map((file) => file.fullPath);
        await ipc.invoke("write_uris", { fullPaths, operation: e.operation });
    };

    writeFullpathToClipboard = async (fullPaths: string) => {
        await ipc.invoke("write_text", fullPaths);
    };

    addFavorite = (favorite: Mp.MediaFile): Mp.MediaFile[] => {
        this.settings.data.favorites.push(favorite);
        return this.settings.data.favorites;
    };

    openTerminal = async (dir: string) => {
        await ipc.invoke("open_terminal", dir);
    };

    launchNew = async () => {
        await ipc.invoke("launch_new", undefined);
    };
}

const main = new Main();

export default main;
