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
        watch_event: string[];
    };

    namespace Mp {
        type SortKey = "name" | "extension" | "cdate" | "mdate" | "size" | "directory";

        type MainContextMenuSubTypeMap = {
            Open: null;
            OpenWith: null;
            Copy: null;
            Cut: null;
            Paste: null;
            Delete: null;
            AddToFavorite: null;
            CopyFullpath: null;
            Property: null;
            AllowExecute: null;
            Settings: null;
        };

        type FavContextMenuSubTypeMap = {
            RemoveFromFavorite: null;
            Property: null;
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
            allowWriteClipboard: boolean;
            allowExecute: boolean;
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
            encName: string;
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

        type Navigation = "Direct" | "Back" | "Forward" | "Reload";
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
        };

        type SearchResult = {
            files: Mp.MediaFile[];
        };

        type WidthChangeEvent = {
            leftWidth: number;
            labels: Mp.HeaderLabels;
        };

        type CreateItemRequest = {
            file: Mp.MediaFile;
        };

        type CreateItemResult = {
            files: Mp.MediaFile[];
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
            files: Mp.MediaFile[];
            dir: string;
            copy: boolean;
        };

        type MoveItemResult = {
            movedItems?: Mp.MediaFile[];
            files: Mp.MediaFile[];
            done: boolean;
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
            file: MediaFile;
            error?: boolean;
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

        type Event = {
            args?: any;
        };
    }
}

export {};
