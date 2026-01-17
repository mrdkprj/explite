use crate::{session::Session, watcher::WatcherCommand};
use dialog::DialogOptions;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, env, path::PathBuf};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use zouni::dialog::MessageResult;
mod dialog;
mod helper;
mod menu;
mod session;
mod watcher;
use watcher::WatchTx;

#[cfg(target_os = "linux")]
fn get_window_handel(window: &WebviewWindow) -> isize {
    use gtk::{ffi::GtkApplicationWindow, glib::translate::ToGlibPtr};

    let ptr: *mut GtkApplicationWindow = window.gtk_window().unwrap().to_glib_none().0;
    ptr as isize
}

#[cfg(target_os = "windows")]
fn get_window_handel(window: &WebviewWindow) -> isize {
    window.hwnd().unwrap().0 as _
}

#[tauri::command]
fn exists(payload: String) -> bool {
    PathBuf::from(payload).exists()
}

#[tauri::command]
fn open_path(payload: String) -> Result<(), String> {
    zouni::shell::open_path(payload)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenWithArg {
    full_path: String,
    app_path: String,
}
#[tauri::command]
fn open_path_with(payload: OpenWithArg) -> Result<(), String> {
    zouni::shell::open_path_with(payload.full_path, payload.app_path)
}

#[tauri::command]
fn show_app_selector(payload: String) -> Result<(), String> {
    zouni::shell::show_open_with_dialog(payload)
}

#[tauri::command]
fn open_property_dielog(payload: String) -> Result<(), String> {
    zouni::shell::open_file_property(payload)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReadDirRequest {
    directory: String,
    recursive: bool,
}

#[tauri::command]
fn readdir(payload: ReadDirRequest) -> Vec<zouni::Dirent> {
    zouni::fs::readdir(payload.directory, payload.recursive, true).unwrap_or_default()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RenameInfo {
    new: String,
    old: String,
}
#[tauri::command]
fn rename(payload: RenameInfo) -> Result<(), String> {
    std::fs::rename(payload.old, payload.new).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_volumes() -> Vec<zouni::Volume> {
    zouni::fs::list_volumes().unwrap_or_default()
}

#[tauri::command]
fn start_drag(payload: Vec<String>) -> Result<(), String> {
    zouni::drag_drop::start_drag(payload, zouni::Operation::Copy)
}

#[tauri::command]
fn stat(payload: String) -> Result<zouni::FileAttribute, String> {
    zouni::fs::stat(&payload)
}

#[tauri::command]
fn get_mime_type(payload: String) -> String {
    zouni::fs::get_mime_type(payload)
}

#[tauri::command]
fn trash(payload: Vec<String>) -> Result<(), String> {
    zouni::fs::trash_all(&payload)
}

#[tauri::command]
fn delete(payload: Vec<String>) -> Result<(), String> {
    zouni::fs::delete_all(&payload)
}

#[tauri::command]
fn undelete(payload: Vec<String>) -> Result<(), String> {
    zouni::fs::undelete(&payload)
}

#[tauri::command]
fn undelete_by_time(payload: Vec<zouni::RecycleBinItem>) -> Result<(), String> {
    zouni::fs::undelete_by_time(&payload)
}

#[tauri::command]
fn delete_from_recycle_bin(payload: Vec<zouni::RecycleBinItem>) -> Result<(), String> {
    zouni::fs::delete_from_recycle_bin(&payload)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CopyInfo {
    from: Vec<String>,
    to: String,
}
#[allow(unused_variables)]
#[tauri::command]
async fn copy(window: WebviewWindow, payload: CopyInfo) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        zouni::fs::copy_all(&payload.from, payload.to)
    }
    #[cfg(target_os = "linux")]
    {
        window
            .run_on_main_thread(move || {
                gtk::glib::spawn_future_local(async move { zouni::fs::copy_all(&payload.from, payload.to).await });
            })
            .map_err(|e| e.to_string())
    }
}

#[allow(unused_variables)]
#[tauri::command]
async fn mv(window: WebviewWindow, payload: CopyInfo) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        zouni::fs::mv_all(&payload.from, payload.to)
    }
    #[cfg(target_os = "linux")]
    {
        window
            .run_on_main_thread(move || {
                gtk::glib::spawn_future_local(async move { zouni::fs::mv_all(&payload.from, payload.to).await });
            })
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn is_uris_available() -> bool {
    zouni::clipboard::is_uris_available()
}

#[tauri::command]
fn read_uris(window: WebviewWindow) -> Result<zouni::ClipboardData, String> {
    zouni::clipboard::read_uris(get_window_handel(&window))
}

#[tauri::command]
fn read_text(window: WebviewWindow) -> Result<String, String> {
    zouni::clipboard::read_text(get_window_handel(&window))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)]
struct WriteUriInfo {
    fullPaths: Vec<String>,
    operation: zouni::Operation,
}

#[tauri::command]
fn write_uris(window: WebviewWindow, payload: WriteUriInfo) -> Result<(), String> {
    zouni::clipboard::write_uris(get_window_handel(&window), &payload.fullPaths, payload.operation)
}

#[tauri::command]
fn write_text(window: WebviewWindow, payload: String) -> Result<(), String> {
    zouni::clipboard::write_text(get_window_handel(&window), payload)
}

#[tauri::command]
fn mkdir(payload: String) -> Result<(), String> {
    std::fs::create_dir(payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn mkdir_all(payload: String) -> Result<(), String> {
    std::fs::create_dir_all(payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn create(payload: String) -> Result<(), String> {
    match std::fs::File::create_new(payload) {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn read_text_file(payload: String) -> Result<String, String> {
    std::fs::read_to_string(payload).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)]
struct WriteFileInfo {
    fullPath: String,
    data: String,
}

#[tauri::command]
fn write_text_file(payload: WriteFileInfo) -> Result<(), String> {
    std::fs::write(payload.fullPath, payload.data).map_err(|e| e.to_string())
}

#[tauri::command]
fn prepare_menu(window: WebviewWindow) {
    let window_handle = get_window_handel(&window);
    menu::create(window.app_handle(), window_handle);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppMenuItem {
    label: String,
    path: String,
    target: String,
}
#[tauri::command]
fn change_app_menu_items(window: WebviewWindow, payload: Vec<AppMenuItem>) {
    menu::change_app_menu_items(window.app_handle(), payload);
}

#[tauri::command]
fn change_theme(window: WebviewWindow, payload: String) {
    let (tauri_them, menu_theme) = match payload.as_str() {
        "dark" => (tauri::Theme::Dark, wcpopup::config::Theme::Dark),
        "light" => (tauri::Theme::Light, wcpopup::config::Theme::Light),
        _ => (tauri::Theme::Light, wcpopup::config::Theme::System),
    };
    let _ = window.set_theme(Some(tauri_them));
    menu::change_menu_theme(window.app_handle(), menu_theme);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenFileFolderOption {
    title: String,
    default_path: String,
    select_folder: bool,
}
#[tauri::command]
async fn show_file_folder_dialog(payload: OpenFileFolderOption) -> Option<String> {
    if payload.select_folder {
        dialog::show_folder_dialog(payload.title, payload.default_path).await
    } else {
        dialog::show_file_dialog(payload.title, payload.default_path).await
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SymlinkRequest {
    path: String,
    link_path: String,
}
#[tauri::command]
fn create_symlink(payload: SymlinkRequest) -> Result<(), String> {
    zouni::fs::create_symlink(payload.path, payload.link_path)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ContextMenuArg {
    position: menu::Position,
    full_path: String,
    show_admin_runas: bool,
}
#[tauri::command]
async fn open_list_context_menu(window: WebviewWindow, payload: ContextMenuArg) {
    #[cfg(target_os = "windows")]
    {
        menu::popup_menu(window.app_handle(), window.label(), menu::LIST, payload.position, Some(payload.full_path), payload.show_admin_runas).await;
    }
    #[cfg(target_os = "linux")]
    {
        let app_handle = window.app_handle().clone();
        app_handle
            .run_on_main_thread(move || {
                gtk::glib::spawn_future_local(async move {
                    menu::popup_menu(window.app_handle(), window.label(), menu::LIST, payload.position, Some(payload.full_path), payload.show_admin_runas).await;
                });
            })
            .unwrap();
    }
}

#[tauri::command]
async fn open_fav_context_menu(window: WebviewWindow, payload: menu::Position) {
    #[cfg(target_os = "windows")]
    {
        menu::popup_menu(window.app_handle(), window.label(), menu::FAV, payload, None, false).await;
    }
    #[cfg(target_os = "linux")]
    {
        let app_handle = window.app_handle().clone();
        app_handle
            .run_on_main_thread(move || {
                gtk::glib::spawn_future_local(async move {
                    menu::popup_menu(window.app_handle(), window.label(), menu::FAV, payload, None, false).await;
                });
            })
            .unwrap();
    }
}

#[tauri::command]
async fn open_recycle_context_menu(window: WebviewWindow, payload: ContextMenuArg) {
    #[cfg(target_os = "windows")]
    {
        menu::popup_menu(window.app_handle(), window.label(), menu::RECYCLE_BIN, payload.position, Some(payload.full_path), false).await;
    }
    #[cfg(target_os = "linux")]
    {
        let app_handle = window.app_handle().clone();
        app_handle
            .run_on_main_thread(move || {
                gtk::glib::spawn_future_local(async move {
                    menu::popup_menu(window.app_handle(), window.label(), menu::RECYCLE_BIN, payload.position, Some(payload.full_path), false).await;
                });
            })
            .unwrap();
    }
}

#[tauri::command]
fn watch(app: AppHandle, payload: String) -> Result<(), String> {
    if let Some(tx) = app.try_state::<WatchTx>() {
        tx.inner().0.send(WatcherCommand::Watch(payload)).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn unwatch(app: AppHandle, payload: String) -> Result<(), String> {
    if let Some(tx) = app.try_state::<WatchTx>() {
        tx.inner().0.send(WatcherCommand::Unwatch(payload)).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
async fn message(payload: DialogOptions) -> MessageResult {
    dialog::show(payload).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TerminalArgs {
    path: String,
    admin: bool,
}
#[tauri::command]
fn open_terminal(payload: TerminalArgs) -> Result<(), String> {
    if cfg!(windows) {
        let arg = format!("wt.exe -d '{}'", payload.path);
        if payload.admin {
            zouni::shell::execute_as(arg, "powershell")
        } else {
            zouni::shell::execute(arg, "powershell")
        }
    } else {
        let commandline_arg = format!("--working-directory={}", payload.path);
        zouni::shell::execute(commandline_arg, "gnome-terminal")
    }
}

#[tauri::command]
fn launch_new(app: AppHandle) -> Result<(), String> {
    let app_path = tauri::process::current_binary(&app.env()).map_err(|e| e.to_string())?;

    if cfg!(windows) {
        zouni::shell::open_path(app_path)
    } else {
        std::process::Command::new(app_path).spawn().map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
fn open_in_new_window(app: AppHandle, payload: String) -> Result<(), String> {
    let app_path = tauri::process::current_binary(&app.env()).map_err(|e| e.to_string())?;
    if cfg!(windows) {
        zouni::shell::open_path_with(payload, app_path)
    } else {
        std::process::Command::new(app_path).arg(payload).spawn().map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct InitArgs {
    urls: Vec<String>,
    locales: Vec<String>,
    restore_position: bool,
}
#[tauri::command]
fn get_args(app: AppHandle) -> InitArgs {
    if let Some(urls) = app.try_state::<Vec<String>>() {
        return InitArgs {
            urls: urls.inner().clone(),
            locales: vec![zouni::shell::get_locale()],
            restore_position: app.try_state::<Session>().is_some(),
        };
    }

    InitArgs {
        urls: Vec::new(),
        locales: Vec::new(),
        restore_position: app.try_state::<Session>().is_some(),
    }
}

#[allow(unused_variables)]
#[tauri::command]
fn register_drop_target(window: WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        zouni::drag_drop::register(window.hwnd().unwrap().0 as isize)
    }
    #[cfg(target_os = "linux")]
    {
        Ok(())
    }
}

#[tauri::command]
fn listen_devices(window: WebviewWindow) -> bool {
    zouni::device::listen(move |event| {
        window.emit("device_event", event).unwrap();
    })
}

#[tauri::command]
fn unlisten_devices() {
    zouni::device::unlisten();
}

#[allow(unused_variables)]
#[tauri::command]
fn listen_file_drop(window: WebviewWindow, app: AppHandle) -> tauri::Result<()> {
    #[cfg(target_os = "windows")]
    {
        let label = window.label().to_string();
        window.with_webview(move |webview| {
            zouni::webview2::register_file_drop(unsafe { &webview.controller().CoreWebView2().unwrap() }, Some("viewContent".to_string()), move |event| {
                app.get_webview_window(&label).unwrap().emit("tauri://drag-drop", event).unwrap();
            })
            .unwrap();
        })
    }
    #[cfg(target_os = "linux")]
    {
        Ok(())
    }
}

#[tauri::command]
fn unlisten_file_drop() {
    #[cfg(target_os = "windows")]
    zouni::webview2::clear();
}

#[tauri::command]
fn read_recycle_bin() -> Result<Vec<zouni::RecycleBinDirent>, String> {
    zouni::fs::read_recycle_bin()
}

#[tauri::command]
fn empty_recycle_bin() -> Result<(), String> {
    zouni::fs::empty_recycle_bin(None)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ThumbnailArgs {
    full_path: String,
    width: u32,
    height: u32,
}
#[tauri::command]
async fn to_thumbnail(payload: ThumbnailArgs) -> Result<Vec<u8>, String> {
    helper::video_thumbnail(payload).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn to_image_thumbnail(payload: String) -> Result<Vec<u8>, String> {
    helper::image_thumbnail(payload).await.map_err(|e| e.to_string())
}

#[tauri::command]
fn is_file(payload: String) -> bool {
    PathBuf::from(payload).is_file()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct IconInfo {
    full_path: Option<String>,
    small: Vec<u8>,
    large: Vec<u8>,
}
#[tauri::command]
fn assoc_icons(payload: Vec<String>) -> Result<HashMap<String, IconInfo>, String> {
    helper::assoc_icons(payload)
}

#[tauri::command]
async fn get_wsl_names() -> Result<Vec<String>, String> {
    helper::get_wsl_names().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            rs_vips::Vips::init("name").unwrap();
            helper::setup(app);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                helper::exit(window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            prepare_menu,
            open_list_context_menu,
            open_fav_context_menu,
            open_recycle_context_menu,
            exists,
            open_path,
            open_path_with,
            show_app_selector,
            open_property_dielog,
            readdir,
            rename,
            list_volumes,
            start_drag,
            stat,
            get_mime_type,
            trash,
            delete,
            undelete,
            undelete_by_time,
            copy,
            mv,
            is_uris_available,
            read_uris,
            read_text,
            write_uris,
            write_text,
            mkdir,
            mkdir_all,
            create,
            read_text_file,
            write_text_file,
            watch,
            unwatch,
            open_terminal,
            message,
            launch_new,
            get_args,
            register_drop_target,
            open_in_new_window,
            listen_devices,
            unlisten_devices,
            listen_file_drop,
            unlisten_file_drop,
            change_app_menu_items,
            change_theme,
            show_file_folder_dialog,
            create_symlink,
            read_recycle_bin,
            empty_recycle_bin,
            delete_from_recycle_bin,
            to_thumbnail,
            to_image_thumbnail,
            is_file,
            assoc_icons,
            get_wsl_names
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
