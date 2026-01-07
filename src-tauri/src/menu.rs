use crate::AppMenuItem;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::Path};
use tauri::async_runtime::Mutex;
use tauri::{Emitter, EventTarget, Manager};
use wcpopup::{
    config::{ColorScheme, Config, MenuSize, Theme, ThemeColor, DEFAULT_DARK_COLOR_SCHEME},
    Menu, MenuBuilder, MenuIcon, MenuItem, MenuItemType,
};
use zouni::{AppInfo, Size};

pub const LIST: &str = "list";
pub const FAV: &str = "fav";
pub const NO_ITEM: &str = "noitem";
pub const RECYCLE_BIN: &str = "recyclebin";
const MENU_EVENT_NAME: &str = "contextmenu_event";
const TARGET_FILE: &str = "File";
const TARGET_FOLDER: &str = "Folder";
const APP_MENU_ITEM_PREFIX: &str = "app_menu_item:";
const TERMINAL_SVG: &str = r#"
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
    <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm9.5 5.5h-3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1m-6.354-.354a.5.5 0 1 0 .708.708l2-2a.5.5 0 0 0 0-.708l-2-2a.5.5 0 1 0-.708.708L4.793 6.5z"/>
    </svg>
"#;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    x: i32,
    y: i32,
}

pub struct Menus(HashMap<String, Menu>);
type MenusState = Mutex<Menus>;
pub struct AppMenuItems(Vec<AppMenuItem>);
type AppMenuItemsState = Mutex<AppMenuItems>;

pub fn create(app_handle: &tauri::AppHandle, window_handle: isize) {
    let list = create_list_menu(window_handle);
    let fav = create_fav_menu(window_handle);
    let no_item = create_noitem_menu(window_handle);
    let recycle_bin = create_recycle_bin_menu(window_handle);
    let menus = Menus(HashMap::from([(LIST.to_string(), list), (FAV.to_string(), fav), (NO_ITEM.to_string(), no_item), (RECYCLE_BIN.to_string(), recycle_bin)]));
    app_handle.manage(Mutex::new(menus));
    app_handle.manage(Mutex::new(AppMenuItems(Vec::new())));
}

#[allow(unused_variables)]
pub async fn popup_menu(app_handle: &tauri::AppHandle, window_label: &str, menu_name: &str, position: Position, full_path: Option<String>, show_admin_runas: bool) {
    let full_path = full_path.unwrap_or_default();
    let target_menu_name = if menu_name == LIST && full_path.is_empty() {
        NO_ITEM
    } else {
        menu_name
    };
    let state = app_handle.state::<MenusState>();
    let menus = state.try_lock().unwrap();
    let menu = menus.0.get(target_menu_name).unwrap();

    if target_menu_name == LIST {
        update_open_with(menu, &full_path);
        toggle_app_items(app_handle, menu, &full_path);
    }

    #[cfg(target_os = "windows")]
    if let Some(mut terminal) = menu.get_menu_item_by_id("AdminTerminal") {
        terminal.set_visible(show_admin_runas);
    }

    let result = menu.popup_at_async(position.x, position.y).await;

    if let Some(item) = result {
        app_handle
            .emit_to(
                EventTarget::WebviewWindow {
                    label: window_label.to_string(),
                },
                MENU_EVENT_NAME,
                if item.id.starts_with(APP_MENU_ITEM_PREFIX) {
                    item.id.replace(APP_MENU_ITEM_PREFIX, "")
                } else {
                    item.id
                },
            )
            .unwrap();
    };
}

fn update_open_with(menu: &Menu, file_path: &str) {
    let submenu_item = menu.get_menu_item_by_id("OpenWith").unwrap();

    let mut submenu = submenu_item.submenu.unwrap();
    let mut items = submenu.items();

    if items.len() > 1 {
        items.remove(items.len() - 1);

        for item in &items {
            submenu.remove(item);
        }
    }

    let mut select_app_item = menu.get_menu_item_by_id("SelectApp").unwrap();

    if Path::new(file_path).is_dir() {
        select_app_item.set_visible(false);
        submenu.insert(MenuItem::builder(MenuItemType::Text).id("OpenInNewWindow").label("Open New Window").build(), 0);
        return;
    }

    select_app_item.set_visible(true);

    let apps = zouni::shell::get_open_with(file_path);

    let apps: Vec<AppInfo> = apps.into_iter().filter(|app| !app.path.is_empty()).rev().collect();

    if !apps.is_empty() {
        submenu.insert(MenuItem::new_separator(), 0);
    }

    for app in apps {
        submenu.insert(MenuItem::builder(MenuItemType::Text).id(&app.path).label(&app.name).build(), 0);
        let mut item = submenu.get_menu_item_by_id(&app.path).unwrap();
        #[cfg(target_os = "windows")]
        {
            let width = 16;
            let height = 16;
            let extension = Path::new(&app.icon_path).extension().unwrap_or_default();
            if extension == "exe" || extension == "ico" {
                let icon = zouni::shell::extract_icon(
                    app.icon_path,
                    Size {
                        width,
                        height,
                    },
                )
                .unwrap();
                item.set_icon(Some(MenuIcon::from_rgba(icon.raw_pixels, width, height)));
            } else {
                item.set_icon(Some(MenuIcon::new(app.icon_path)));
            }
        }
        #[cfg(target_os = "linux")]
        {
            item.set_icon(Some(MenuIcon::new(app.icon_path)));
        }
    }
}

