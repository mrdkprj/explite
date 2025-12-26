use crossbeam_channel::{bounded, Receiver, Sender};
use notify_debouncer_full::{
    new_debouncer,
    notify::{
        event::{ModifyKind, RenameMode},
        EventKind, RecursiveMode,
    },
    DebouncedEvent,
};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::Emitter;

const WATCH_EVENT_NAME: &str = "watch_event";
const CREATE: &str = "Create";
const REMOVE: &str = "Remove";
const RENAME: &str = "Rename";

pub struct WatchTx(pub Sender<WatcherCommand>);

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WatchEvent {
    operation: String,
    to_paths: Vec<String>,
    from_paths: Vec<String>,
}

pub enum WatcherCommand {
    Watch(String, bool),
    Unwatch(String),
}

pub fn spwan_watcher(app_handle: &tauri::AppHandle, cmd_rx: Receiver<WatcherCommand>) -> Result<(), String> {
    let (tx, rx) = bounded(1);

    let mut watcher = new_debouncer(Duration::from_millis(100), None, move |res| tx.send(res).unwrap_or_default()).map_err(|e| e.to_string())?;
    let app_handle = app_handle.clone();

    tauri::async_runtime::spawn(async move {
        loop {
            crossbeam_channel::select! {
                recv(cmd_rx) -> cmd => {
                    if let Ok(cmd) = cmd {
                        match cmd {
                            WatcherCommand::Watch(path, recursive) => {
                                let _ = watcher.watch(path, if recursive { RecursiveMode::Recursive} else {RecursiveMode::NonRecursive});
                            },
                            WatcherCommand::Unwatch(path) => {
                                let _ = watcher.unwatch(path);
                            },
                        }
                    }else{
                        println!("Command channel closed. Shutting down watcher.");
                        break;
                    }
                }

                recv(rx) -> event_result  => {
                    if let Ok(event_result) = event_result {
                        match event_result {
                            Ok(events) => {
                                for event in events {
                                    handle_event(&app_handle, event);
                                }
                            },
                            Err(errors) => {
                                for error in errors {
                                    eprintln!("Watcher error: {:?}", error);
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

fn handle_event(app_handle: &tauri::AppHandle, event: DebouncedEvent) {
    let event_type = get_event_type(event.kind);

    match event_type {
        EventType::Create | EventType::Remove | EventType::Rename => {
            let operation = if event_type == EventType::Create {
                CREATE.to_string()
            } else if event_type == EventType::Remove {
                REMOVE.to_string()
            } else {
                RENAME.to_string()
            };

            let paths: Vec<String> = event.paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
            let (from, to) = if event_type == EventType::Rename {
                (vec![paths.first().cloned().unwrap_or_default()], vec![paths.get(1).cloned().unwrap_or_default()])
            } else {
                (Vec::new(), paths)
            };

            app_handle
                .emit(
                    WATCH_EVENT_NAME,
                    WatchEvent {
                        operation,
                        to_paths: to,
                        from_paths: from,
                    },
                )
                .unwrap();
        }
        _ => {}
    }
}

#[derive(PartialEq, Debug)]
enum EventType {
    ModifyAny,
    Remove,
    Create,
    None,
    Rename,
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
        EventKind::Modify(ModifyKind::Name(RenameMode::Both)) => EventType::Rename,
        _ => EventType::None,
    }
}
