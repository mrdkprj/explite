use async_std::sync::Mutex;
use nonstd::AppInfo;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{Emitter, EventTarget, WebviewWindow};
use wcpopup::{
    config::{ColorScheme, Config, MenuSize, Theme, ThemeColor, DEFAULT_DARK_COLOR_SCHEME},
    Menu, MenuBuilder, MenuIcon, MenuItem, MenuItemType,
};

static MENU_MAP: Lazy<Mutex<HashMap<String, Menu>>> = Lazy::new(|| Mutex::new(HashMap::new()));
pub const LIST: &str = "list";
pub const FAV: &str = "fav";
const MENU_EVENT_NAME: &str = "contextmenu_event";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    x: i32,
    y: i32,
}

pub async fn popup_menu(
    window: &WebviewWindow,
    menu_name: &str,
    position: Position,
    full_path: Option<String>,
) {
    let map = MENU_MAP.lock().await;
    let menu = map.get(menu_name).unwrap();
    if menu_name == LIST {
        update_open_with(menu, full_path.unwrap());
    }
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

fn update_open_with(menu: &Menu, file_path: String) {
    let mut submenu_item = menu.get_menu_item_by_id("OpenWith").unwrap();

    if file_path.is_empty() {
        submenu_item.set_disabled(true);
        return;
    }

    submenu_item.set_disabled(false);

    let mut submenu = submenu_item.submenu.unwrap();
    let mut items = submenu.items();

    if items.len() > 1 {
        items.remove(items.len() - 1);

        for item in items {
            submenu.remove(&item);
        }
    }

    let apps = nonstd::shell::get_open_with(file_path);

    let apps: Vec<AppInfo> = apps
        .into_iter()
        .filter(|app| !app.path.is_empty())
        .rev()
        .collect();

    if !apps.is_empty() {
        submenu.insert(MenuItem::new_separator(), 0);
    }

    for app in apps {
        submenu.insert(
            MenuItem::builder(MenuItemType::Text)
                .id(&app.path)
                .label(&app.name)
                .build(),
            0,
        );
        let mut item = submenu.get_menu_item_by_id(&app.path).unwrap();
        #[cfg(target_os="windows")]
        {
            if app.icon.is_empty() {
                item.set_icon(Some(MenuIcon::from_rgba(
                    app.rgba_icon.rgba,
                    app.rgba_icon.width,
                    app.rgba_icon.height,
                )));
            } else {
                item.set_icon(Some(MenuIcon::new(app.icon)));
            }
        }
        #[cfg(target_os="linux")]
        {
            item.set_icon(Some(MenuIcon::new(app.icon)));
        }
    }
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

pub fn create_list_menu(window_handle: isize) {
    let config = get_menu_config(Theme::System);
    let mut builder = MenuBuilder::new_from_config(window_handle, config);
    builder.text("Open", "Open", false);
    let mut sub = builder.submenu("OpenWith", "Open With", false);
    sub.text("SelectApp", "Select another program...", false);
    sub.build().unwrap();
    builder.separator();
    builder.text_with_accelerator("Copy", "Copy", false, "Ctrl+C");
    builder.text_with_accelerator("Cut", "Cut", false, "Ctrl+X");
    builder.text_with_accelerator("Paste", "Paste", false, "Ctrl+V");
    builder.text_with_accelerator("Delete", "Delete", false, "Delete");
    builder.separator();
    builder.text("AddToFavorite", "Add To Favorite", false);
    builder.text("CopyFullpath", "Copy Fullpath", false);
    builder.text("Property", "Property", false);
    builder.separator();
    builder.text("Terminal", "Open Terminal", false);
    builder.text("Settings", "Settings", false);

    let menu = builder.build().unwrap();

    let mut map = MENU_MAP.try_lock().unwrap();
    (*map).insert(LIST.to_string(), menu);
}

pub fn create_fav_menu(window_handle: isize) {
    let config = get_menu_config(Theme::System);
    let mut builder = MenuBuilder::new_from_config(window_handle, config);
    builder.text("RemoveFromFavorite", "Remove From Favorite", false);
    builder.text("Property", "Property", false);

    let menu = builder.build().unwrap();

    let mut map = MENU_MAP.try_lock().unwrap();
    (*map).insert(FAV.to_string(), menu);
}