pub fn change_app_menu_items(app_handle: &tauri::AppHandle, new_app_menu_items: Vec<AppMenuItem>) {
    let state = app_handle.state::<MenusState>();
    let mut menus = state.try_lock().unwrap();
    let menu = menus.0.get_mut(LIST).unwrap();

    let app_item_state = app_handle.state::<AppMenuItemsState>();
    let mut items = app_item_state.try_lock().unwrap();

    for old_item in &items.0 {
        if let Some(item) = menu.get_menu_item_by_id(&old_item.path) {
            #[cfg(target_os = "windows")]
            menu.remove_at(item.index as _);
            #[cfg(target_os = "linux")]
            menu.remove(&item);
        }
    }

    let terminal = menu.get_menu_item_by_id("Terminal").unwrap();

    #[cfg(target_os = "windows")]
    let start_index = terminal.index + 1;
    #[cfg(target_os = "linux")]
    let start_index = menu.items().iter().position(|item| item.uuid == terminal.uuid).unwrap() as u32 + 1;
    for (i, new_item) in new_app_menu_items.iter().enumerate() {
        let menu_id = app_menu_item_id(&new_item.path);
        let width = 16;
        let height = 16;
        if let Ok(icon) = zouni::shell::extract_icon(
            &new_item.path,
            Size {
                width,
                height,
            },
        ) {
            #[cfg(target_os = "windows")]
            let item = MenuItem::new_text_item(&menu_id, &new_item.label, None, false, Some(MenuIcon::from_rgba(icon.raw_pixels, width, height)));
            #[cfg(target_os = "linux")]
            let item = MenuItem::new_text_item(&menu_id, &new_item.label, None, false, Some(MenuIcon::new(icon)));
            menu.insert(item, start_index + i as u32);
        } else {
            let item = MenuItem::new_text_item(&menu_id, &new_item.label, None, false, None);
            menu.insert(item, start_index + i as u32);
        }
    }
    items.0 = new_app_menu_items;
}

pub fn change_menu_theme(app_handle: &tauri::AppHandle, theme: Theme) {
    let state = app_handle.state::<MenusState>();
    let menus = state.try_lock().unwrap();

    for menu in menus.0.values() {
        menu.set_theme(theme);
    }
}

fn app_menu_item_id(app_path: &str) -> String {
    format!("{}{}", APP_MENU_ITEM_PREFIX, app_path)
}

fn toggle_app_items(app_handle: &tauri::AppHandle, menu: &Menu, file_path: &str) {
    let is_dir = Path::new(file_path).is_dir();
    let state = app_handle.state::<AppMenuItemsState>();
    let app_items = state.try_lock().unwrap();
    for app_item in &app_items.0 {
        let menu_id = app_menu_item_id(&app_item.path);
        let mut menu_item = menu.get_menu_item_by_id(&menu_id).unwrap();
        match app_item.target.as_str() {
            TARGET_FILE => {
                if is_dir {
                    menu_item.set_visible(false);
                } else {
                    menu_item.set_visible(true);
                }
            }
            TARGET_FOLDER => {
                if is_dir {
                    menu_item.set_visible(true);
                } else {
                    menu_item.set_visible(false);
                }
            }
            _ => menu_item.set_visible(true),
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
            item_horizontal_padding: 20,
            ..Default::default()
        },
        ..Default::default()
    }
}

fn create_list_menu(window_handle: isize) -> Menu {
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
    builder.text_with_accelerator("Trash", "Delete", false, "Delete");
    builder.separator();
    builder.text("AddToFavorite", "Add To Favorite", false);
    builder.text("CopyFullpath", "Copy Fullpath", false);
    builder.text("Property", "Property", false);

    builder.separator();
    #[cfg(target_os = "windows")]
    builder.text_with_icon("AdminTerminal", "Open Terminal(Admin)", false, MenuIcon::from_svg(TERMINAL_SVG.to_string(), 16, 16));
    builder.text_with_icon("Terminal", "Open Terminal", false, MenuIcon::from_svg(TERMINAL_SVG.to_string(), 16, 16));

    builder.build().unwrap()
}

fn create_noitem_menu(window_handle: isize) -> Menu {
    let config = get_menu_config(Theme::System);
    let mut builder = MenuBuilder::new_from_config(window_handle, config);
    builder.text("CopyFullpath", "Copy Fullpath", false);
    builder.text("Property", "Property", false);
    builder.separator();
    #[cfg(target_os = "windows")]
    builder.text_with_icon("AdminTerminal", "Open Terminal(Admin)", false, MenuIcon::from_svg(TERMINAL_SVG.to_string(), 16, 16));
    builder.text_with_icon("Terminal", "Open Terminal", false, MenuIcon::from_svg(TERMINAL_SVG.to_string(), 16, 16));

    builder.build().unwrap()
}

fn create_recycle_bin_menu(window_handle: isize) -> Menu {
    let config = get_menu_config(Theme::System);
    let mut builder = MenuBuilder::new_from_config(window_handle, config);
    builder.text("Undelete", "Undelete", false);
    builder.separator();
    builder.text("DeleteFromRecycleBin", "Delete", false);
    builder.text("EmptyRecycleBin", "Empty Recycle Bin", false);

    builder.build().unwrap()
}

fn create_fav_menu(window_handle: isize) -> Menu {
    let config = get_menu_config(Theme::System);
    let mut builder = MenuBuilder::new_from_config(window_handle, config);
    builder.text("RemoveFromFavorite", "Remove From Favorite", false);
    builder.text("Property", "Property", false);
    builder.separator();
    builder.text("Refresh", "Refresh", false);

    builder.build().unwrap()
}
