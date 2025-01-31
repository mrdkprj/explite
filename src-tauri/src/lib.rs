use nonstd::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::WebviewWindow;
mod menu;
mod watcher;

#[cfg(target_os = "linux")]
fn get_window_handel(_window: &WebviewWindow) -> isize {
    0
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
    shell::open_path(payload)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenWithArg {
    full_path: String,
    app_path: String,
}
#[tauri::command]
fn open_path_with(payload: OpenWithArg) -> Result<(), String> {
    shell::open_path_with(payload.full_path, payload.app_path)
}

#[tauri::command]
fn show_app_selector(payload: String) -> Result<(), String> {
    shell::show_open_with_dialog(payload)
}

#[tauri::command]
fn open_property_dielog(payload: String) -> Result<(), String> {
    shell::open_file_property(payload)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReadDirRequest {
    directory: String,
    recursive: bool,
}

#[tauri::command]
fn readdir(payload: ReadDirRequest) -> Vec<Dirent> {
    fs::readdir(payload.directory, payload.recursive, true).unwrap_or_default()
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
fn list_volumes() -> Vec<Volume> {
    fs::list_volumes().unwrap_or_default()
}

#[tauri::command]
fn start_drag(payload: Vec<String>) -> Result<(), String> {
    drag_drop::start_drag(payload, Operation::Copy)
}

#[tauri::command]
fn stat(payload: String) -> Result<FileAttribute, String> {
    fs::stat(&payload)
}

#[tauri::command]
fn get_mime_type(payload: String) -> String {
    fs::get_mime_type(payload)
}

#[tauri::command]
fn trash_item(payload: String) -> Result<(), String> {
    shell::trash(payload)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CopyInfo {
    from: String,
    to: String,
}
#[tauri::command]
fn copy_file(payload: CopyInfo) -> Result<u64, String> {
    std::fs::copy(payload.from, payload.to).map_err(|e| e.to_string())
}

#[tauri::command]
fn mv(payload: CopyInfo) -> Result<(), String> {
    fs::mv(payload.from, payload.to, None, None)
}

#[tauri::command]
fn is_uris_available() -> bool {
    clipboard::is_uris_available()
}

#[tauri::command]
fn read_uris(window: WebviewWindow) -> Result<ClipboardData, String> {
    clipboard::read_uris(get_window_handel(&window))
}

#[tauri::command]
fn read_text(window: WebviewWindow) -> Result<String, String> {
    clipboard::read_text(get_window_handel(&window))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)]
struct WriteUriInfo {
    fullPaths: Vec<String>,
    operation: Operation,
}

#[tauri::command]
fn write_uris(window: WebviewWindow, payload: WriteUriInfo) -> Result<(), String> {
    clipboard::write_uris(
        get_window_handel(&window),
        &payload.fullPaths,
        payload.operation,
    )
}

#[tauri::command]
fn write_text(window: WebviewWindow, payload: String) -> Result<(), String> {
    clipboard::write_text(get_window_handel(&window), payload)
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
    match std::fs::File::create(payload) {
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
    menu::create_list_menu(window_handle);
    menu::create_fav_menu(window_handle);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ContextMenuArg {
    position: menu::Position,
    full_path: String,
}
#[tauri::command]
async fn open_list_context_menu(window: WebviewWindow, payload: ContextMenuArg) {
    #[cfg(target_os = "windows")]
    {
        menu::popup_menu(
            &window,
            menu::LIST,
            payload.position,
            Some(payload.full_path),
        )
        .await;
    }
    #[cfg(target_os = "linux")]
    {
        gtk::glib::spawn_future_local(async move {
            menu::popup_menu(
                &window,
                menu::LIST,
                payload.position,
                Some(payload.full_path),
            )
            .await;
        });
    }
}

#[tauri::command]
async fn open_fav_context_menu(window: WebviewWindow, payload: menu::Position) {
    #[cfg(target_os = "windows")]
    {
        menu::popup_menu(&window, menu::FAV, payload, None).await;
    }
    #[cfg(target_os = "linux")]
    {
        gtk::glib::spawn_future_local(async move {
            menu::popup_menu(&window, menu::FAV, payload, None).await;
        });
    }
}

#[tauri::command]
async fn watch(window: WebviewWindow, payload: String) {
    let _ = watcher::watch(&window, payload).await;
}

#[tauri::command]
fn unwatch(payload: String) {
    watcher::unwatch(payload);
}

#[tauri::command]
fn open_terminal(payload: String) -> Result<(), String> {
    let mut arg = "-d ".to_string();
    arg.push_str(&payload);
    nonstd::shell::open_path_with(arg, "wt.exe")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(deprecated)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            prepare_menu,
            open_list_context_menu,
            open_fav_context_menu,
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
            trash_item,
            copy_file,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
