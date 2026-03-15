import util from "./util";
import { HOME, OS, DEFAULT_LABLES } from "./constants";
import { DeleteUndeleteRequest, Dirent, IPC, RecycleBinItem } from "./ipc";
import { path } from "./path";
import { History } from "./history";
import { t } from "./translation/useTranslation";
import { dispatch, icons, listState, settings } from "./view/appStateReducer.svelte";

const ipc = new IPC("View");

class Main {
    private initialized = false;
    private searchCache: { [key: string]: string[] } = { "": [] };
    private searchKeyword = "";
    private searchBackup: Mp.MediaFile[] = [];
    private watchTarget = HOME;
    private history = new History();
    private pendingRenameFrom = "";

    onMainReady = async (dropTagetId: string): Promise<Mp.ReadyEvent> => {
        const drives = await util.getDriveInfo();

        const args = await ipc.invoke("get_args", undefined);

        const locale = args.locales.some((locale) => locale.toLowerCase().includes("ja")) ? "ja" : "en";
        window.lang = locale;

        if (!this.initialized) {
            await ipc.invoke("prepare_menu", this.createColumnMenuItesm());
            await ipc.invoke("listen_devices", undefined);
            await ipc.invoke("listen_file_drop", dropTagetId);
        }

        let selectId;
        const item = args.urls.length ? await util.toFileFromPath(args.urls[0]) : null;
        let files: Mp.MediaFile[] = [];
        let directory = HOME;
        if (item) {
            if (item.isFile) {
                selectId = item.id;
                directory = item.dir;
                const result = await this.readFiles(item.dir);
                files = result.files;
            } else {
                directory = item.fullPath;
                const result = await this.readFiles(item.fullPath);
                files = result.files;
            }
        }

        this.initialized = true;

        return {
            locale,
            data: {
                files,
                drives,
                directory,
                navigation: "Direct",
                failed: false,
            },
            selectId,
            restorePosition: args.restore_position,
        };
    };

    private createColumnMenuItesm = () => {
        return DEFAULT_LABLES.filter((column) => column.sortKey != "name" && column.sortKey != "directory").map((column) => {
            return {
                sortKey: column.sortKey,
                label: util.getColumnLabel(column.sortKey),
                visible: true,
            };
        });
    };

    onSelect = async (e: Mp.SelectEvent): Promise<Mp.LoadEvent | null> => {
        if (e.isFile) {
            await this.openFile(e.fullPath);
            return null;
        } else {
            return await this.openFolder(e.fullPath, e.navigation);
        }
    };

    private openFile = async (fullPath: string) => {
        const found = await util.exists(fullPath);
        if (!found) {
            await util.showErrorMessage(`"${fullPath}" does not exist.`);
            return;
        }
        await ipc.invoke("open_path", fullPath);
    };

    private openFolder = async (directory: string, navigation: Mp.Navigation): Promise<Mp.LoadEvent | null> => {
        if (util.isHome(directory)) {
            const drives = await util.getDriveInfo();
            return { files: [], directory, navigation, failed: false, drives };
        }

        if (!util.isRecycleBin(directory)) {
            const found = await util.exists(directory);
            if (!found) {
                await util.showErrorMessage(`"${directory}" does not exist.`);
                return null;
            }
        }

        const cacheKey = Object.keys(this.searchCache)[0];
        if (cacheKey != directory) {
            delete this.searchCache[cacheKey];
        }

        const result = await this.readFiles(directory);

        return {
            files: result.files,
            directory,
            navigation,
            failed: !result.done,
        };
    };

    readFiles = async (directory: string): Promise<Mp.ReadResult> => {
        this.searchBackup = [];

        if (util.isHome(directory)) {
            this.abortWatch();
            this.watchTarget = directory;
            return {
                done: true,
                files: [],
            };
        }

        try {
            const fileMap: { [key: string]: string } = {};
            const allDirents = util.isRecycleBin(directory) ? await ipc.invoke("read_recycle_bin", undefined) : await ipc.invoke("readdir", { directory, recursive: false });
            const files = allDirents
                .filter((dirent) => !dirent.attributes.is_system)
                .map((dirent) => {
                    const file = util.isRecycleBin(directory) ? util.toFileFromRecycleBinItem(dirent as RecycleBinItem) : util.toFile(dirent as Dirent);
                    if (settings.data.useOSIcon) {
                        if (file.isFile && !(file.actualExtension in icons.cache)) {
                            file.fileType == "App" ? (fileMap[file.name] = file.fullPath) : (fileMap[file.actualExtension] = file.fullPath);
                        }
                    }
                    return file;
                });

            if (Object.keys(fileMap).length) {
                setTimeout(() => {
                    this.getFileIcon(fileMap);
                });
            }

            this.startWatch(directory);

            return {
                done: true,
                files,
            };
        } catch (ex: any) {
            util.showErrorMessage(ex);
            return {
                done: false,
                files: [],
            };
        }
    };

