use async_std::{
    channel::{self, Receiver},
    sync::Mutex,
    task::block_on,
};
#[cfg(target_os = "linux")]
use notify::INotifyWatcher;
#[cfg(target_os = "windows")]
use notify::ReadDirectoryChangesWatcher;
use notify::{
    event::{ModifyKind, RenameMode},
    recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{Emitter, EventTarget, WebviewWindow};

#[cfg(target_os = "linux")]
static WATCHER: Lazy<Mutex<Option<INotifyWatcher>>> = Lazy::new(|| Mutex::new(None));
#[cfg(target_os = "windows")]
static WATCHER: Lazy<Mutex<Option<ReadDirectoryChangesWatcher>>> = Lazy::new(|| Mutex::new(None));
static PENDING_FROM: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));
static PENDING_TO: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));

const WATCH_EVENT_NAME: &str = "watch_event";
const CREATE: &str = "Create";
const REMOVE: &str = "Remove";
const RENAME: &str = "Rename";

fn async_watcher() -> notify::Result<(RecommendedWatcher, Receiver<notify::Result<Event>>)> {
    let (tx, rx) = channel::bounded(1);

    // Automatically select the best implementation for your platform.
    // You can also access each implementation directly e.g. INotifyWatcher.
    let watcher = recommended_watcher(move |res| {
        block_on(async {
            tx.send(res).await.unwrap();
        })
    })?;

    Ok((watcher, rx))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WatchEvent {
    operation: String,
    to_paths: Vec<String>,
    from_paths: Vec<String>,
}

pub async fn watch(window: &WebviewWindow, file_path: String, recursive: bool) -> notify::Result<()> {
    let (mut watcher, rx) = async_watcher()?;

    let path = Path::new(&file_path);

    if !path.is_dir() {
        return Ok(());
    }
    // Add a path to be watched. All files and directories at that path and
    // below will be monitored for changes.
    watcher.watch(
        Path::new(&path),
        if recursive {
            RecursiveMode::Recursive
        } else {
            RecursiveMode::NonRecursive
        },
    )?;

    {
        let mut inner = WATCHER.try_lock().unwrap();
        *inner = Some(watcher);
    }

    while let Ok(res) = rx.recv().await {
        match res {
            Ok(event) => {
                let event_type = get_event_type(event.kind);

                // To comes after From in case of rename
                match event_type {
                    EventType::Create | EventType::Remove | EventType::RenameFrom | EventType::RenameTo => {
                        let mut operation = if event_type == EventType::Create {
                            CREATE.to_string()
                        } else if event_type == EventType::Remove {
                            REMOVE.to_string()
                        } else {
                            String::new()
                        };

                        let first_paths: Vec<String> = event.paths.iter().map(|path| path.to_string_lossy().to_string()).collect();
                        if event_type == EventType::RenameFrom {
                            *PENDING_FROM.try_lock().unwrap() = first_paths;
                        } else {
                            *PENDING_TO.try_lock().unwrap() = first_paths;
                        }

                        if event_type == EventType::RenameFrom {
                            operation = handle_rename_from(&rx);
                        };

                        if event_type == EventType::RenameTo && cfg!(target_os = "linux") {
                            // On Linux, RenameTo is equal to move. So swap from and to and change operation
                            operation = CREATE.to_string();
                        }

                        window
                            .emit_to(
                                EventTarget::WebviewWindow {
                                    label: window.label().to_string(),
                                },
                                WATCH_EVENT_NAME,
                                WatchEvent {
                                    operation,
                                    to_paths: PENDING_TO.try_lock().unwrap().to_vec().clone(),
                                    from_paths: PENDING_FROM.try_lock().unwrap().to_vec().clone(),
                                },
                            )
                            .unwrap();

                        PENDING_TO.try_lock().unwrap().clear();
                        PENDING_FROM.try_lock().unwrap().clear();
                    }
                    _ => {}
                }
            }

            Err(e) => println!("watch error: {:?}", e),
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn handle_rename_from(rx: &Receiver<Result<Event, notify::Error>>) -> String {
    std::thread::sleep(std::time::Duration::from_millis(50));
    if let Ok(Ok(next_event)) = rx.try_recv() {
        let next_event_type = get_event_type(next_event.kind);
        let next_paths: Vec<String> = next_event.paths.iter().map(|path| path.to_string_lossy().to_string()).collect();
        if next_event_type == EventType::RenameTo {
            *PENDING_TO.try_lock().unwrap() = next_paths;
        }
    }

    RENAME.to_string()
}

#[cfg(target_os = "linux")]
fn handle_rename_from(rx: &Receiver<Result<Event, notify::Error>>) -> String {
    std::thread::sleep(std::time::Duration::from_millis(50));
    let operation = if let Ok(Ok(next_event)) = rx.try_recv() {
        let next_event_type = get_event_type(next_event.kind);
        let mut next_paths: Vec<String> = next_event.paths.iter().map(|path| path.to_string_lossy().to_string()).collect();
        if next_event_type == EventType::RenameTo {
            *PENDING_TO.try_lock().unwrap() = next_paths;
            RENAME.to_string()
        } else {
            // RenameFrom is equal to trash. So extends to.
            next_paths.extend(PENDING_FROM.try_lock().unwrap().clone());
            *PENDING_TO.try_lock().unwrap() = next_paths;
            PENDING_FROM.try_lock().unwrap().clear();
            REMOVE.to_string()
        }
    } else if cfg!(target_os = "linux") {
        // RenameFrom is equal to trash. So swap from and to and change operation
        *PENDING_TO.try_lock().unwrap() = PENDING_FROM.try_lock().unwrap().clone();
        PENDING_FROM.try_lock().unwrap().clear();
        REMOVE.to_string()
    } else {
        String::new()
    };

    operation
}

#[derive(PartialEq, Debug)]
enum EventType {
    ModifyAny,
    Remove,
    Create,
    RenameFrom,
    RenameTo,
    None,
}

fn get_event_type(event_kind: EventKind) -> EventType {
    if event_kind.is_create() {
        return EventType::Create;
    }

    if event_kind.is_remove() {
        return EventType::Remove;
    }

    match event_kind {
        EventKind::Modify(ModifyKind::Any) => EventType::ModifyAny,
        EventKind::Modify(ModifyKind::Name(RenameMode::From)) => EventType::RenameFrom,
        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => EventType::RenameTo,
        _ => EventType::None,
    }
}

pub fn unwatch(file_path: String) {
    if let Some(mut inner) = WATCHER.try_lock() {
        if let Some(watcher) = inner.as_mut() {
            let _ = watcher.unwatch(Path::new(&file_path));
        }
    }
}
