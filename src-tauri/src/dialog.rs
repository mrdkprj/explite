use rfd::{AsyncMessageDialog, MessageButtons, MessageDialogResult, MessageLevel};
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

const OK: &str = "OK";
const CANCEL: &str = "Cancel";

pub async fn show(info: DialogOptions) -> bool {
    match info.dialog_type.as_str() {
        "message" => message(info).await,
        "confirm" => confirm(info).await,
        _ => false,
    }
}

fn get_level(kind: &Option<String>) -> MessageLevel {
    if let Some(kind) = kind {
        match kind.as_str() {
            "info" => MessageLevel::Info,
            "warning" => MessageLevel::Warning,
            "error" => MessageLevel::Error,
            _ => MessageLevel::Info,
        }
    } else {
        MessageLevel::Info
    }
}

fn parse_result(info: DialogOptions, result: MessageDialogResult) -> bool {
    match result {
        MessageDialogResult::Ok => true,
        MessageDialogResult::Cancel => false,
        MessageDialogResult::Yes => true,
        MessageDialogResult::No => false,
        MessageDialogResult::Custom(label) => info.ok_label.map_or(label == OK, |ok_label| ok_label == label),
    }
}

async fn message(info: DialogOptions) -> bool {
    let dialog = AsyncMessageDialog::new().set_title(info.title.as_ref().unwrap_or(&String::new())).set_level(get_level(&info.kind)).set_description(&info.message);

    let ok_label = info.ok_label.clone();
    let dialog = if let Some(ok_label) = ok_label {
        dialog.set_buttons(MessageButtons::OkCustom(ok_label))
    } else {
        dialog.set_buttons(MessageButtons::Ok)
    };
    let result = dialog.show().await;
    parse_result(info, result)
}

async fn confirm(info: DialogOptions) -> bool {
    let dialog = AsyncMessageDialog::new().set_title(info.title.as_ref().unwrap_or(&String::new())).set_level(get_level(&info.kind)).set_description(&info.message);

    let ok_label = info.ok_label.clone();
    let cancel_label = info.cancel_label.clone();
    let dialog = if let Some(ok_label) = ok_label {
        dialog.set_buttons(MessageButtons::OkCancelCustom(ok_label, cancel_label.unwrap_or(String::from(CANCEL))))
    } else if let Some(cancel_label) = cancel_label {
        dialog.set_buttons(MessageButtons::OkCancelCustom(ok_label.unwrap_or(String::from(OK)), cancel_label))
    } else {
        dialog.set_buttons(MessageButtons::OkCancel)
    };

    let result = dialog.show().await;
    parse_result(info, result)
}
