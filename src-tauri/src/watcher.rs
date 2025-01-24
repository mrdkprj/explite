use async_std::{
    channel::{self, Receiver},
    sync::Mutex,
    task::block_on,
};
use notify::{
    event::{ModifyKind, RenameMode},
    recommended_watcher, Event, EventKind, INotifyWatcher, RecommendedWatcher, RecursiveMode,
    Watcher,
};
use once_cell::sync::Lazy;
use std::path::Path;
use tauri::{Emitter, EventTarget, WebviewWindow};

static WATCHER: Lazy<Mutex<Option<INotifyWatcher>>> = Lazy::new(|| Mutex::new(None));
const WATCH_EVENT_NAME: &str = "watch_event";

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

pub async fn watch(window: &WebviewWindow, file_path: String) -> notify::Result<()> {
    let (mut watcher, rx) = async_watcher()?;

    let path = Path::new(&file_path);

    if !path.is_dir() {
        return Ok(());
    }
    // Add a path to be watched. All files and directories at that path and
    // below will be monitored for changes.
    watcher.watch(Path::new(&path), RecursiveMode::NonRecursive)?;

    {
        let mut inner = WATCHER.try_lock().unwrap();
        *inner = Some(watcher);
    }

    while let Ok(res) = rx.recv().await {
        match res {
            Ok(event) => {
                if event.kind != EventKind::Modify(ModifyKind::Name(RenameMode::From)) {
                    window
                        .emit_to(
                            EventTarget::WebviewWindow {
                                label: window.label().to_string(),
                            },
                            WATCH_EVENT_NAME,
                            event.paths,
                        )
                        .unwrap();
                }
            }
            Err(e) => println!("watch error: {:?}", e),
        }
    }

    Ok(())
}

pub fn unwatch(file_path: String) {
    if let Some(mut inner) = WATCHER.try_lock() {
        if let Some(watcher) = inner.as_mut() {
            let _ = watcher.unwatch(Path::new(&file_path));
        }
    }
}