    private getFileIcon = async (fileMap: { [key: string]: string }) => {
        const iconInfoMap = await ipc.invoke("assoc_icons", Object.values(fileMap));

        Object.keys(iconInfoMap).forEach((key) => {
            const smallArray = Uint8Array.from(iconInfoMap[key].small);
            const smallBase64 = smallArray.toBase64();

            if (iconInfoMap[key].full_path?.toLowerCase().endsWith("svg")) {
                const small = `data:image/svg+xml;base64,${smallBase64}`;
                const large = `data:image/svg+xml;base64,${smallBase64}`;
                dispatch({ type: "updateIconCache", value: { key, small, large } });
            } else {
                const small = `data:image/png;base64,${smallBase64}`;
                const largeArray = Uint8Array.from(iconInfoMap[key].large);
                const largeBase64 = largeArray.toBase64();
                const large = navigator.userAgent.includes(OS.windows) ? `data:image/png;base64,${largeBase64}` : `data:image/png;base64,${smallBase64}`;
                dispatch({ type: "updateIconCache", value: { key, small, large } });
            }
        });
    };

    reload = async (includeDrive: boolean): Promise<Mp.LoadEvent | null> => {
        if (util.isHome(listState.currentDir.fullPath)) {
            return null;
        }
        const result = await this.readFiles(listState.currentDir.fullPath);
        const drives = includeDrive ? await util.getDriveInfo() : undefined;
        return {
            files: result.files,
            drives,
            directory: listState.currentDir.fullPath,
            navigation: "Reload",
            failed: !result.done,
        };
    };

    search = async (files: Mp.MediaFile[], e: Mp.SearchRequest): Promise<Mp.MediaFile[]> => {
        if (!this.searchBackup.length) {
            this.searchBackup = structuredClone(files);
        }

        const key = e.key.toLocaleLowerCase();
        this.searchKeyword = key;
        if (e.dir in this.searchCache) {
            return await this.filterCache(e.dir, key);
        }

        let searchResult: Mp.MediaFile[] = [];
        if (util.isRecycleBin(e.dir)) {
            searchResult = this.filterRecycleBin(files, key);
        } else {
            const allDirents = await ipc.invoke("readdir", { directory: e.dir, recursive: true });
            this.searchCache[e.dir] = allDirents.filter((direcnt) => !direcnt.attributes.is_system).map((dirent) => path.join(dirent.parent_path, dirent.name));
            searchResult = await this.filterCache(e.dir, key);
        }

        util.sort(searchResult, true, "name");
        return searchResult;
    };

    private filterCache = async (dir: string, key: string) => {
        const fildtered = this.searchCache[dir].filter((fullPath) => this.isSearchFileFound(path.basename(fullPath), key));
        return await Promise.all(fildtered.map(async (fullPath) => await util.toFileFromPath(fullPath)));
    };

    private filterRecycleBin = (files: Mp.MediaFile[], key: string) => {
        return files.filter((file) => this.isSearchFileFound(file.name, key));
    };

