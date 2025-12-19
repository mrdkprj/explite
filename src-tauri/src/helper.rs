use crate::{
    session::Session,
    watcher::{self, WatchTx},
};
use tauri::Manager;

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

    let (tx_cmd, rx_cmd) = crossbeam_channel::bounded(1);
    app.manage(WatchTx(tx_cmd));
    watcher::spwan_watcher(app.app_handle(), rx_cmd).unwrap();
}

pub fn exit(app: &tauri::AppHandle) {
    if let Some(session) = app.try_state::<Session>() {
        crate::session::end(session.inner());
    }
}
