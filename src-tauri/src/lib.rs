use dialog::DialogOptions;
use nonstd::*;
use serde::{Deserialize, Serialize};
use std::{env, path::PathBuf};
use tauri::{AppHandle, Manager, WebviewWindow};
mod dialog;
mod menu;
mod watcher;

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
fn trash(payload: Vec<String>) -> Result<(), String> {
    fs::trash_all(&payload)
}

#[tauri::command]
fn delete(payload: Vec<String>) -> Result<(), String> {
    fs::delete_all(&payload)
}

#[tauri::command]
fn undelete(payload: Vec<String>) -> Result<(), String> {
    fs::undelete(payload)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CopyInfo {
    from: Vec<String>,
    to: String,
}
#[tauri::command]
fn copy(payload: CopyInfo) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        fs::copy_all(&payload.from, payload.to)
    }
    #[cfg(target_os = "linux")]
    {
        fs::copy_all(&payload.from, payload.to, None)
    }
}

#[tauri::command]
fn mv(payload: CopyInfo) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        fs::mv_all(&payload.from, payload.to)
    }
    #[cfg(target_os = "linux")]
    {
        fs::mv_all(&payload.from, payload.to, None)
    }
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
    clipboard::write_uris(get_window_handel(&window), &payload.fullPaths, payload.operation)
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
        menu::popup_menu(&window, menu::LIST, payload.position, Some(payload.full_path)).await;
    }
    #[cfg(target_os = "linux")]
    {
        let gtk_window = window.clone();
        window
            .run_on_main_thread(move || {
                gtk::glib::spawn_future_local(async move {
                    menu::popup_menu(&gtk_window, menu::LIST, payload.position, Some(payload.full_path)).await;
                });
            })
            .unwrap();
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
        let gtk_window = window.clone();
        window
            .run_on_main_thread(move || {
                gtk::glib::spawn_future_local(async move {
                    menu::popup_menu(&gtk_window, menu::FAV, payload, None).await;
                });
            })
            .unwrap();
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
async fn message(payload: DialogOptions) -> bool {
    dialog::show(payload).await
}

#[tauri::command]
fn open_terminal(payload: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut arg = "wt.exe -d ".to_string();
        arg.push_str(&payload);
        nonstd::shell::execute(arg, "powershell")
    }
    #[cfg(target_os = "linux")]
    {   
        let mut commandline_arg = "gnome-terminal --working-directory=".to_string();
        commandline_arg.push_str(&payload);
        nonstd::shell::execute("/", commandline_arg)
    }
}

#[tauri::command]
fn launch_new(app: AppHandle) -> Result<(), String> {
    let path = tauri::process::current_binary(&app.env()).map_err(|e| e.to_string())?;
    nonstd::shell::open_path(path)
}

#[tauri::command]
fn get_args(app: AppHandle) -> Vec<String> {
    if let Some(urls) = app.try_state::<Vec<String>>() {
        return urls.inner().clone();
    }
    Vec::new()
}

#[allow(unused_variables)]
#[tauri::command]
fn register_drop_target(window: WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        nonstd::drag_drop::register(window.hwnd().unwrap())
    }
    #[cfg(target_os = "linux")]
    {
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(deprecated)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let mut urls = Vec::new();
            for arg in env::args().skip(1) {
                urls.push(arg);
            }

            app.manage(urls);

            Ok(())
        })
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
            trash,
            delete,
            undelete,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