    private isSearchFileFound = (value: string, key: string) => {
        const strippedKey = key.replace(/[\!#\$\%&'\(\)\=\~\^\-\|`@\{\[\+;\]\}\,\_\s]/g, "");
        const strippedText = value.toLocaleLowerCase().replace(/[\!#\$\%&'\(\)\=\~\^\-\|`@\{\[\+;\]\}\,\_\s]/g, "");
        return strippedText.includes(strippedKey);
    };

    onSearchEnd = (): Mp.MediaFile[] => {
        const files = structuredClone(this.searchBackup);
        this.searchBackup = [];
        this.searchKeyword = "";

        return files;
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

    openPropertyDielog = async (fileOrId: Mp.MediaFile | string) => {
        const file = typeof fileOrId == "string" ? settings.data.favorites.find((file) => file.id == fileOrId) : fileOrId;
        if (!file) return;
        await ipc.invoke("open_property_dielog", file.fullPath);
    };

    isWatchable = () => {
        if (!this.watchTarget) return false;
        if (util.isHome(this.watchTarget)) return false;
        if (util.isRecycleBin(this.watchTarget)) return false;

        return true;
    };

    isNetwork = () => {
        return util.isWsl(this.watchTarget);
    };

    startWatch = (target: string) => {
        this.abortWatch();
        this.watchTarget = target;

        if (this.isWatchable()) {
            ipc.invoke("watch", { path: this.watchTarget, network: this.isNetwork() });
        }
    };

    abortWatch = () => {
        if (!this.isWatchable()) return;
        ipc.invoke("unwatch", { path: this.watchTarget, network: this.isNetwork() });
        this.watchTarget = "";
    };

    beforeCloseWindow = async () => {
        this.abortWatch();
        await ipc.invoke("unlisten_devices", undefined);
        await ipc.invoke("unlisten_file_drop", undefined);
    };

    openListContextMenu = async (e: Mp.Position, fullPath: string, showAdminRunAs: boolean, inRecycleBin: boolean) => {
        if (inRecycleBin) {
            await ipc.invoke("open_recycle_context_menu", { position: e, full_path: fullPath, show_admin_runas: showAdminRunAs });
        } else {
            await ipc.invoke("open_list_context_menu", { position: e, full_path: fullPath, show_admin_runas: showAdminRunAs });
        }
    };

    openFavContextMenu = async (e: Mp.Position) => {
        await ipc.invoke("open_fav_context_menu", e);
    };

    openColumnContextMenu = async (position: Mp.Position) => {
        await ipc.invoke("open_column_context_menu", { position, items: listState.columns, is_recycle_bin: listState.isRecycleBin });
    };

    openConfigFileJson = async (settingsPath: string) => {
        await ipc.invoke("open_path", settingsPath);
    };

    changeTheme = async (theme: Mp.Theme) => {
        await ipc.invoke("change_theme", theme);
    };

    changeAppMenuItems = async () => {
        await ipc.invoke("change_app_menu_items", settings.data.appMenuItems);
    };

    showFileFolderDialog = async (title: string, defaultPath: string, folder: boolean): Promise<string | null> => {
        return await ipc.invoke("show_file_folder_dialog", { title, default_path: defaultPath, select_folder: folder });
    };

    createSymlink = async (path: string, linkPath: string) => {
        try {
            await ipc.invoke("create_symlink", { path, link_path: linkPath });
        } catch (ex: any) {
            await util.showErrorMessage(ex);
        }
    };

    startDrag = async (files: string[]) => {
        await ipc.invoke("start_drag", files);
    };

    writeClipboard = async (e: Mp.WriteClipboardRequest) => {
        const fullPaths = e.files.map((file) => file.fullPath);
        await ipc.invoke("write_uris", { fullPaths, operation: e.operation });
    };

    writeTextToClipboard = async (text: string) => {
        await ipc.invoke("write_text", text);
    };

    openTerminal = async (dir: string, admin: boolean) => {
        await ipc.invoke("open_terminal", { path: dir, admin });
    };

    launchNew = async () => {
        await ipc.invoke("launch_new", undefined);
    };

    private getNewName = async (isFile: boolean) => {
        const name = isFile ? t("newFile") : t("newFolder");
        const found = await util.exists(path.join(listState.currentDir.fullPath, isFile ? `${name}.txt` : name));
        if (!found) return name;

        let number = 1;
        for (const _ of [...Array(100)]) {
            const uniqueName = `${name}(${number})`;
            const found = await util.exists(path.join(listState.currentDir.fullPath, isFile ? `${uniqueName}.txt` : uniqueName));
            if (!found) return uniqueName;
            number++;
        }
        return `${name}(${number})`;
    };

    createItem = async (isFile: boolean): Promise<Mp.CreateItemResult> => {
        const itemName = await this.getNewName(isFile);
        const fullPath = path.join(listState.currentDir.fullPath, isFile ? `${itemName}.txt` : itemName);

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
            util.showErrorMessage(ex);
            return { newItemId: "", success: false };
        }
    };

    renameItem = async (fullPath: string, rawNewName: string): Promise<Mp.RenameResult> => {
        const newName = rawNewName.trimEnd();
        const newPath = path.join(path.dirname(fullPath), newName);

        try {
            const found = await util.exists(newPath);
            if (found) {
                throw new Error(`File name "${newName}" exists`);
            }
            await ipc.invoke("rename", { new: newPath, old: fullPath });

            this.trackOperation("Rename", [fullPath], newPath, []);

            return {
                done: true,
                newId: encodeURIComponent(newPath),
            };
        } catch (ex) {
            util.showErrorMessage(ex);
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
            util.showErrorMessage(ex);
        }
    };

    deleteItems = async (e: Mp.TrashItemRequest) => {
        try {
            const result = await ipc.invoke("message", { dialog_type: "confirm", kind: "info", message: t("deleteConfirm"), ok_label: t("yes"), cancel_label: t("no") });
            if (result.button != t("yes") || result.cancelled) return;

            const fullPaths = e.files.map((file) => file.fullPath);
            await ipc.invoke("delete", fullPaths);
        } catch (ex: any) {
            util.showErrorMessage(ex);
        }
    };

    private toFilePath(fullPath: string) {
        /* Inside recycle bin, shortcut does not end with .lnk */
        return path.extname(fullPath) == ".lnk" ? fullPath.replace(new RegExp(".lnk$"), "") : fullPath;
    }

    undeleteItems = async (e: Mp.UndeleteItemRequest) => {
        if (e.undeleteSpecific && !e.items) {
            return util.showErrorMessage("Invalid undelete arguments");
        }
        if (!e.undeleteSpecific && !e.fullPaths) {
            return util.showErrorMessage("Invalid undelete arguments");
        }

        try {
            if (e.undeleteSpecific) {
                const request: DeleteUndeleteRequest[] = e.items!.map((request) => {
                    return {
                        original_path: this.toFilePath(request.fullPath),
                        deleted_time_ms: request.deletedDate,
                    };
                });
                await ipc.invoke("undelete_by_time", request);
            } else {
                const fullPaths = e.fullPaths!.map((fullPath) => this.toFilePath(fullPath));
                await ipc.invoke("undelete", fullPaths);
            }
        } catch (ex: any) {
            util.showErrorMessage(ex);
        }
    };

    deleteFromRecycleBin = async (e: Mp.UndeleteItemRequest) => {
        if (e.undeleteSpecific && !e.items) {
            return util.showErrorMessage("Invalid undelete arguments");
        }

        if (navigator.userAgent.includes(OS.linux)) {
            const result = await ipc.invoke("message", {
                title: "Recycle Bin",
                dialog_type: "confirm",
                message: "Are you sure to delete files?",
                kind: "warning",
            });

            if (result.button != "Yes" || result.cancelled) {
                return;
            }
        }

        const request: DeleteUndeleteRequest[] = e.items!.map((request) => {
            return {
                original_path: this.toFilePath(request.fullPath),
                deleted_time_ms: request.deletedDate,
            };
        });
        await ipc.invoke("delete_from_recycle_bin", request);
    };

    emptyRecycleBin = async (): Promise<boolean> => {
        if (navigator.userAgent.includes(OS.linux)) {
            const result = await ipc.invoke("message", {
                title: "Recycle Bin",
                dialog_type: "confirm",
                message: "Are you sure to delete all files?",
                kind: "warning",
            });

            if (result.button != "Yes" || result.cancelled) {
                return false;
            }
        }
        await ipc.invoke("empty_recycle_bin", undefined);
        return true;
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
                    const result = await ipc.invoke("message", {
                        dialog_type: "confirm",
                        message: t("destExistsConfirm").replace("{}", path.basename(fullPath)),
                        kind: "warning",
                        ok_label: t("destExistsOkLabel"),
                        cancel_label: t("destExistsCancelLabel"),
                    });

                    if (result.button != t("destExistsOkLabel") || result.cancelled) {
                        cancelAll = true;
                        return null;
                    }
                }

                return fullPath;
            }),
        );
        return mapped.filter((item) => item != null);
    };

