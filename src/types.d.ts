declare global {
    interface Window {
        lang: Mp.LocaleName;
    }

    type RendererName = "View";

    type MainChannelEventMap = {
        minimize: Mp.AnyEvent;
        "toggle-maximize": Mp.AnyEvent;
        close: Mp.AnyEvent;
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
    };

    type RendererChannelEventMap = {
        ready: Mp.ReadyEvent;
        load: Mp.LoadEvent;
        sorted: Mp.SortResult;
        searched: Mp.SearchResult;
        favoriteChanged: Mp.MediaFile[];
        markItem: Mp.MarkItemRequest;
        itemCreated: Mp.CreateItemResult;
        pasteRequest: Mp.AnyEvent;
        getSelectedFavorite: Mp.AnyEvent;
        "after-toggle-maximize": Mp.SettingsChangeEvent;
        "start-rename": Mp.AnyEvent;
        "after-rename": Mp.RenameResult;
        moved: Mp.MoveItemResult;
        contextmenu_event: keyof MainContextMenuSubTypeMap | FavContextMenuSubTypeMap;
        watch_event: Mp.WatchEvent;
        device_event: Mp.DeviceEvent;
    };

    namespace Mp {
        type SortKey = "name" | "extension" | "cdate" | "mdate" | "size" | "directory" | "ddate" | "orig_path";
        type Theme = "dark" | "light" | "system";

        type MainContextMenuSubTypeMap = {
            Open: null;
            OpenInNewWindow: null;
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
            columnLabels: Mp.ColumnLabel[];
            favorites: Mp.MediaFile[];
            leftAreaWidth: number;
            headerHistory: { [key: string]: Mp.HeaderSetting };
            theme: Mp.Theme;
            allowMoveColumn: boolean;
            appMenuItems: AppMenuItem[];
            useOSIcon: boolean;
            rememberColumns: boolean;
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

        // type HeaderSetting = {
        //     time: number;
        //     sortType: Mp.SortType;
        //     labels: Mp.ColumnLabel[];
        // };

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
        };

        type LoadEvent = {
            files: Mp.MediaFile[];
            drives?: Mp.DriveInfo[];
            directory: string;
            navigation: Mp.Navigation;
            sortType: Mp.SortType;
            failed: boolean;
            headers: Mp.ColumnLabel[];
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

        type ColumnLabelMap = { [key in Mp.SortKey]: Mp.ColumnLabel };

        type ColumnLabel = {
            label: string;
            width: number;
            sortKey: Mp.SortKey;
        };

        type DriveInfo = {
            label: string;
            name: string;
            path: string;
            available: number;
            total: number;
            virtual: boolean;
        };

        type RefreshResult = {
            disks: Mp.DriveInfo[];
        };

        type Navigation = "Direct" | "Back" | "Forward" | "Reload" | "PathSelect";
        type SelectEvent = {
            fullPath: string;
            isFile: boolean;
            navigation: Mp.Navigation;
        };

        type SortType = {
            asc: boolean;
            key: Mp.SortKey;
        };

        type SortRequest = {
            files: Mp.MediaFile[];
            type: Mp.SortType;
        };

        type SortResult = {
            files: Mp.MediaFile[];
            type: Mp.SortType;
        };

        type SearchRequest = {
            dir: string;
            key: string;
            refresh: boolean;
        };

        type SearchResult = {
            files: Mp.MediaFile[];
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
            dir: string;
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

        type ReadyEvent = {
            settings: Settings;
            data: Mp.LoadEvent;
            locale: Mp.LocaleName;
            selectId?: string;
            restorePosition: boolean;
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

        type MessageResult = {
            button: string;
            cancelled: boolean;
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
            destExistsConfirm: string;
            destExistsOkLabel: string;
            destExistsCancelLabel: string;
            deleteConfirm: string;
            yes: string;
            no: string;
        };
    }
}

/**
 * window.chrome.webview is the class to access the WebView2-specific APIs that are available
 * to the script running within WebView2 Runtime.
 */
export interface WebView extends EventTarget {
    /**
     * The standard EventTarget.addEventListener method. Use it to subscribe to the message event
     * or sharedbufferreceived event. The message event receives messages posted from the WebView2
     * host via CoreWebView2.PostWebMessageAsJson or CoreWebView2.PostWebMessageAsString. The
     * sharedbufferreceived event receives shared buffers posted from the WebView2 host via
     * CoreWebView2.PostSharedBufferToScript.
     * See CoreWebView2.PostWebMessageAsJson( Win32/C++, .NET, WinRT).
     * @param type The name of the event to subscribe to. Valid values are message, and sharedbufferreceived.
     * @param listener The callback to invoke when the event is raised.
     * @param options Options to control how the event is handled.
     */
    addEventListener(type: string, listener: WebViewEventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

    /**
     * The standard EventTarget.removeEventListener method. Use it to unsubscribe to the message
     * or sharedbufferreceived event.
     * @param type The name of the event to unsubscribe from. Valid values are message and sharedbufferreceived.
     * @param listener The callback to remove from the event.
     * @param options Options to control how the event is handled.
     */
    removeEventListener(type: string, listener?: WebViewEventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

// Global object
declare global {
    interface Window {
        chrome: {
            webview: WebView;
        };
    }

    interface Uint8Array {
        toBase64(): string;
    }
}

export {};
