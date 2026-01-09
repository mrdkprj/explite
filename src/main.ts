import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import Settings from "./settings";
import util from "./util";
import { DEFAULT_SORT_TYPE, HOME, OS, RECYCLE_BIN, RECYCLE_BIN_ITEM } from "./constants";
import { DeleteUndeleteRequest, IPC } from "./ipc";
import { path } from "./path";
import { History } from "./history";
import { t } from "./translation/useTranslation";

const ipc = new IPC("View");

export const icons: { [key: string]: string } = {};

class Main {
    private initialized = false;
    private settings = new Settings();
    private searchCache: { [key: string]: string[] } = { "": [] };
    private searchKeyword = "";
    private files: Mp.MediaFile[] = [];
    private searchBackup: Mp.MediaFile[] = [];
    private currentDir = HOME;
    private watchTarget = HOME;
    private history = new History();

    onMainReady = async (dropTagetId: string): Promise<Mp.ReadyEvent> => {
        this.cleanHeaderHistory();

        const drives = await util.getDriveInfo();

        const args = await ipc.invoke("get_args", undefined);

        const locale = args.locales.some((locale) => locale.toLowerCase().includes("ja")) ? "ja" : "en";
        window.lang = locale;

        if (!this.initialized) {
            await this.settings.init();
            await ipc.invoke("prepare_menu", undefined);
            await ipc.invoke("listen_devices", undefined);
            await ipc.invoke("listen_file_drop", dropTagetId);
        }

        let selectId;
        let initialDirectory = "";
        const item = args.urls.length ? await util.toFileFromPath(args.urls[0]) : null;
        if (item) {
            if (item.isFile) {
                selectId = item.id;
                initialDirectory = item.dir;
                await this.readFiles(item.dir);
            } else {
                initialDirectory = item.fullPath;
                await this.readFiles(item.fullPath);
            }
        }

        this.initialized = true;

        return {
            settings: structuredClone(this.settings.data),
            locale,
            data: {
                files: this.files,
                drives,
                directory: this.currentDir,
                navigation: "Direct",
                sortType: DEFAULT_SORT_TYPE,
                failed: false,
                headers: this.settings.data.headerHistory[initialDirectory]
                    ? structuredClone(this.settings.data.headerHistory[initialDirectory].labels)
                    : structuredClone(this.settings.data.headerLabels),
            },
            selectId,
            restorePosition: args.restore_position,
        };
    };

    showErrorMessage = async (ex: any | string) => {
        if (typeof ex == "string") {
            await ipc.invoke("message", { dialog_type: "message", message: ex, kind: "error" });
        } else {
            await ipc.invoke("message", { dialog_type: "message", message: ex.message, kind: "error" });
        }
    };

    private isRecycleBin = (directory: string) => directory == RECYCLE_BIN;

