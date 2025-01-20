use async_std::sync::Mutex;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{Emitter, EventTarget, WebviewWindow};
use wcpopup::{
    config::{ColorScheme, Config, MenuSize, Theme, ThemeColor, DEFAULT_DARK_COLOR_SCHEME},
    Menu, MenuBuilder,
};

static MENU_MAP: Lazy<Mutex<HashMap<String, Menu>>> = Lazy::new(|| Mutex::new(HashMap::new()));
pub const LIST: &str = "list";
pub const FAV: &str = "fav";
const MENU_EVENT_NAME: &str = "contextmenu_event";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct MenuInfo {
    allowExecute: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct Position {
    x: i32,
    y: i32,
}

pub async fn popup_menu(window: &WebviewWindow, menu_name: &str, position: Position) {
    let map = MENU_MAP.lock().await;
    let menu = map.get(menu_name).unwrap();
    let result = menu.popup_at_async(position.x, position.y).await;

    if let Some(item) = result {
        window
            .emit_to(
                EventTarget::WebviewWindow {
                    label: window.label().to_string(),
                },
                MENU_EVENT_NAME,
                item.id,
            )
            .unwrap();
    };
}

fn get_menu_config(theme: Theme) -> Config {
    Config {
        theme,
        color: ThemeColor {
            dark: ColorScheme {
                color: 0xefefef,
                background_color: 0x202020,
                ..DEFAULT_DARK_COLOR_SCHEME
            },
            ..Default::default()
        },
        size: MenuSize {
            item_horizontal_padding: 10,
            ..Default::default()
        },
        ..Default::default()
    }
}

pub fn create_list_menu(window_handle: isize, info: MenuInfo) {
    let config = get_menu_config(Theme::System);
    let mut builder = MenuBuilder::new_from_config(window_handle, config);
    builder.text("Open", "Open", None);
    builder.text("OpenWith", "Open With", None);
    builder.text_with_accelerator("Copy", "Copy", None, "Ctrl+C");
    builder.text_with_accelerator("Cut", "Cut", None, "Ctrl+X");
    builder.text_with_accelerator("Paste", "Paste", None, "Ctrl+V");
    builder.text_with_accelerator("Delete", "Delete", None, "Delete");
    builder.separator();
    builder.text("AddToFavorite", "Add To Favorite", None);
    builder.text("CopyFullpath", "Copy Fullpath", None);
    builder.text("Property", "Property", None);
    builder.separator();
    builder.check("AllowExecute", "Allow Execute", info.allowExecute, None);
    builder.text("Settings", "Settings", None);

    let menu = builder.build().unwrap();

    let mut map = MENU_MAP.try_lock().unwrap();
    (*map).insert(LIST.to_string(), menu);
}

pub fn create_fav_menu(window_handle: isize) {
    let config = get_menu_config(Theme::System);
    let mut builder = MenuBuilder::new_from_config(window_handle, config);
    builder.text("RemoveFromFavorite", "Remove From Favorite", None);
    builder.text("Property", "Property", None);

    let menu = builder.build().unwrap();

    let mut map = MENU_MAP.try_lock().unwrap();
    (*map).insert(FAV.to_string(), menu);
}
