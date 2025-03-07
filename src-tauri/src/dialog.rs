use nonstd::dialog::{message, MessageDialogKind, MessageDialogOptions};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogOptions {
    dialog_type: String,
    title: Option<String>,
    kind: Option<String>,
    ok_label: Option<String>,
    cancel_label: Option<String>,
    message: String,
}

pub async fn show(info: DialogOptions) -> bool {
    match info.dialog_type.as_str() {
        "message" => show_message(info).await,
        "confirm" => show_confirm(info).await,
        _ => false,
    }
}

fn get_level(kind: &Option<String>) -> MessageDialogKind {
    if let Some(kind) = kind {
        match kind.as_str() {
            "info" => MessageDialogKind::Info,
            "warning" => MessageDialogKind::Warning,
            "error" => MessageDialogKind::Error,
            _ => MessageDialogKind::Info,
        }
    } else {
        MessageDialogKind::Info
    }
}

async fn show_message(info: DialogOptions) -> bool {
    let options = MessageDialogOptions {
        title: info.title,
        kind: Some(get_level(&info.kind)),
        buttons: Vec::new(),
        message: info.message,
        cancel_id: None,
    };
    message(options).await
}

async fn show_confirm(info: DialogOptions) -> bool {
    let options = MessageDialogOptions {
        title: info.title,
        kind: Some(get_level(&info.kind)),
        buttons: vec![info.ok_label.unwrap_or("OK".to_string()), info.cancel_label.unwrap_or("Cancel".to_string())],
        message: info.message,
        cancel_id: Some(1),
    };
    message(options).await
}
