import { confirm, message } from "@tauri-apps/plugin-dialog";
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
        await ipc.invoke("prepare_menu", { allowExecute: this.settings.data.allowExecute });
        const disks = await util.getDriveInfo();

        return {
            settings: this.settings.data,
            data: { files: this.files, disks, directory: this.currentDir, navigation: "Direct", sortType: DEFAULT_SORT_TYPE, failed: false },
        };
    };

    showErrorMessage = async (ex: any | string) => {
        if (typeof ex == "string") {
            await message(ex, { kind: "error" });
        } else {
            await message(ex.message, { kind: "error" });
        }
    };

    onSelect = async (e: Mp.SelectEvent, ignoreSettings: boolean): Promise<Mp.LoadEvent | null> => {
        if (e.isFile) {
            this.openFile(e.fullPath, ignoreSettings);
            return null;
        } else {
            return this.openFolder(e.fullPath, e.navigation);
        }
    };

    private openFile = async (fullPath: string, ignoreSettings: boolean) => {
        if (this.settings.data.allowExecute || ignoreSettings) {
            if (!util.exists(fullPath)) {
                await this.showErrorMessage(`"${fullPath}" does not exist.`);
                return;
            }
            await ipc.invoke("open_path", fullPath);
        }
    };

    openFileWith = async (fullPath: string) => {
        await ipc.invoke("open_path_with", fullPath);
    };

    private openFolder = async (fullPath: string, navigation: Mp.Navigation): Promise<Mp.LoadEvent | null> => {
        const directory = fullPath;

        if (directory != HOME && !util.exists(directory)) {
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

        const key = e.key.toLowerCase();
        if (e.dir in this.searchCache) {
            const filetedFiles = await Promise.all(
                this.searchCache[e.dir].filter((fullPath) => path.basename(fullPath).toLowerCase().startsWith(key)).map(async (fullPath) => await util.toFileFromPath(fullPath))
            );
            return { files: filetedFiles };
        }

        const allDirents = await ipc.invoke("readdir", { directory: e.dir, recursive: true });
        this.searchCache[e.dir] = allDirents.filter((direcnt) => !direcnt.attributes.is_system).map((dirent) => path.join(dirent.parent_path, dirent.name));
        this.files.length = 0;
        const filetedFiles = await Promise.all(
            this.searchCache[e.dir].filter((fullPath) => path.basename(fullPath).toLowerCase().startsWith(key)).map(async (fullPath) => await util.toFileFromPath(fullPath))
        );
        filetedFiles.forEach((file) => this.files.push(file));
        return { files: filetedFiles };
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
            if (await util.exists(newPath)) {
                throw new Error(`File name "${e.data.name}" exists`);
            }

            await ipc.invoke("rename", { new: newPath, old: filePath });

            const newMediaFile = util.updateFile(newPath, file);
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

    openListContextMenu = async (e: Mp.Position) => {
        await ipc.invoke("open_list_context_menu", e);
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
            await Promise.all(e.files.map(async (item) => await ipc.invoke("trash_item", item.fullPath)));
            return this.reload();
        } catch (ex: any) {
            this.showErrorMessage(ex);
            return null;
        }
    };

    beforeMoveItems = async (directory: string, files: Mp.MediaFile[]) => {
        let cancelAll = false;

        const mapped = await Promise.all(
            files.map(async (item) => {
                const dist = path.join(directory, item.name);

                if (dist == item.fullPath) return null;

                if (cancelAll) return null;

                const found = await util.exists(dist);
                if (found) {
                    const isOK = await confirm(`宛先には既に${item.name}という名前のファイルが存在します\nファイルを置き換えますか`, {
                        kind: "warning",
                        okLabel: "ファイルを置き換える",
                        cancelLabel: "ファイルは置き換えずスキップする",
                    });

                    if (!isOK) {
                        cancelAll = true;
                        return null;
                    }
                }

                return item;
            })
        );
        return mapped.filter((item) => item != null);
    };

    moveItems = async (e: Mp.MoveItemsRequest): Promise<Mp.MoveItemResult> => {
        const targetFiles = await this.beforeMoveItems(e.dir, e.files);

        if (!targetFiles.length) {
            return { files: this.files, done: false };
        }

        const movedFiles: Mp.MediaFile[] = [];

        try {
            await Promise.all(
                targetFiles.map(async (item) => {
                    const dist = path.join(e.dir, item.name);

                    if (e.copy) {
                        await ipc.invoke("copy_file", { from: item.fullPath, to: dist });
                    } else {
                        await ipc.invoke("mv", { from: item.fullPath, to: dist });
                    }

                    const moved = await util.toFileFromPath(dist);
                    movedFiles.push(moved);
                })
            );
        } catch (ex: any) {
            this.showErrorMessage(ex);
        } finally {
            await this.readFiles(this.currentDir);
            return { movedItems: movedFiles, files: this.files, done: true };
        }
    };

    removeFavorite = (id: string): Mp.MediaFile[] => {
        const newFavorites = this.settings.data.favorites.filter((file) => file.id != id);
        this.settings.data.favorites = newFavorites;
        return this.settings.data.favorites;
    };

    onPaste = async (): Promise<Mp.MoveItemResult | null> => {
        if (!this.currentDir) return null;

        if (await ipc.invoke("is_uris_available", undefined)) {
            const data = await ipc.invoke("read_uris", undefined);
            if (!data.urls.length) return null;

            const files = await Promise.all(data.urls.map(async (fullPath) => await util.toFileFromPath(fullPath)));
            if (!files.length) return null;

            const copy = data.operation == "None" ? util.getRootDirectory(files[0].fullPath) != util.getRootDirectory(this.currentDir) : data.operation == "Copy";
            return this.moveItems({ files, dir: this.currentDir, copy });
        } else {
            const text = await ipc.invoke("read_text", undefined);
            if (text) {
                const fullPaths = text.split("\r\n");
                const files = await Promise.all(fullPaths.map(async (fullPath) => await util.toFileFromPath(fullPath)));
                if (!files.length) return null;

                const copy = util.getRootDirectory(files[0].fullPath) != util.getRootDirectory(this.currentDir);
                return this.moveItems({ files, dir: this.currentDir, copy });
            } else {
                return null;
            }
        }
    };

    writeClipboard = async (e: Mp.WriteClipboardRequest) => {
        if (this.settings.data.allowWriteClipboard) {
            const fullPaths = e.files.map((file) => file.fullPath);
            await ipc.invoke("write_uris", { fullPaths, operation: e.operation });
        } else {
            const fullPaths = e.files.map((file) => file.fullPath).join("\r\n");
            await ipc.invoke("write_text", fullPaths);
        }
    };

    writeFullpathToClipboard = async (fullPaths: string) => {
        await ipc.invoke("write_text", fullPaths);
    };

    addFavorite = (favorite: Mp.MediaFile): Mp.MediaFile[] => {
        this.settings.data.favorites.push(favorite);
        return this.settings.data.favorites;
    };

    toggleAllowExecute = () => {
        this.settings.data.allowExecute = !this.settings.data.allowExecute;
    };
}

const main = new Main();

export default main;
