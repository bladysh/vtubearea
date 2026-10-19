use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::app_error::AppResult;

pub const CLICK_THROUGH_CHANGED_EVENT: &str = "click-through-changed";
pub const MAIN_WINDOW_LABEL: &str = "main";

/// When on, mouse clicks pass through the window to whatever is behind it.
/// The tray menu is the way back, since the window itself no longer takes clicks.
#[derive(Default)]
pub struct ClickThroughState(pub Mutex<bool>);

pub fn apply_click_through(app_handle: &AppHandle, is_enabled: bool) -> AppResult<()> {
    if let Some(main_window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
        main_window.set_ignore_cursor_events(is_enabled)?;
    }
    if let Ok(mut click_through_enabled) = app_handle.state::<ClickThroughState>().0.lock() {
        *click_through_enabled = is_enabled;
    }
    app_handle.emit(CLICK_THROUGH_CHANGED_EVENT, is_enabled)?;
    Ok(())
}

#[tauri::command]
pub fn set_click_through(is_enabled: bool, app_handle: AppHandle) -> AppResult<()> {
    apply_click_through(&app_handle, is_enabled)
}

#[tauri::command]
pub fn get_click_through(click_through_state: State<'_, ClickThroughState>) -> bool {
    click_through_state.0.lock().map(|is_enabled| *is_enabled).unwrap_or(false)
}