    onSelect = async (e: Mp.SelectEvent): Promise<Mp.LoadEvent | null> => {
        if (e.fullPath == RECYCLE_BIN_ITEM) return null;

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

    private openFolder = async (directory: string, navigation: Mp.Navigation): Promise<Mp.LoadEvent | null> => {
        if (directory == HOME) {
            const result = await this.readFiles(HOME);
            const drives = await util.getDriveInfo();
            return { files: this.files, directory: HOME, navigation, sortType: result.sortType, failed: !result.done, headers: [], drives };
        }

        if (!this.isRecycleBin(directory)) {
            const found = await util.exists(directory);
            if (!found) {
                await this.showErrorMessage(`"${directory}" does not exist.`);
                return null;
            }
        }

        this.validateHeaderHistory(directory);

        const cacheKey = Object.keys(this.searchCache)[0];
        if (cacheKey != directory) {
            delete this.searchCache[cacheKey];
        }

        const result = await this.readFiles(directory);

        return {
            files: this.files,
            directory,
            navigation,
            sortType: result.sortType,
            failed: !result.done,
            headers: this.settings.data.headerHistory[directory] ? structuredClone(this.settings.data.headerHistory[directory].labels) : structuredClone(this.settings.data.headerLabels),
        };
    };

    openPropertyDielog = async (fileOrId: Mp.MediaFile | string) => {
        const file = typeof fileOrId == "string" ? this.settings.data.favorites.find((file) => file.id == fileOrId) : fileOrId;
        if (!file) return;
        await ipc.invoke("open_property_dielog", file.fullPath);
    };

    isWatchable = () => {
        if (!this.watchTarget) return false;
        if (this.watchTarget == HOME) return false;
        if (this.isRecycleBin(this.watchTarget)) return false;

        return true;
    };

    startWatch = async () => {
        await this.abortWatch();
        this.watchTarget = this.currentDir;

        if (this.isWatchable()) {
            await ipc.invoke("watch", this.watchTarget);
        }
    };

    abortWatch = async () => {
        if (!this.isWatchable()) return;
        await ipc.invoke("unwatch", this.watchTarget);
        this.watchTarget = "";
    };

    readFiles = async (directory: string) => {
        this.searchBackup = [];
        this.currentDir = directory;

        if (this.currentDir == HOME) {
            this.abortWatch();
            this.files = [];
            this.watchTarget = this.currentDir;
            return {
                done: true,
                sortType: DEFAULT_SORT_TYPE,
            };
        }

        try {
            if (this.isRecycleBin(this.currentDir)) {
                const allDirents = await ipc.invoke("read_recycle_bin", undefined);
                this.files = allDirents.filter((dirent) => !dirent.attributes.is_system).map((dirent) => util.toFileFromRecycleBinItem(dirent));
            } else {
                const allDirents = await ipc.invoke("readdir", { directory: this.currentDir, recursive: false });
                this.files = allDirents.filter((dirent) => !dirent.attributes.is_system).map((dirent) => util.toFile(dirent));
            }

            if (this.settings.data.useOSIcon) {
                await this.getFileIcon();
            }

            const sortType = this.sortFiles(this.currentDir, this.files);

            await this.startWatch();

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

    private getFileIcon = async () => {
        const fileMap: { [key: string]: string } = {};
        this.files
            .filter((file) => file.isFile && !(file.actualExtension in icons))
            .forEach((file) => (file.fileType == "App" ? (fileMap[file.name] = file.fullPath) : (fileMap[file.actualExtension] = file.fullPath)));
        if (!Object.keys(fileMap).length) return;

        const iconInfoMap = await ipc.invoke("assoc_icons", Object.values(fileMap));
        Object.keys(iconInfoMap).forEach((key) => {
            const uint8 = Uint8Array.from(iconInfoMap[key].data);
            const base64 = uint8.toBase64();
            if (navigator.userAgent.includes(OS.windows)) {
                icons[key] = `data:image/png;base64,${base64}`;
            } else {
                if (iconInfoMap[key].full_path!.toLowerCase().endsWith("svg")) {
                    icons[key] = `data:image/svg+xml;base64,${base64}`;
                } else {
                    icons[key] = `data:image/png;base64,${base64}`;
                }
            }
        });
    };

    sort = (e: Mp.SortRequest): Mp.SortResult => {
        this.sortFiles(this.currentDir, this.files, { asc: e.type.asc, key: e.type.key });
        return { files: this.files, type: e.type };
    };

    search = async (e: Mp.SearchRequest): Promise<Mp.SearchResult> => {
        if (!this.searchBackup.length) {
            this.searchBackup = structuredClone(this.files);
        }

        const key = e.key.toLocaleLowerCase();
        this.searchKeyword = key;
        if (e.dir in this.searchCache) {
            this.files = await this.filterCache(e.dir, key);
            return { files: this.files };
        }

        if (this.isRecycleBin(e.dir)) {
            this.files = this.filterRecycleBin(key);
        } else {
            const allDirents = await ipc.invoke("readdir", { directory: e.dir, recursive: true });
            this.searchCache[e.dir] = allDirents.filter((direcnt) => !direcnt.attributes.is_system).map((dirent) => path.join(dirent.parent_path, dirent.name));
            this.files = await this.filterCache(e.dir, key);
        }

        this.sortFiles(this.currentDir, this.files);
        return { files: this.files };
    };

    private filterCache = async (dir: string, key: string) => {
        const fildtered = this.searchCache[dir].filter((fullPath) => this.isSearchFileFound(path.basename(fullPath), key));
        return await Promise.all(fildtered.map(async (fullPath) => await util.toFileFromPath(fullPath)));
    };

    private filterRecycleBin = (key: string) => {
        return this.files.filter((file) => this.isSearchFileFound(file.name, key));
    };

    private isSearchFileFound = (value: string, key: string) => {
        const strippedKey = key.replace(/[\!#\$\%&'\(\)\=\~\^\-\|`@\{\[\+;\]\}\,\_\s]/g, "");
        const strippedText = value.toLocaleLowerCase().replace(/[\!#\$\%&'\(\)\=\~\^\-\|`@\{\[\+;\]\}\,\_\s]/g, "");
        return strippedText.includes(strippedKey);
    };

    onSearchEnd = async (): Promise<Mp.SearchResult> => {
        this.sortFiles(this.currentDir, this.searchBackup);
        this.files = structuredClone(this.searchBackup);
        this.searchBackup = [];
        this.searchKeyword = "";

        return { files: this.files };
    };

    sortFiles = (directory: string, files: Mp.MediaFile[], sortType?: Mp.SortType): Mp.SortType => {
        if (sortType) {
            this.updateHeaderHistory(directory, sortType, null);
        }
        const applicableSort = this.settings.data.headerHistory[directory] ? this.settings.data.headerHistory[directory].sortType : DEFAULT_SORT_TYPE;
        util.sort(files, applicableSort.asc, applicableSort.key);
        return applicableSort;
    };

    private updateHeaderHistory = (directory: string, sortType: Mp.SortType | null, labels: Mp.HeaderLabel[] | null) => {
        if (directory == HOME) return;

        if (Object.keys(this.settings.data.headerHistory).length == 100) {
            const oldestEntry = Object.entries(this.settings.data.headerHistory).reduce((prev, curr) => (prev[1].time < curr[1].time ? prev : curr));
            delete this.settings.data.headerHistory[oldestEntry[0]];
        }

        if (this.settings.data.headerHistory[directory]) {
            this.settings.data.headerHistory[directory].time = new Date().getTime();
            this.settings.data.headerHistory[directory].sortType = sortType ?? this.settings.data.headerHistory[directory].sortType;
            this.settings.data.headerHistory[directory].labels = labels ?? this.settings.data.headerHistory[directory].labels;
        } else {
            this.settings.data.headerHistory[directory] = { time: new Date().getTime(), sortType: sortType ?? DEFAULT_SORT_TYPE, labels: labels ?? this.settings.data.headerLabels };
        }
    };

    private validateHeaderHistory = (directory: string) => {
        if (this.settings.data.headerHistory[directory]) {
            this.settings.data.headerHistory[directory].time = new Date().getTime();
        }
    };

    private cleanHeaderHistory = async () => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        const monthBefore = date.getTime();
        const newHistory: { [key: string]: Mp.HeaderSetting } = {};
        Object.entries(this.settings.data.headerHistory)
            .filter(([_, value]) => value.time > monthBefore)
            .forEach(([key, value]) => (newHistory[key] = value));
        this.settings.data.headerHistory = newHistory;
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
        await ipc.invoke("unlisten_devices", undefined);
        await ipc.invoke("unlisten_file_drop", undefined);

        if (!this.settings.data.isMaximized) {
            const position = await view.innerPosition();
            const size = await view.innerSize();
            this.settings.data.bounds = util.toBounds(position, size);
        }

        await this.settings.save();

        await view.close();
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

    openConfigFileJson = async () => {
        await ipc.invoke("open_path", this.settings.getFilePath());
    };

    onColumnHeaderChanged = (e: Mp.WidthChangeEvent) => {
        this.settings.data.leftAreaWidth = e.leftWidth;
        this.updateHeaderHistory(this.currentDir, null, e.labels);
    };

    changeTheme = async (theme: Mp.Theme) => {
        await ipc.invoke("change_theme", theme);
    };

    changeAppMenuItems = async (appMenuItems: Mp.AppMenuItem[]) => {
        await ipc.invoke("change_app_menu_items", appMenuItems);
    };

    clearHeaderHistory = () => {
        this.settings.data.headerHistory = {};
    };

    onPreferenceChanged = async (preference: Mp.Preference) => {
        await this.changeTheme(preference.theme);
        this.settings.data.theme = preference.theme;
        this.settings.data.appMenuItems = preference.appMenuItems;
        this.settings.data.allowMoveColumn = preference.allowMoveColumn;
        this.settings.data.useOSIcon = preference.useOSIcon;
    };

    showFileFolderDialog = async (title: string, defaultPath: string, folder: boolean): Promise<string | null> => {
        return await ipc.invoke("show_file_folder_dialog", { title, default_path: defaultPath, select_folder: folder });
    };

    createSymlink = async (path: string, linkPath: string) => {
        try {
            await ipc.invoke("create_symlink", { path, link_path: linkPath });
        } catch (ex: any) {
            await this.showErrorMessage(ex);
        }
    };

    reload = async (includeDrive: boolean): Promise<Mp.LoadEvent | null> => {
        if (this.currentDir == HOME) {
            return null;
        }
        const result = await this.readFiles(this.currentDir);
        const drives = includeDrive ? await util.getDriveInfo() : undefined;
        return {
            files: this.files,
            drives,
            directory: this.currentDir,
            navigation: "Reload",
            sortType: result.sortType,
            failed: !result.done,
            headers: this.settings.data.headerHistory[this.currentDir] ? structuredClone(this.settings.data.headerHistory[this.currentDir].labels) : structuredClone(this.settings.data.headerLabels),
        };
    };

    startDrag = async (files: string[]) => {
        await ipc.invoke("start_drag", files);
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

    removeFavorite = (id: string): Mp.MediaFile[] => {
        const newFavorites = this.settings.data.favorites.filter((file) => file.id != id);
        this.settings.data.favorites = newFavorites;
        return this.settings.data.favorites;
    };

    changeFavorites = (favorites: Mp.MediaFile[]) => {
        this.settings.data.favorites = favorites;
    };

    openTerminal = async (dir: string, admin: boolean) => {
        await ipc.invoke("open_terminal", { path: dir, admin });
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
            const result = await ipc.invoke("message", { dialog_type: "confirm", kind: "info", message: t("deleteConfirm"), ok_label: t("yes"), cancel_label: t("no") });
            if (result.button != t("yes") || result.cancelled) return;

            const fullPaths = e.files.map((file) => file.fullPath);
            await ipc.invoke("delete", fullPaths);
        } catch (ex: any) {
            this.showErrorMessage(ex);
        }
    };

    private toFilePath(fullPath: string) {
        /* Inside recycle bin, shortcut does not end with .lnk */
        return path.extname(fullPath) == ".lnk" ? fullPath.replace(new RegExp(".lnk$"), "") : fullPath;
    }

    undeleteItems = async (e: Mp.UndeleteItemRequest) => {
        if (e.undeleteSpecific && !e.items) {
            return this.showErrorMessage("Invalid undelete arguments");
        }
        if (!e.undeleteSpecific && !e.fullPaths) {
            return this.showErrorMessage("Invalid undelete arguments");
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
            this.showErrorMessage(ex);
        }
    };

    deleteFromRecycleBin = async (e: Mp.UndeleteItemRequest) => {
        if (e.undeleteSpecific && !e.items) {
            return this.showErrorMessage("Invalid undelete arguments");
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

    toVideoThumbnail = async (fullPath: string) => {
        const raw = await ipc.invoke("to_thumbnail", { full_path: fullPath, width: 100, height: 100 });
        const uint8 = Uint8Array.from(raw);
        const base64 = uint8.toBase64();
        return `data:image/jpeg;base64,${base64}`;
    };

    toImageThumbnail = async (fullPath: string) => {
        const raw = await ipc.invoke("to_image_thumbnail", fullPath);
        const uint8 = Uint8Array.from(raw);
        const base64 = uint8.toBase64();
        return `data:image/jpeg;base64,${base64}`;
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
