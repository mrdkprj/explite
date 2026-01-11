use std::{collections::HashMap, path::PathBuf};

use crate::{
    session::Session,
    watcher::{self, WatchTx},
    IconInfo,
};
use tauri::Manager;
use zouni::Size;

pub fn setup(app: &tauri::App) {
    let mut urls = Vec::new();
    for arg in std::env::args().skip(1) {
        urls.push(arg);
    }
    app.manage(urls);

    let id = &app.config().identifier;
    if let Ok(session) = crate::session::start(id) {
        app.manage(session);
    }

    let (tx_cmd, rx_cmd) = crossbeam_channel::bounded(5);
    app.manage(WatchTx(tx_cmd));
    watcher::spwan_watcher(app.app_handle(), rx_cmd).unwrap();
}

pub fn exit(app: &tauri::AppHandle) {
    if let Some(session) = app.try_state::<Session>() {
        crate::session::end(session.inner());
    }
}

fn get_extension(full_path: &str) -> String {
    let path = PathBuf::from(full_path);
    if let Some(extension) = path.extension() {
        if extension == "exe" {
            path.file_name().unwrap_or_default().to_string_lossy().to_string()
        } else {
            format!(".{}", extension.to_string_lossy())
        }
    } else {
        path.file_name().unwrap_or_default().to_string_lossy().to_string()
    }
}

pub fn assoc_icons(full_paths: Vec<String>) -> Result<HashMap<String, IconInfo>, String> {
    let mut icons = HashMap::new();

    for full_path in full_paths {
        if let Ok(icon) = zouni::shell::extract_icon(
            &full_path,
            Size {
                width: 100,
                height: 100,
            },
        ) {
            #[cfg(target_os = "windows")]
            {
                let small = zouni::shell::extract_icon(
                    &full_path,
                    Size {
                        width: 16,
                        height: 16,
                    },
                )?;
                let _ = icons.insert(
                    get_extension(&full_path),
                    IconInfo {
                        full_path: None,
                        small: small.png,
                        large: icon.png,
                    },
                );
            }
            #[cfg(target_os = "linux")]
            {
                let data = std::fs::read(&icon.file).map_err(|e| e.to_string())?;
                let _ = icons.insert(
                    get_extension(&full_path),
                    IconInfo {
                        full_path: Some(icon.file),
                        small: data.clone(),
                        large: data.clone(),
                    },
                );
            }
        }
    }
    Ok(icons)
}
