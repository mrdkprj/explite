use crate::{
    manager::{self, create_new_window},
    menu,
    watcher::{self, WatchTx},
    IconInfo, ThumbnailArgs,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};
use tauri::{AppHandle, Manager, WebviewWindow};
use zouni::{process::SpawnOption, Size};

static RESTORE_POSITION: OnceLock<bool> = OnceLock::new();
static LOCALE: OnceLock<String> = OnceLock::new();

pub fn setup(app: &tauri::App) {
    let mut urls = Vec::new();
    for arg in std::env::args().skip(1) {
        urls.push(arg);
    }
    let args = new_init_arg(urls, false, None);
    app.manage(Mutex::new(InitArg {
        args: Some(args),
    }));

    let (tx_cmd, rx_cmd) = smol::channel::bounded(5);
    app.manage(WatchTx(tx_cmd));
    watcher::spwan_watcher(app.app_handle(), rx_cmd).unwrap();
    manager::init(app.handle());
    menu::init(app.handle());
}

pub fn new_window(window: WebviewWindow, detach: bool, path: Option<String>) {
    let app = window.app_handle();
    let state = app.state::<Mutex<InitArg>>();
    let mut state = state.lock().unwrap();

    let urls = if let Some(path) = path {
        vec![path]
    } else {
        Vec::new()
    };
    let args = new_init_arg(urls, detach, Some(window.label()));
    state.args = Some(args);
    create_new_window(app);
}

struct InitArg {
    args: Option<Args>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Args {
    urls: Vec<String>,
    locales: Vec<String>,
    restore_position: bool,
    opener: String,
    detach: bool,
}

fn new_init_arg(urls: Vec<String>, detach: bool, opener: Option<&str>) -> Args {
    let locale = LOCALE.get_or_init(zouni::shell::get_locale).to_string();
    let restore_position = if RESTORE_POSITION.get().is_none() {
        *RESTORE_POSITION.get_or_init(|| true)
    } else {
        false
    };

    Args {
        urls,
        locales: vec![locale],
        restore_position,
        opener: opener.unwrap_or_default().to_string(),
        detach,
    }
}

pub fn get_init_args(app: AppHandle) -> Args {
    let state = app.state::<Mutex<InitArg>>();
    let mut state = state.lock().unwrap();
    state.args.take().unwrap_or_default()
}

pub fn exit(app: &AppHandle, label: &str) {
    menu::remove(app, label);
    manager::remove_window(app, label);
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

pub async fn assoc_icons(full_paths: Vec<String>) -> Result<HashMap<String, IconInfo>, String> {
    #[cfg(target_os = "windows")]
    {
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
            }
        }

        Ok(icons)
    }

    #[cfg(target_os = "linux")]
    {
        let (tx, rx) = smol::channel::bounded(1);
        gtk::glib::MainContext::default().invoke(move || {
            gtk::glib::spawn_future_local(async move {
                let mut icons = HashMap::new();
                for full_path in full_paths {
                    if let Ok(icon) = zouni::shell::extract_icon(
                        &full_path,
                        Size {
                            width: 100,
                            height: 100,
                        },
                    ) {
                        if let Ok(data) = std::fs::read(&icon.file) {
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
                tx.send(icons).await.unwrap();
            });
        });
        Ok(rx.recv().await.unwrap())
    }
}

pub async fn get_wsl_names() -> Result<Vec<String>, zouni::process::CommandStatus> {
    let result = zouni::process::spawn(SpawnOption {
        program: "wsl".to_string(),
        args: Some(vec!["-l".to_string(), "-q".to_string()]),
        cancellation_token: Some("wsl".to_string()),
    })
    .await
    .map_err(|e| e.status)?;

    if result.stdout.is_empty() {
        Ok(Vec::new())
    } else {
        Ok(result.stdout.replace(char::from(0), "").split("\r\n").filter(|&x| !x.is_empty()).map(|s| s.to_string()).collect())
    }
}

pub async fn video_thumbnail(args: ThumbnailArgs) -> Result<Vec<u8>, String> {
    tauri::async_runtime::spawn(async move {
        zouni::media::extract_video_thumbnail(
            args.full_path,
            Some(zouni::Size {
                width: args.width,
                height: args.height,
            }),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

pub async fn image_thumbnail(file_path: String) -> Result<Vec<u8>, String> {
    if file_path.ends_with(".ico") {
        return std::fs::read(file_path).map_err(|e| e.to_string());
    }

    tauri::async_runtime::spawn(async move {
        rs_vips::VipsImage::new_from_file(file_path).map_err(|e| e.to_string())?.thumbnail_image(100).map_err(|e| e.to_string())?.webpsave_buffer().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
