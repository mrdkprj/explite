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
};

type Volume = {
    mount_point: string;
    volume_label: string;
    available_units: number;
    total_units: number;
};

export type Dirent = {
    name: string;
    parent_path: string;
    full_path: string;
    mime_type: string;
    attributes: FileAttribute;
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
};

type DialogOptions = {
    dialog_type: "message" | "confirm" | "ask";
    title?: string;
    kind?: "info" | "warning" | "error";
    ok_label?: string;
    cancel_label?: string;
    message: string;
};

type WatchRequest = {
    path: string;
    recursive: boolean;
};

type InitArgs = {
    urls: string[];
    locales: string[];
};

type TauriCommandMap = {
    prepare_menu: TauriCommand<undefined, undefined>;
    open_list_context_menu: TauriCommand<ContextMenuArg, undefined>;
    open_fav_context_menu: TauriCommand<Mp.Position, undefined>;
    exists: TauriCommand<string, boolean>;
    open_path: TauriCommand<string, undefined>;
    open_path_with: TauriCommand<OpenWithArg, undefined>;
    open_in_new_window: TauriCommand<string, undefined>;
    show_app_selector: TauriCommand<string, undefined>;
    open_property_dielog: TauriCommand<string, undefined>;
    readdir: TauriCommand<ReadDirRequest, Dirent[]>;
    rename: TauriCommand<RenameInfo, boolean>;
    list_volumes: TauriCommand<undefined, Volume[]>;
    start_drag: TauriCommand<string[], undefined>;
    stat: TauriCommand<string, FileAttribute>;
    get_mime_type: TauriCommand<string, string>;
    trash: TauriCommand<string[], undefined>;
    delete: TauriCommand<string[], undefined>;
    undelete: TauriCommand<string[], undefined>;
    copy: TauriCommand<CopyInfo, undefined>;
    mv: TauriCommand<CopyInfo, undefined>;
    is_uris_available: TauriCommand<undefined, boolean>;
    read_uris: TauriCommand<undefined, Mp.ClipboardData>;
    read_text: TauriCommand<undefined, string>;
    write_uris: TauriCommand<WriteUriInfo, undefined>;
    write_text: TauriCommand<string, undefined>;
    mkdir: TauriCommand<string, undefined>;
    mkdir_all: TauriCommand<string, undefined>;
    create: TauriCommand<string, undefined>;
    read_text_file: TauriCommand<string, string>;
    write_text_file: TauriCommand<WriteFileInfo, undefined>;
    watch: TauriCommand<WatchRequest, undefined>;
    unwatch: TauriCommand<string, undefined>;
    message: TauriCommand<DialogOptions, boolean>;
    open_terminal: TauriCommand<string, undefined>;
    launch_new: TauriCommand<undefined, undefined>;
    get_args: TauriCommand<undefined, InitArgs>;
    register_drop_target: TauriCommand<undefined, undefined>;
    listen_devices: TauriCommand<undefined, boolean>;
    unlisten_devices: TauriCommand<undefined, undefined>;
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
