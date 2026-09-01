import { listen, emit, UnlistenFn, once, emitTo, EventName } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

type TauriCommand<Req, Res> = {
    Request: Req;
    Response: Res;
};

type ReadDirRequest = {
    directory: string;
    recursive: boolean;
};

type Volume = {
    mount_point: string;
    volume_label: string;
    available_units: number;
    total_units: number;
};

type RenameInfo = {
    new: string;
    old: string;
};

type CopyInfo = {
    from: string[];
    to: string;
};

type WriteUriInfo = {
    fullPaths: string[];
    operation: Mp.ClipboardOperation;
};

type WriteFileInfo = {
    fullPath: string;
    data: string;
};

type OpenWithArg = {
    full_path: string;
    app_path: string;
};

type ContextMenuArg = {
    position: Mp.Position;
    full_path: string;
    show_admin_runas: boolean;
};

type ColumnWithLabel = {
    label: string;
    sortKey: Mp.SortKey;
    visible: boolean;
};

type ColumnMenuArg = {
    position: Mp.Position;
    items: Mp.Column[];
    is_recycle_bin: boolean;
};

type TerminalArgs = {
    path: string;
    admin: boolean;
};

type DialogOptions = {
    dialog_type: "message" | "confirm" | "ask";
    title?: string;
    kind?: "info" | "warning" | "error";
    ok_label?: string;
    cancel_label?: string;
    message: string;
};

type OpenFileFolderOption = {
    title: string;
    default_path: string;
    select_folder: boolean;
};

type SymlinkRequest = {
    path: string;
    link_path: string;
};

type InitArgs = {
    urls: string[];
    locales: string[];
    restore_position: boolean;
};

type IconInfo = {
    full_path?: string;
    small: number[];
    large: number[];
};

type NotifyRequest = {
    path: string;
    network: boolean;
};

type TauriCommandMap = {
    prepare_menu: TauriCommand<ColumnWithLabel[], null>;
    open_list_context_menu: TauriCommand<ContextMenuArg, null>;
    open_fav_context_menu: TauriCommand<Mp.Position, null>;
    open_recycle_context_menu: TauriCommand<ContextMenuArg, null>;
    open_column_context_menu: TauriCommand<ColumnMenuArg, null>;
    exists: TauriCommand<string, boolean>;
    open_path: TauriCommand<string, null>;
    open_path_with: TauriCommand<OpenWithArg, null>;
    open_in_new_window: TauriCommand<string, null>;
    show_app_selector: TauriCommand<string, null>;
    open_property_dielog: TauriCommand<string, null>;
    readdir: TauriCommand<ReadDirRequest, ArrayBuffer>;
    read_recycle_bin: TauriCommand<null, ArrayBuffer>;
    rename: TauriCommand<RenameInfo, boolean>;
    list_volumes: TauriCommand<null, Volume[]>;
    start_drag: TauriCommand<string[], null>;
    stat: TauriCommand<string, Mp.FileAttribute>;
    get_mime_type: TauriCommand<string, string>;
    trash: TauriCommand<string[], null>;
    delete: TauriCommand<string[], null>;
    undelete: TauriCommand<string[], null>;
    undelete_by_time: TauriCommand<Mp.DeleteUndeleteRequest[], null>;
    delete_from_recycle_bin: TauriCommand<Mp.DeleteUndeleteRequest[], null>;
    copy: TauriCommand<CopyInfo, null>;
    mv: TauriCommand<CopyInfo, null>;
    is_uris_available: TauriCommand<null, boolean>;
    read_uris: TauriCommand<null, Mp.ClipboardData>;
    read_text: TauriCommand<null, string>;
    write_uris: TauriCommand<WriteUriInfo, null>;
    write_text: TauriCommand<string, null>;
    mkdir: TauriCommand<string, null>;
    mkdir_all: TauriCommand<string, null>;
    create: TauriCommand<string, null>;
    read_text_file: TauriCommand<string, string>;
    write_text_file: TauriCommand<WriteFileInfo, null>;
    watch: TauriCommand<NotifyRequest, null>;
    unwatch: TauriCommand<NotifyRequest, null>;
    message: TauriCommand<DialogOptions, Mp.MessageResult>;
    open_terminal: TauriCommand<TerminalArgs, null>;
    launch_new: TauriCommand<null, null>;
    get_args: TauriCommand<null, InitArgs>;
    register_drop_target: TauriCommand<null, null>;
    listen_devices: TauriCommand<null, boolean>;
    unlisten_devices: TauriCommand<null, null>;
    listen_file_drop: TauriCommand<string, null>;
    unlisten_file_drop: TauriCommand<null, null>;
    change_app_menu_items: TauriCommand<Mp.AppMenuItem[], null>;
    change_theme: TauriCommand<Mp.Theme, null>;
    show_file_folder_dialog: TauriCommand<OpenFileFolderOption, string | null>;
    create_symlink: TauriCommand<SymlinkRequest, null>;
    empty_recycle_bin: TauriCommand<null, null>;
    to_thumbnail: TauriCommand<Mp.ThumbnailArgs, number[]>;
    to_image_thumbnail: TauriCommand<string, number[]>;
    is_file: TauriCommand<string, boolean>;
    assoc_icons: TauriCommand<string[], { [key: string]: IconInfo }>;
    get_wsl_names: TauriCommand<null, string[]>;
    undo: TauriCommand<null, null>;
    redo: TauriCommand<null, null>;
};

export class IPCBase {
    invoke = async <K extends keyof TauriCommandMap>(channel: K, data: TauriCommandMap[K]["Request"]): Promise<TauriCommandMap[K]["Response"]> => {
        return await invoke<TauriCommandMap[K]["Response"]>(channel, {
            payload: data,
        });
    };
}

export class IPC extends IPCBase {
    private label: string;
    private funcs: UnlistenFn[] = [];

    constructor(label: RendererName) {
        super();
        this.label = label;
    }

    receiveOnce = async <K extends keyof RendererChannelEventMap>(channel: K, handler: (e: RendererChannelEventMap[K]) => void) => {
        const fn = await once<RendererChannelEventMap[K]>(channel, (e) => handler(e.payload), { target: { kind: "WebviewWindow", label: this.label } });
        this.funcs.push(fn);
    };

    receive = async <K extends keyof RendererChannelEventMap>(channel: K, handler: (e: RendererChannelEventMap[K]) => void) => {
        const fn = await listen<RendererChannelEventMap[K]>(channel, (e) => handler(e.payload), { target: { kind: "WebviewWindow", label: this.label } });
        this.funcs.push(fn);
    };

    receiveAny = async <K extends keyof RendererChannelEventMap>(channel: K, handler: (e: RendererChannelEventMap[K]) => void) => {
        const fn = await once<RendererChannelEventMap[K]>(channel, (e) => handler(e.payload), { target: { kind: "Any" } });
        this.funcs.push(fn);
    };

    receiveTauri = async <T>(event: EventName, handler: (e: T) => void) => {
        const fn = await listen<T>(event, (e) => handler(e.payload), {
            target: { kind: "WebviewWindow", label: this.label },
        });
        this.funcs.push(fn);
    };

    send = async <K extends keyof MainChannelEventMap>(channel: K, data: MainChannelEventMap[K]) => {
        await emit(channel, data);
    };

    sendTo = async <K extends keyof RendererChannelEventMap>(rendererName: RendererName, channel: K, data: RendererChannelEventMap[K]) => {
        await emitTo({ kind: "WebviewWindow", label: rendererName }, channel, data);
    };

    release = () => {
        this.funcs.forEach((fn) => fn());
    };
}
