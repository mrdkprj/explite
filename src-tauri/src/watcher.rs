use crossbeam_channel::{bounded, Receiver, Sender};
use notify_debouncer_full::{
    new_debouncer, new_debouncer_opt,
    notify::{
        event::{ModifyKind, RenameMode},
        Config, EventKind, RecursiveMode,
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
    Unwatch(String, bool),
}

pub fn spwan_watcher(app_handle: &tauri::AppHandle, cmd_rx: Receiver<WatcherCommand>) -> Result<(), String> {
    let (tx, rx) = bounded(1);
    let (tx_poll, rx_poll) = bounded(1);

    let mut watcher = new_debouncer(Duration::from_millis(100), None, move |res| tx.send(res).unwrap_or_default()).map_err(|e| e.to_string())?;
    let mut poll_watcher: notify_debouncer_full::Debouncer<notify_debouncer_full::notify::PollWatcher, _> = new_debouncer_opt(
        Duration::from_millis(100),
        None,
        move |res| tx_poll.send(res).unwrap_or_default(),
        notify_debouncer_full::RecommendedCache::new(),
        Config::default().with_poll_interval(Duration::from_secs(2)).with_follow_symlinks(false),
    )
    .map_err(|e| e.to_string())?;
    let app_handle = app_handle.clone();

    tauri::async_runtime::spawn(async move {
        loop {
            if let Ok(cmd) = cmd_rx.try_recv() {
                match cmd {
                    WatcherCommand::Watch(path, network) => {
                        if network {
                            let _ = poll_watcher.watch(path, RecursiveMode::NonRecursive);
                        } else {
                            let _ = watcher.watch(path, RecursiveMode::NonRecursive);
                        }
                    }
                    WatcherCommand::Unwatch(path, network) => {
                        if network {
                            let _ = poll_watcher.unwatch(path);
                        } else {
                            let _ = watcher.unwatch(path);
                        }
                    }
                }
            }

            if let Ok(event_result) = rx.try_recv() {
                match event_result {
                    Ok(events) => {
                        for event in events {
                            handle_event(&app_handle, event);
                        }
                    }
                    Err(errors) => {
                        for error in errors {
                            eprintln!("Watcher error: {:?}", error);
                        }
                    }
                }
            }

            if let Ok(event_result) = rx_poll.try_recv() {
                match event_result {
                    Ok(events) => {
                        for event in events {
                            handle_event(&app_handle, event);
                        }
                    }
                    Err(errors) => {
                        for error in errors {
                            eprintln!("Watcher error: {:?}", error);
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
