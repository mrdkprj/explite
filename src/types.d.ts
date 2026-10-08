declare global {
    interface Window {
        lang: Mp.LocaleName;
    }

    type RendererName = "View";

    type MainChannelEventMap = {
        selected: Mp.SelectEvent;
        sort: Mp.SortRequest;
        search: Mp.SearchRequest;
        "open-list-context-menu": Mp.Position;
        "open-fav-context-menu": Mp.Position;
        focus: Mp.SelectionChanged;
        widthChanged: Mp.WidthChangeEvent;
        endSearch: Mp.AnyEvent;
        reload: Mp.AnyEvent;
        startDrag: string[];
        createItem: Mp.CreateItemRequest;
        trash: Mp.TrashItemRequest;
        moveItems: Mp.MoveItemsRequest;
        removeFavorite: string;
        "rename-file": Mp.RenameRequest;
        pasteFile: Mp.AnyEvent;
        writeClipboard: Mp.WriteClipboardRequest;
        contextmenu_event: keyof MainContextMenuSubTypeMap | FavContextMenuSubTypeMap;
        watch_event: Mp.WatchEvent;
        device_event: Mp.DeviceEvent;
        closeTab: null;
        scrollTab: number;
        restoreFocus: null;
        settingsChanged: Mp.Settings;
        tab_event: Mp.TabEvent;
        startTabDrag: Tab.StartDragEvent;
        endTabDrag: null;
        tabDropHandled: null;
        "window-state-changed": Ws.ChangeWindowStateResult;
        reloadSettings: null;
    };

    namespace Ws {
        type WebviewTitle = {
            label: string;
            title: string;
            path: string;
        };

        type ChangeWindowStateRequest = { name: "minimize"; data?: never } | { name: "toggleMaximize"; data?: never } | { name: "updateTitle"; data: WebviewTitle };
        type ChangeWindowStateResult = { name: "maximized"; data?: never } | { name: "unmaximized"; data?: never } | { name: "toggled"; data?: Mp.Bounds } | { name: "minimized"; data: Mp.Bounds };
    }

    namespace Tab {
        type TabState = {
            tabs: WebviewTitle[];
            scrollLeft: number;
            willStartDrag: boolean;
            dragging: boolean;
            added: boolean;
        };

        type ToggleTabModeRequest = {
            tab_mode: bool;
            bounds?: Tab.Bounds;
        };

        type AddTabRequest = {
            opener: string;
            bounds: Tab.Bounds;
            detach: boolean;
        };

        type Bounds = {
            width: number;
            height: number;
            x: number;
            y: number;
        };

        type StartDragEvent = {
            initiator: string;
            target: string;
        };

        type AttachRequest = {
            from: string;
            to: string;
            attach_target: string | null;
            attach_before: boolean;
        };

        type TabEvent =
            | { name: "maximized"; data?: never }
            | { name: "unmaximized"; data?: never }
            | { name: "titleChanged"; data: Ws.WebviewTitle }
            | { name: "reordered"; data: Ws.WebviewTitle[] }
            | { name: "closed"; data: string }
            | { name: "modeChanged"; data: { tab_mode: boolean; webviews: Ws.WebviewTitle[] } }
            | { name: "close"; data?: never }
            | { name: "scrolled"; data: number }
            | { name: "activated"; data?: never }
            | { name: "attached"; data: Ws.WebviewTitle[] }
            | { name: "added"; data: Ws.WebviewTitle };

        type TabRequest =
            | { name: "select"; data: string }
            | { name: "selectNext"; data?: never }
            | { name: "selectPrevious"; data?: never }
            | { name: "reorder"; data: Ws.WebviewTitle[] }
            | { name: "closeAll"; data?: never }
            | { name: "cancel"; data?: never }
            | { name: "update"; data: Ws.WebviewTitle }
            | { name: "add"; data: AddTabRequest }
            | { name: "attach"; data: AttachRequest }
            | { name: "detach"; data: string }
            | { name: "close"; data?: never }
            | { name: "minimize"; data?: never }
            | { name: "toggleMaximize"; data?: never }
            | { name: "startDrag"; data?: never }
            | { name: "startResizeDrag"; data: ResizeDirection }
            | { name: "toggleTabMode"; data: ToggleTabModeRequest };
    }

    namespace Mp {
        type ReadyEvent = {
            data: Mp.LoadEvent;
            locale: Mp.LocaleName;
            selectId?: string;
            restorePosition: boolean;
            opener: string;
            detach: boolean;
        };

        type SortKey = "name" | "extension" | "cdate" | "mdate" | "size" | "directory" | "ddate" | "orig_path";
        type Theme = "dark" | "light" | "system";

        type MainContextMenuSubTypeMap = {
            Open: null;
            OpenInNewWindow: null;
            OpenInNewTab: null;
            SelectApp: null;
            Copy: null;
            Cut: null;
            Paste: null;
            Trash: null;
            AddToFavorite: null;
            CopyFullpath: null;
            Property: null;
            Settings: null;
            Terminal: null;
            AdminTerminal: null;
            Delete: null;
            Undelete: null;
            EmptyRecycleBin: null;
            DeleteFromRecycleBin: null;
            AutoAdjustColumnWidth: null;
        };

        type FavContextMenuSubTypeMap = {
            RemoveFromFavorite: null;
            Property: null;
            Refresh: null;
        };

        type Bounds = {
            width: number;
            height: number;
            x: number;
            y: number;
        };

        type Position = {
            x: number;
            y: number;
        };

        type Rect = {
            top: number;
            left: number;
            right: number;
            bottom: number;
        };

        type Settings = {
            bounds: Bounds;
            isMaximized: boolean;
            favorites: Mp.MediaFile[];
            leftAreaWidth: number;
            columnHistory: { [key: string]: Mp.ColumnSetting };
            theme: Mp.Theme;
            allowMoveColumn: boolean;
            appMenuItems: AppMenuItem[];
            useOSIcon: boolean;
            rememberColumns: boolean;
            treeView: boolean;
            tabMode: boolean;
        };

        type Preference = {
            theme: Mp.Theme;
            allowMoveColumn: boolean;
            appMenuItems: AppMenuItem[];
            useOSIcon: boolean;
            rememberColumns: boolean;
        };

        type AppMenuItem = {
            label: string;
            path: string;
            target: "File" | "Folder" | "Both";
        };

        type ColumnMap = { [key in Mp.SortKey]: Mp.Column };

        type Column = {
            width: number;
            sortKey: Mp.SortKey;
            visible: boolean;
        };

        type ColumnSetting = {
            time: number;
            sortType: Mp.SortType;
            columns: Mp.Column[];
        };

        type FileAttribute = {
            is_device: boolean;
            is_directory: boolean;
            is_file: boolean;
            is_hidden: boolean;
            is_read_only: boolean;
            is_symbolic_link: boolean;
            is_system: boolean;
            atime_ms: number;
            ctime_ms: number;
            mtime_ms: number;
            birthtime_ms: number;
            size: number;
            link_path: string;
        };

        type Dirent = {
            name: string;
            parent_path: string;
            full_path: string;
            mime_type: string;
            attributes: FileAttribute;
        };

        type EntityType = "File" | "Folder" | "SymlinkFile" | "SymlinkFolder";
        type FileType = "Video" | "Audio" | "Image" | "App" | "Normal" | "Folder" | "HiddenFolder" | "Zip" | "Desktop" | "Documents" | "Downloads" | "Music" | "Pictures" | "Videos";
        type MediaFile = {
            id: string;
            fullPath: string;
            dir: string;
            uuid: string;
            name: string;
            mdate: number;
            mdateString: string;
            cdate: number;
            cdateString: string;
            size: number;
            sizeString: string;
            extension: string;
            actualExtension: string;
            isFile: boolean;
            entityType: Mp.EntityType;
            fileType: Mp.FileType;
            linkPath: string;
            ddate: number;
            ddateString: string;
            originalPath: string;
            mimeType: string;
            treeState?: TreeState;
        };

        type TreeState = {
            level: number;
            opened: boolean;
            root: string;
        };

        type LoadEvent = {
            files: Mp.MediaFile[];
            drives?: Mp.DriveInfo[];
            directory: string;
            navigation: Mp.Navigation;
            failed: boolean;
            iconCache?: Mp.IconCache;
        };

        type IconCache = {
            cache: {
                [key: string]: {
                    small: string;
                    large: string;
                };
            };
        };

        type DriveInfo = {
            label: string;
            name: string;
            path: string;
            available: number;
            total: number;
            virtual: boolean;
        };

        type ReadResult = {
            files: Mp.MediaFile[];
            done: boolean;
        };

        type RefreshResult = {
            disks: Mp.DriveInfo[];
        };

        type Navigation = "Direct" | "Back" | "Forward" | "Reload" | "PathSelect" | "None";
        type SelectEvent = {
            fullPath: string;
            isFile: boolean;
            navigation: Mp.Navigation;
        };

        type SortType = {
            asc: boolean;
            key: Mp.SortKey;
        };

        type SearchRequest = {
            dir: string;
            key: string;
            refresh: boolean;
        };

        type WidthChangeEvent = {
            leftWidth: number;
            labels: Mp.ColumnLabel[];
        };

        type CreateItemResult = {
            newItemId: string;
            success: boolean;
        };

        type TrashItemRequest = {
            files: Mp.MediaFile[];
        };

        type UndeleteItemRequest = {
            undeleteSpecific: boolean;
            fullPaths?: string[];
            items?: UndeleteItem[];
        };

        type UndeleteItem = {
            fullPath: string;
            deletedDate: number;
        };

        type MarkItemRequest = {
            copy: boolean;
        };

        type MoveItemsRequest = {
            fullPaths: string[];
            dir: string;
            copy: boolean;
        };

        type MoveItemResult = {
            fullPaths: string[];
            done: boolean;
        };

        type PasteData = {
            fullPaths: string[];
            copy: boolean;
        };

        type ItemSelection = {
            selectedId: string;
            selectedIds: string[];
        };

        type RenameData = {
            id: string;
            name: string;
            isFile: boolean;
        };

        type SelectionChanged = {
            selection: ItemSelection;
        };

        type RenameRequest = {
            data: Mp.RenameData;
        };

        type RenameResult = {
            done: boolean;
            newId: string;
        };

        type ClipboardOperation = "Move" | "Copy" | "None";

        type ClipboardData = {
            operation: Mp.ClipboardOperation;
            urls: string[];
        };

        type WriteClipboardRequest = {
            files: Mp.MediaFile[];
            operation: Mp.ClipboardOperation;
        };

        type SettingsChangeEvent = {
            settings: Settings;
        };

        type PartialRect = {
            top: number;
            left: number;
            height: number;
            width: number;
        };

        type NavigationHistory = {
            fullPath: string;
            selection: Mp.ItemSelection;
        };

        type FileDropEvent = {
            paths: string[];
        };

        type DeviceEvent = {
            name: string;
            event: "Added" | "Removed";
        };

        type WatchEvent = {
            operation: "Create" | "Remove" | "Rename";
            to_paths: string[];
            from_paths: string[];
        };

        type Operation = "Copy" | "Move" | "Trash" | "Create" | "Undelete" | "Delete" | "Rename";
        type FileOperation = {
            operation: Mp.Operation;
            from: string[];
            to: string;
            target: string[];
            isFile: boolean;
        };

        type WatchType = "Replace" | "Add" | "None";

        type MessageResult = {
            button: string;
            cancelled: boolean;
        };

        type RecycleBinItem = {
            name: string;
            original_path: string;
            deleted_date_ms: number;
            mime_type: string;
            attributes: Mp.FileAttribute;
        };

        type DeleteUndeleteRequest = {
            original_path: string;
            deleted_time_ms: number;
        };

        type ThumbnailArgs = {
            full_path: string;
            width: number;
            height: number;
        };

        type AnyEvent = {
            args?: any;
        };

        type LocaleName = "en" | "ja";

        type Labels = {
            availableSpace: string;
            colName: string;
            colDirectory: string;
            colExtension: string;
            colModified: string;
            colCreated: string;
            colSize: string;
            colDeleted: string;
            colOrigPath: string;
            typeFolder: string;
            typeShortcut: string;
            newFile: string;
            newFolder: string;
            deleteConfirm: string;
            yes: string;
            no: string;
            extensionFile: string;
            menuNewTextFile: string;
            menuNewDirectory: string;
            menuNewSymlink: string;
            recycleBin: string;
            deleteFromRecycleBinMsg: string;
            emptyRecycleBinMsg: string;
        };
    }
}

export {};
