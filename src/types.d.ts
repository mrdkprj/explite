import type { ClipboardOperation } from "movefile-node/lib";
declare global {
    interface Window {
        api: Api;
    }

    type RendererName = "View";
    type Renderer = { [key in RendererName]: Electron.BrowserWindow | null };

    type MainChannelEventMap = {
        minimize: Mp.Event;
        "toggle-maximize": Mp.Event;
        close: Mp.Event;
        selected: Mp.SelectEvent;
        sort: Mp.SortRequest;
        search: Mp.SearchRequest;
        "open-list-context-menu": Mp.Position;
        "open-fav-context-menu": Mp.Position;
        focus: Mp.SelectionChanged;
        widthChanged: Mp.WidthChangeEvent;
        endSearch: Mp.Event;
        reload: Mp.Event;
        startDrag: string[];
        createItem: Mp.CreateItemRequest;
        trash: Mp.TrashItemRequest;
        moveItems: Mp.MoveItemsRequest;
        removeFavorite: string;
        "rename-file": Mp.RenameRequest;
        pasteFile: Mp.Event;
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
        pasteRequest: Mp.Event;
        getSelectedFavorite: Mp.Event;
        "after-toggle-maximize": Mp.SettingsChangeEvent;
        "start-rename": Mp.Event;
        "after-rename": Mp.RenameResult;
        moved: Mp.MoveItemResult;
        contextmenu_event: keyof MainContextMenuSubTypeMap | FavContextMenuSubTypeMap;
        watch_event: Mp.WatchEvent;
    };

    namespace Mp {
        type SortKey = "name" | "extension" | "cdate" | "mdate" | "size" | "directory";

        type MainContextMenuSubTypeMap = {
            Open: null;
            SelectApp: null;
            Copy: null;
            Cut: null;
            Paste: null;
            Delete: null;
            AddToFavorite: null;
            CopyFullpath: null;
            Property: null;
            Settings: null;
            Terminal: null;
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

        type Settings = {
            bounds: Bounds;
            isMaximized: boolean;
            headerLabels: Mp.HeaderLabels;
            favorites: Mp.MediaFile[];
            leftAreaWidth: number;
            sortHistory: { [key: string]: Mp.SortSetting };
        };

        type SortSetting = {
            time: number;
            type: Mp.SortType;
        };

        type FileType = "Video" | "Audio" | "Image" | "App" | "Normal" | "None";
        type MediaFile = {
            id: string;
            fullPath: string;
            dir: string;
            uuid: string;
            name: string;
            mdate: number;
            cdate: number;
            size: number;
            extension: string;
            isFile: boolean;
            fileType: FileType;
        };

        type LoadEvent = {
            files: Mp.MediaFile[];
            disks?: Mp.DriveInfo[];
            directory: string;
            navigation: Mp.Navigation;
            sortType: Mp.SortType;
            failed: boolean;
        };

        type HeaderLabels = { [key in Mp.SortKey]: Mp.HeaderLabel };

        type HeaderLabel = {
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
            labels: Mp.HeaderLabels;
        };

        type CreateItemResult = {
            newItemId: string;
            success: boolean;
        };

        type TrashItemRequest = {
            files: Mp.MediaFile[];
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

        type WriteClipboardRequest = {
            files: Mp.MediaFile[];
            operation: ClipboardOperation;
        };

        type SettingsChangeEvent = {
            settings: Settings;
        };

        type PartialRect = {
            top: number;
            left: number;
            height: number;
            width: number;
            origWidth: number;
        };

        type NavigationHistory = {
            fullPath: string;
            selection: Mp.ItemSelection;
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

        type Event = {
            args?: any;
        };
    }
}

export {};