    getUrlsFromClipboard = async (targets: Mp.MediaFile[], operation: Mp.ClipboardOperation): Promise<Mp.PasteData> => {
        const failedResult = { fullPaths: [], copy: true };

        const uriAvailable = await ipc.invoke("is_uris_available", undefined);

        if (!uriAvailable) return failedResult;

        const data = await ipc.invoke("read_uris", undefined);
        if (!data.urls.length) return failedResult;

        let isCopy = this.isClipboardCopy(targets, operation, data.urls, data.operation);
        return { fullPaths: data.urls, copy: isCopy };
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
            util.showErrorMessage(ex);
            return { fullPaths: [], done: true };
        }
    };

    onWatchEvent = async (e: Mp.WatchEvent, files: Mp.MediaFile[]): Promise<Mp.WatchEventResult> => {
        const hasSearchCache = listState.currentDir.fullPath in this.searchCache;

        switch (e.operation) {
            case "Create": {
                if (hasSearchCache) {
                    // Add to cache anyway
                    this.searchCache[listState.currentDir.fullPath].push(...e.to_paths);
                }

                if (this.searchBackup.length) {
                    const pathsInSearch = e.to_paths.filter((fullPath) => this.isSearchFileFound(path.basename(fullPath), this.searchKeyword));
                    const pathsInCurrent = e.to_paths.filter((fullPath) => path.dirname(fullPath) == listState.currentDir.fullPath);
                    // Add to files only if the paths match the search keyword
                    if (pathsInSearch.length) {
                        const newItems = await Promise.all(pathsInSearch.map(async (fullPath) => await util.toFileFromPath(fullPath)));
                        files.push(...newItems);
                    }

                    // Add to backup only if the paths belongs to current dir
                    if (pathsInCurrent.length) {
                        const newItems = await Promise.all(pathsInCurrent.map(async (fullPath) => await util.toFileFromPath(fullPath)));
                        this.searchBackup.push(...newItems);
                    }
                } else {
                    const newItems = await Promise.all(e.to_paths.map(async (fullPath) => await util.toFileFromPath(fullPath)));
                    files.push(...newItems);
                }

                break;
            }
            case "Remove": {
                files = files.filter((file) => !e.to_paths.includes(file.fullPath));

                if (this.searchBackup.length) {
                    this.searchBackup = this.searchBackup.filter((file) => !e.to_paths.includes(file.fullPath));
                }

                if (hasSearchCache) {
                    this.searchCache[listState.currentDir.fullPath] = this.searchCache[listState.currentDir.fullPath].filter((fullPath) => !e.to_paths.includes(fullPath));
                }
                break;
            }
            case "Rename": {
                // Sometimes "from" and "to" come separately. Do not process until "to" comes
                if (!e.to_paths.length) {
                    this.pendingRenameFrom = e.from_paths[0];
                    break;
                }
                const newFullPath = e.to_paths[0];
                const oldFullPath = this.pendingRenameFrom ? this.pendingRenameFrom : e.from_paths[0];
                const fileIndex = files.findIndex((file) => file.fullPath == oldFullPath);
                const newMediaFile = await util.toFileFromPath(newFullPath);
                files[fileIndex] = newMediaFile;

                if (this.searchBackup.length) {
                    const fileIndex = this.searchBackup.findIndex((file) => file.fullPath == oldFullPath);
                    this.searchBackup[fileIndex] = newMediaFile;
                }
                if (hasSearchCache) {
                    const index = this.searchCache[listState.currentDir.fullPath].findIndex((fullPath) => fullPath == oldFullPath);
                    this.searchCache[listState.currentDir.fullPath][index] = newFullPath;
                }

                this.pendingRenameFrom = "";
                break;
            }
        }

        return {
            files,
            pending: !!this.pendingRenameFrom,
        };
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

    undoInput = async () => {
        await ipc.invoke("undo", undefined);
    };

    redoInput = async () => {
        await ipc.invoke("redo", undefined);
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
                    await this.undeleteItems({ undeleteSpecific: false, fullPaths: fileOperation.target });
                    break;

                case "Rename":
                    await ipc.invoke("rename", { old: fileOperation.from[0], new: fileOperation.to });
                    break;
            }
        } catch (ex: any) {
            /* Remove operation includes both of trash and delete. So ignore undelete error. */
            if (fileOperation.operation != "Undelete") {
                this.history.rollback();
                util.showErrorMessage(ex);
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
            util.showErrorMessage(ex);
        }
    };
}

const main = new Main();

export default main;
