import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import Settings from "./settings";
import util from "./util";
import { DEFAULT_SORT_TYPE, HOME, OS } from "./constants";
import { IPC } from "./ipc";
import { path } from "./path";
import { History } from "./history";
import { t } from "./translation/useTranslation";

const ipc = new IPC("View");

class Main {
    private settings = new Settings();
    private searchCache: { [key: string]: string[] } = { "": [] };
    private searchKeyword = "";
    private files: Mp.MediaFile[] = [];
    private searchBackup: Mp.MediaFile[] = [];
    private currentDir = HOME;
    private watchTarget = HOME;
    private history = new History();

    onMainReady = async (): Promise<Mp.ReadyEvent> => {
        await this.settings.init();
        await ipc.invoke("prepare_menu", undefined);
        const disks = await util.getDriveInfo();

        const args = await ipc.invoke("get_args", undefined);

        let selectId;
        if (args.urls.length) {
            const item = await util.toFileFromPath(args.urls[0]);
            if (item.isFile) {
                selectId = item.id;
                await this.readFiles(item.dir);
            } else {
                await this.readFiles(item.fullPath);
            }
        }

        const locale = args.locales.some((locale) => locale.toLowerCase().includes("ja")) ? "ja" : "en";
        return {
            settings: this.settings.data,
            locale,
            data: { files: this.files, disks, directory: this.currentDir, navigation: "Direct", sortType: DEFAULT_SORT_TYPE, failed: false },
            selectId,
        };
    };

    private showErrorMessage = async (ex: any | string) => {
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
        await ipc.invoke("open_path_with", { full_path: `"${fullPath}"`, app_path: appPath });
    };

