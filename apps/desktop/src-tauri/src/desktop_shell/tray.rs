use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

use super::click_through::{apply_click_through, ClickThroughState, MAIN_WINDOW_LABEL};

const SHOW_WINDOW_ITEM: &str = "show_window";
const TOGGLE_CLICK_THROUGH_ITEM: &str = "toggle_click_through";
const QUIT_ITEM: &str = "quit";

pub fn create_tray(app_handle: &AppHandle) -> tauri::Result<()> {
    let show_window_item = MenuItem::with_id(app_handle, SHOW_WINDOW_ITEM, "Show vTubeArea", true, None::<&str>)?;
    let toggle_click_through_item =
        MenuItem::with_id(app_handle, TOGGLE_CLICK_THROUGH_ITEM, "Toggle click-through", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app_handle, QUIT_ITEM, "Quit", true, None::<&str>)?;
    let tray_menu = Menu::with_items(app_handle, &[&show_window_item, &toggle_click_through_item, &quit_item])?;

    let mut tray_builder = TrayIconBuilder::new().menu(&tray_menu).tooltip("vTubeArea");
    if let Some(window_icon) = app_handle.default_window_icon() {
        tray_builder = tray_builder.icon(window_icon.clone());
    }
    tray_builder
        .on_menu_event(|app_handle, menu_event| match menu_event.id.as_ref() {
            SHOW_WINDOW_ITEM => {
                if let Some(main_window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
                    let _ = main_window.show();
                    let _ = main_window.set_focus();
                }
            }
            TOGGLE_CLICK_THROUGH_ITEM => {
                let is_enabled = app_handle
                    .state::<ClickThroughState>()
                    .0
                    .lock()
                    .map(|is_enabled| *is_enabled)
                    .unwrap_or(false);
                let _ = apply_click_through(app_handle, !is_enabled);
            }
            QUIT_ITEM => app_handle.exit(0),
            _ => {}
        })
        .build(app_handle)?;
    Ok(())
}
