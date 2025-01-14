use nonstd::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::WebviewWindow;
mod menu;
mod watcher;

fn get_window_handel(window: &WebviewWindow) -> isize {
    window.hwnd().unwrap().0 as _
}

#[tauri::command]
fn exists(payload: String) -> bool {
    PathBuf::from(payload).exists()
}

#[tauri::command]
fn open_path(window: WebviewWindow, payload: String) {
    shell::open_path(get_window_handel(&window), payload).unwrap();
}

#[tauri::command]
fn open_path_with(window: WebviewWindow, payload: String) {
    shell::open_path_with(get_window_handel(&window), payload).unwrap();
}

#[tauri::command]
fn open_property_dielog(window: WebviewWindow, payload: String) {
    shell::open_file_property(get_window_handel(&window), payload).unwrap();
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReadDirRequest {
    directory: String,
    recursive: bool,
}

#[tauri::command]
fn readdir(payload: ReadDirRequest) -> Vec<Dirent> {
    fs::readdir(payload.directory, payload.recursive).unwrap_or_default()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RenameInfo {
    new: String,
    old: String,
}
#[tauri::command]
fn rename(payload: RenameInfo) -> bool {
    std::fs::rename(payload.old, payload.new).is_ok()
}

#[tauri::command]
fn list_volumes() -> Vec<Volume> {
    fs::list_volumes().unwrap_or_default()
}

#[tauri::command]
fn start_drag(payload: Vec<String>) {
    drag_drop::start_drag(payload, Operation::Copy).unwrap();
}

#[tauri::command]
fn get_file_attribute(payload: String) -> FileAttribute {
    fs::get_file_attribute(&payload).unwrap()
}

#[tauri::command]
fn trash_item(payload: String) {
    shell::trash(payload).unwrap()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CopyInfo {
    from: String,
    to: String,
}
#[tauri::command]
fn copy_file(payload: CopyInfo) {
    std::fs::copy(payload.from, payload.to).unwrap();
}

#[tauri::command]
fn mv(payload: CopyInfo) {
    fs::mv(payload.from, payload.to, None, None).unwrap();
}

#[tauri::command]
fn is_uris_available() -> bool {
    clipboard::is_uris_available()
}

#[tauri::command]
fn read_uris(window: WebviewWindow) -> ClipboardData {
    clipboard::read_uris(get_window_handel(&window)).unwrap()
}

#[tauri::command]
fn read_text(window: WebviewWindow) -> String {
    clipboard::read_text(get_window_handel(&window)).unwrap()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)]
struct WriteUriInfo {
    fullPaths: Vec<String>,
    operation: Operation,
}

#[tauri::command]
fn write_uris(window: WebviewWindow, payload: WriteUriInfo) {
    clipboard::write_uris(
        get_window_handel(&window),
        &payload.fullPaths,
        payload.operation,
    )
    .unwrap();
}

#[tauri::command]
fn write_text(window: WebviewWindow, payload: String) {
    clipboard::write_text(get_window_handel(&window), payload).unwrap();
}

#[tauri::command]
fn mkdir(payload: String) {
    std::fs::create_dir(payload).unwrap();
}

#[tauri::command]
fn mkdir_all(payload: String) {
    std::fs::create_dir_all(payload).unwrap();
}

#[tauri::command]
fn create(payload: String) {
    std::fs::File::create(payload).unwrap();
}

#[tauri::command]
fn read_text_file(payload: String) -> String {
    std::fs::read_to_string(payload).unwrap()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)]
struct WriteFileInfo {
    fullPath: String,
    data: String,
}

#[tauri::command]
fn write_text_file(payload: WriteFileInfo) {
    std::fs::write(payload.fullPath, payload.data).unwrap();
}

#[tauri::command]
fn prepare_menu(window: WebviewWindow, payload: menu::MenuInfo) {
    let window_handle = get_window_handel(&window);
    menu::create_list_menu(window_handle, payload);
    menu::create_fav_menu(window_handle);
}

#[tauri::command]
async fn open_list_context_menu(window: WebviewWindow, payload: menu::Position) {
    menu::popup_menu(&window, menu::LIST, payload).await;
}

#[tauri::command]
async fn open_fav_context_menu(window: WebviewWindow, payload: menu::Position) {
    menu::popup_menu(&window, menu::FAV, payload).await;
}

#[tauri::command]
async fn watch(window: WebviewWindow, payload: String) {
    let _ = watcher::watch(&window, payload).await;
}

#[tauri::command]
fn unwatch(payload: String) {
    watcher::unwatch(payload);
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
            open_property_dielog,
            readdir,
            rename,
            list_volumes,
            start_drag,
            get_file_attribute,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