    openInNewWindow = async (fullPath: string) => {
        await ipc.invoke("open_in_new_window", fullPath);
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

    startWatch = async (recursive: boolean) => {
        if (!this.currentDir) return;

        await this.abortWatch();
        this.watchTarget = this.currentDir;
        await ipc.invoke("watch", { path: this.watchTarget, recursive });
    };

    abortWatch = async () => {
        if (this.watchTarget == HOME) return;

        await ipc.invoke("unwatch", this.watchTarget);
    };

    readFiles = async (directory: string) => {
        if (directory == HOME) {
            this.abortWatch();
            this.files = [];
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

            this.files = allDirents.filter((dirent) => !dirent.attributes.is_system).map((dirent) => util.toFile(dirent));

            const sortType = this.sortFiles(directory, this.files);

            if (this.currentDir != directory) {
                this.startWatch(false);
            }

            this.currentDir = directory;

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

    sort = (e: Mp.SortRequest): Mp.SortResult => {
        this.sortFiles(this.currentDir, e.files, { asc: e.type.asc, key: e.type.key });
        return { files: this.files, type: e.type };
    };

    search = async (e: Mp.SearchRequest): Promise<Mp.SearchResult> => {
        if (!this.searchBackup.length) {
            this.searchBackup = [...this.files];
            // In search, all items needs to be listed, so watch recursively
            this.startWatch(true);
        }

        const key = e.key.toLocaleLowerCase();
        this.searchKeyword = key;
        if (e.dir in this.searchCache) {
            this.files = await this.filterCache(e.dir, key);
            return { files: this.files };
        }

        const allDirents = await ipc.invoke("readdir", { directory: e.dir, recursive: true });
        this.searchCache[e.dir] = allDirents.filter((direcnt) => !direcnt.attributes.is_system).map((dirent) => path.join(dirent.parent_path, dirent.name));

        this.files = await this.filterCache(e.dir, key);
        this.sortFiles(this.currentDir, this.files);
        return { files: this.files };
    };

    private filterCache = async (dir: string, key: string) => {
        const fildtered = this.searchCache[dir].filter((fullPath) => this.isSearchFileFound(path.basename(fullPath), key));
        return await Promise.all(fildtered.map(async (fullPath) => await util.toFileFromPath(fullPath)));
    };

    private isSearchFileFound = (value: string, key: string) => {
        const withoutExt = value.replace(path.extname(value), "").toLocaleLowerCase();
        const strippedText = withoutExt.replace(/[\!#\$\%&'\(\)\=\~\^\-\|`@\{\[\+;\]\}\,\_\s]/g, " ").split(" ");
        return strippedText.some((s) => s.toLocaleLowerCase().startsWith(key)) || withoutExt == key || withoutExt.startsWith(key);
    };

    onSearchEnd = async (temporal: boolean): Promise<Mp.SearchResult> => {
        if (this.searchBackup.length) {
            this.sortFiles(this.currentDir, this.searchBackup);
            this.files = [...this.searchBackup];
            this.searchBackup = [];
            this.searchKeyword = "";
        }

        // If temporarily ended for refresh, don't change watch recursive mode
        if (!temporal) {
            this.startWatch(false);
        }

        return { files: this.files };
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

    reload = async (includeDrive: boolean): Promise<Mp.LoadEvent> => {
        const result = await this.readFiles(this.currentDir);
        const disks = includeDrive ? await util.getDriveInfo() : undefined;
        return { files: this.files, disks, directory: this.currentDir, navigation: "Reload", sortType: result.sortType, failed: !result.done };
    };

    startDrag = async (files: string[]) => {
        await ipc.invoke("start_drag", files);
    };

    removeFavorite = (id: string): Mp.MediaFile[] => {
        const newFavorites = this.settings.data.favorites.filter((file) => file.id != id);
        this.settings.data.favorites = newFavorites;
        return this.settings.data.favorites;
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

    private getNewName = async (isFile: boolean) => {
        const name = isFile ? t("newFile") : t("newFolder");
        const found = await util.exists(path.join(this.currentDir, isFile ? `${name}.txt` : name));
        if (!found) return name;

        let number = 1;
        for (const _ of [...Array(100)]) {
            const uniqueName = `${name}(${number})`;
            const found = await util.exists(path.join(this.currentDir, isFile ? `${uniqueName}.txt` : uniqueName));
            if (!found) return uniqueName;
            number++;
        }
        return `${name}(${number})`;
    };

    createItem = async (isFile: boolean): Promise<Mp.CreateItemResult> => {
        const itemName = await this.getNewName(isFile);
        const fullPath = path.join(this.currentDir, isFile ? `${itemName}.txt` : itemName);

        try {
            if (isFile) {
                await ipc.invoke("create", fullPath);
            } else {
                await ipc.invoke("mkdir", fullPath);
            }

            this.trackOperation("Create", [], "", [fullPath], isFile);

            const newItemId = encodeURIComponent(fullPath);
            return { newItemId, success: true };
        } catch (ex: any) {
            this.showErrorMessage(ex);
            return { newItemId: "", success: false };
        }
    };

    renameItem = async (fullPath: string, newName: string): Promise<Mp.RenameResult> => {
        const fileIndex = this.files.findIndex((file) => file.fullPath == fullPath);

        const file = this.files[fileIndex];
        const filePath = file.fullPath;
        const newPath = path.join(path.dirname(filePath), newName);

        try {
            const found = await util.exists(newPath);
            if (found) {
                throw new Error(`File name "${newName}" exists`);
            }

            await ipc.invoke("rename", { new: newPath, old: filePath });

            this.trackOperation("Rename", [filePath], newPath, []);

            return {
                done: true,
                newId: encodeURIComponent(newPath),
            };
        } catch (ex) {
            this.showErrorMessage(ex);
            return {
                done: false,
                newId: "",
            };
        }
    };

    trashItems = async (e: Mp.TrashItemRequest) => {
        try {
            const fullPaths = e.files.map((file) => file.fullPath);
            await ipc.invoke("trash", fullPaths);

            this.trackOperation("Trash", [], "", fullPaths);
        } catch (ex: any) {
            this.showErrorMessage(ex);
        }
    };

    deleteItems = async (e: Mp.TrashItemRequest) => {
        try {
            const confimed = await ipc.invoke("message", { dialog_type: "confirm", kind: "info", message: "このファイルを完全に削除しますか？", ok_label: t("yes"), cancel_label: t("no") });
            if (!confimed) return;

            const fullPaths = e.files.map((file) => file.fullPath);
            await ipc.invoke("delete", fullPaths);
        } catch (ex: any) {
            this.showErrorMessage(ex);
        }
    };

    private beforeMoveItems = async (directory: string, fullPaths: string[]) => {
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
                        message: t("destExistsConfirm").replace("{}", path.basename(fullPath)),
                        kind: "warning",
                        ok_label: t("destExistsOkLabel"),
                        cancel_label: t("destExistsCancelLabel"),
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

    getUrlsFromClipboard = async (targets: Mp.MediaFile[], operation: Mp.ClipboardOperation): Promise<Mp.PasteData> => {
        const failedResult = { fullPaths: [], dir: this.currentDir, copy: true };
        if (!this.currentDir) return failedResult;

        const uriAvailable = await ipc.invoke("is_uris_available", undefined);

        if (!uriAvailable) return failedResult;

        const data = await ipc.invoke("read_uris", undefined);
        if (!data.urls.length) return failedResult;

        let isCopy = this.isClipboardCopy(targets, operation, data.urls, data.operation);
        return { fullPaths: data.urls, dir: this.currentDir, copy: isCopy };
    };

    private isClipboardCopy(targets: Mp.MediaFile[], internalOperation: Mp.ClipboardOperation, externalUrls: string[], externalOperation: Mp.ClipboardOperation): boolean {
        if (!targets.length) {
            return externalOperation == "None" ? true : externalOperation == "Copy";
        }

        const urls = externalUrls.sort();
        const isInternalOperation = targets
            .map((file) => file.fullPath)
            .sort()
            .every((fullPath, index) => fullPath == urls[index]);

        if (isInternalOperation) {
            return internalOperation == "Copy";
        }

        return true;
    }

    moveItems = async (e: Mp.MoveItemsRequest): Promise<Mp.MoveItemResult> => {
        const targetFiles = navigator.userAgent.includes(OS.linux) ? await this.beforeMoveItems(e.dir, e.fullPaths) : e.fullPaths;

        if (!targetFiles.length) {
            return { fullPaths: [], done: false };
        }

        const movedPaths = targetFiles.map((fullPath) => path.join(e.dir, path.basename(fullPath)));

        try {
            const from = e.fullPaths;
            const to = e.dir;
            if (e.copy) {
                await ipc.invoke("copy", { from, to });
            } else {
                await ipc.invoke("mv", { from, to });
            }
            this.trackOperation(e.copy ? "Copy" : "Move", from, to, []);
            return {
                fullPaths: movedPaths,
                done: true,
            };
        } catch (ex: any) {
            this.showErrorMessage(ex);
            return { fullPaths: [], done: true };
        }
    };

    onWatchEvent = async (e: Mp.WatchEvent) => {
        const hasSearchCache = this.currentDir in this.searchCache;

        switch (e.operation) {
            case "Create": {
                if (hasSearchCache) {
                    // Add to cache anyway
                    this.searchCache[this.currentDir].push(...e.to_paths);
                }

                if (this.searchBackup.length) {
                    const pathsInSearch = e.to_paths.filter((fullPath) => this.isSearchFileFound(path.basename(fullPath), this.searchKeyword));
                    const pathsInCurrent = e.to_paths.filter((fullPath) => path.dirname(fullPath) == this.currentDir);
                    // Add to files only if the paths match the search keyword
                    if (pathsInSearch.length) {
                        const newItems = await Promise.all(pathsInSearch.map(async (fullPath) => await util.toFileFromPath(fullPath)));
                        this.files.push(...newItems);
                    }

                    // Add to backup only if the paths belongs to current dir
                    if (pathsInCurrent.length) {
                        const newItems = await Promise.all(pathsInCurrent.map(async (fullPath) => await util.toFileFromPath(fullPath)));
                        this.searchBackup.push(...newItems);
                    }
                } else {
                    const newItems = await Promise.all(e.to_paths.map(async (fullPath) => await util.toFileFromPath(fullPath)));
                    this.files.push(...newItems);
                }

                break;
            }
            case "Remove": {
                this.files = this.files.filter((file) => !e.to_paths.includes(file.fullPath));

                if (this.searchBackup.length) {
                    this.searchBackup = this.searchBackup.filter((file) => !e.to_paths.includes(file.fullPath));
                }

                if (hasSearchCache) {
                    this.searchCache[this.currentDir] = this.searchCache[this.currentDir].filter((fullPath) => !e.to_paths.includes(fullPath));
                }
                break;
            }
            case "Rename": {
                const newFullPath = e.to_paths[0];
                const oldFullPath = e.from_paths[0];
                const fileIndex = this.files.findIndex((file) => file.fullPath == oldFullPath);
                const newMediaFile = await util.toFileFromPath(newFullPath);
                this.files[fileIndex] = newMediaFile;

                if (this.searchBackup.length) {
                    const fileIndex = this.searchBackup.findIndex((file) => file.fullPath == oldFullPath);
                    this.searchBackup[fileIndex] = newMediaFile;
                }
                if (hasSearchCache) {
                    const index = this.searchCache[this.currentDir].findIndex((fullPath) => fullPath == oldFullPath);
                    this.searchCache[this.currentDir][index] = newFullPath;
                }
                break;
            }
        }

        this.sortFiles(this.currentDir, this.files);
        return this.files;
    };

    private trackOperation = (operation: Mp.Operation, from: string[], to: string, target: string[], isFile = true) => {
        const fileOperation: Mp.FileOperation = {
            operation,
            from,
            to,
            target,
            isFile,
        };
        this.history.push(fileOperation);
    };

    /* Do nothing to files which will be changed by watcher */
    undo = async () => {
        const fileOperation = await this.history.undo();
        if (!fileOperation) return;

        try {
            switch (fileOperation.operation) {
                case "Move":
                    await ipc.invoke("mv", { from: fileOperation.from, to: fileOperation.to });
                    break;

                case "Delete":
                    await ipc.invoke("delete", fileOperation.target);
                    break;

                case "Undelete":
                    await ipc.invoke("undelete", fileOperation.target);
                    break;

                case "Rename":
                    await ipc.invoke("rename", { old: fileOperation.from[0], new: fileOperation.to });
                    break;
            }
        } catch (ex: any) {
            /* Remove operation includes both of trash and delete. So ignore undelete error. */
            if (fileOperation.operation != "Undelete") {
                this.history.rollback();
                this.showErrorMessage(ex);
            }
        }
    };

    redo = async () => {
        const fileOperation = await this.history.redo();

        if (!fileOperation) return;

        try {
            switch (fileOperation.operation) {
                case "Copy":
                    await ipc.invoke("copy", { from: fileOperation.from, to: fileOperation.to });
                    break;

                case "Move":
                    await ipc.invoke("mv", { from: fileOperation.from, to: fileOperation.to });
                    break;

                case "Create":
                    if (fileOperation.isFile) {
                        await ipc.invoke("create", fileOperation.target[0]);
                    } else {
                        await ipc.invoke("mkdir", fileOperation.target[0]);
                    }
                    break;

                case "Trash":
                    await ipc.invoke("trash", fileOperation.target);
                    break;

                case "Rename":
                    await ipc.invoke("rename", { old: fileOperation.from[0], new: fileOperation.to });
            }
        } catch (ex: any) {
            this.history.rollback();
            this.showErrorMessage(ex);
        }
    };
}

const main = new Main();

export default main;
