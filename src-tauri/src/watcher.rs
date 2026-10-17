use notify_debouncer_full::{
    new_debouncer, new_debouncer_opt,
    notify::{
        event::{ModifyKind, RenameMode},
        Config, EventKind, RecursiveMode,
    },
    DebouncedEvent,
};
use serde::{Deserialize, Serialize};
use smol::{
    channel::{bounded, Receiver, Sender},
    lock::Mutex,
};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

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

enum Watcher<L, R> {
    Normal(L),
    PollWatcher(R),
}

#[derive(Debug, Default, PartialEq, Eq, Hash)]
struct WatchTargetType {
    path: String,
    poll: bool,
}

impl WatchTargetType {
    fn new(path: String, poll: bool) -> Self {
        Self {
            path,
            poll,
        }
    }
}

#[derive(Debug, Default)]
struct WatchTargets {
    targets: Vec<WatchTargetType>,
}

pub fn init(app: &AppHandle) {
    app.manage(Mutex::new(WatchTargets::default()));
}

pub fn spwan_watcher(app_handle: &AppHandle, cmd_rx: Receiver<WatcherCommand>) -> Result<(), String> {
    let (tx, rx) = bounded(1);
    let (tx_poll, rx_poll) = bounded(1);

    let mut watcher = new_debouncer(Duration::from_millis(100), None, move |res| tx.try_send(res).unwrap_or_default()).map_err(|e| e.to_string())?;
    let mut poll_watcher: notify_debouncer_full::Debouncer<notify_debouncer_full::notify::PollWatcher, _> = new_debouncer_opt(
        Duration::from_millis(100),
        None,
        move |res| tx_poll.try_send(res).unwrap_or_default(),
        notify_debouncer_full::RecommendedCache::new(),
        Config::default().with_poll_interval(Duration::from_secs(2)).with_follow_symlinks(false),
    )
    .map_err(|e| e.to_string())?;
    let app_handle = app_handle.clone();

    tauri::async_runtime::spawn(async move {
        while let Ok(cmd) = cmd_rx.recv().await {
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
    });

    tauri::async_runtime::spawn(async move {
        loop {
            let event = smol::future::race(async { Watcher::Normal(rx.recv().await) }, async { Watcher::PollWatcher(rx_poll.recv().await) }).await;
            match event {
                Watcher::Normal(result) => {
                    if let Ok(event_result) = result {
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

                Watcher::PollWatcher(result) => {
                    if let Ok(event_result) = result {
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
            }
        }
    });

    Ok(())
}

fn handle_event(app_handle: &AppHandle, event: DebouncedEvent) {
    let event_type = get_event_type(event.kind);

    match event_type {
        EventType::Create | EventType::Remove | EventType::Rename | EventType::RenameFrom | EventType::RenameTo => {
            let operation = if event_type == EventType::Create {
                CREATE.to_string()
            } else if event_type == EventType::Remove {
                REMOVE.to_string()
            } else {
                RENAME.to_string()
            };

            let paths: Vec<String> = event.paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
            let (from, to) = match event_type {
                EventType::RenameFrom => (vec![paths.first().cloned().unwrap_or_default()], Vec::new()),
                EventType::RenameTo => (Vec::new(), vec![paths.first().cloned().unwrap_or_default()]),
                EventType::Rename => (vec![paths.first().cloned().unwrap_or_default()], vec![paths.get(1).cloned().unwrap_or_default()]),
                _ => (Vec::new(), paths),
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

#[allow(dead_code)]
#[derive(PartialEq, Debug)]
enum EventType {
    ModifyAny,
    Remove,
    Create,
    None,
    Rename,
    RenameTo,
    RenameFrom,
}

fn get_event_type(event_kind: EventKind) -> EventType {
    if event_kind.is_create() {
        return EventType::Create;
    }

    if event_kind.is_remove() {
        return EventType::Remove;
    }

    #[cfg(target_os = "windows")]
    // Notify may not emit RenameMode::Both
    match event_kind {
        EventKind::Modify(ModifyKind::Any) => EventType::ModifyAny,
        EventKind::Modify(ModifyKind::Name(RenameMode::From)) => EventType::RenameFrom,
        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => EventType::RenameTo,
        EventKind::Modify(ModifyKind::Name(RenameMode::Both)) => EventType::Rename,
        _ => EventType::None,
    }

    #[cfg(target_os = "linux")]
    match event_kind {
        EventKind::Modify(ModifyKind::Any) => EventType::ModifyAny,
        EventKind::Modify(ModifyKind::Name(RenameMode::From)) => EventType::Remove,
        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => EventType::Create,
        EventKind::Modify(ModifyKind::Name(RenameMode::Both)) => EventType::Rename,
        EventKind::Remove(_) => EventType::Remove,
        _ => EventType::None,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyRequest {
    path: String,
    network: bool,
}
pub async fn watch(app: &AppHandle, request: NotifyRequest) -> Result<(), String> {
    let tx = app.state::<WatchTx>();
    let command = WatcherCommand::Watch(request.path.clone(), request.network);
    let state = app.state::<Mutex<WatchTargets>>();
    let mut state = state.lock().await;
    let target_type = WatchTargetType::new(request.path, request.network);
    state.targets.push(target_type);

    tx.inner().0.send(command).await.map_err(|e| e.to_string())
}

pub async fn unwatch(app: &AppHandle, request: NotifyRequest) -> Result<(), String> {
    let tx = app.state::<WatchTx>();
    let command = WatcherCommand::Unwatch(request.path.clone(), request.network);
    let state = app.state::<Mutex<WatchTargets>>();
    let mut state = state.lock().await;
    let target_type = WatchTargetType::new(request.path, request.network);
    if let Some(index) = state.targets.iter().position(|target| target == &target_type) {
        state.targets.remove(index);
    }

    tx.inner().0.send(command).await.map_err(|e| e.to_string())
}

pub async fn clear_watch(app: &AppHandle, commands: Vec<NotifyRequest>) {
    let state = app.state::<Mutex<WatchTargets>>();
    let mut state = state.lock().await;
    let tx = app.state::<WatchTx>();
    for command in &commands {
        let target_type = WatchTargetType {
            path: command.path.clone(),
            poll: command.network,
        };
        if let Some(index) = state.targets.iter().position(|a| a == &target_type) {
            state.targets.remove(index);
        }
    }

    for command in commands {
        let target_type = WatchTargetType {
            path: command.path,
            poll: command.network,
        };
        if !state.targets.contains(&target_type) {
            let _ = tx.inner().0.send(WatcherCommand::Unwatch(target_type.path, target_type.poll)).await;
        }
    }
}
