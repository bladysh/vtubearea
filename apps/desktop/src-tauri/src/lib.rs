mod app_error;
mod app_paths;
mod desktop_shell;
mod file_system;
mod media_library;
mod model_library;

use tauri::Manager;

use app_paths::AppPaths;
use desktop_shell::click_through::{self, ClickThroughState};

pub fn run() {
    // Local .env is for development; real installs use OS environment variables or defaults.
    let _ = dotenvy::dotenv();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(ClickThroughState::default())
        .setup(|app| {
            let app_paths = AppPaths::resolve(app.path().app_data_dir()?);
            app_paths.ensure_exists()?;
            if let Ok(resource_dir) = app.path().resource_dir() {
                let sample_models_dir = resource_dir.join("sample-models");
                if let Err(seed_error) =
                    model_library::model_folders::seed_sample_models(
                    &sample_models_dir,
                    &app_paths.models_dir,
                    &app_paths.data_dir,
                    cfg!(debug_assertions),
                )
                {
                    eprintln!("Could not install sample models: {seed_error}");
                }
            }
            // The WebView may read only user content folders through the asset protocol.
            let asset_scope = app.asset_protocol_scope();
            asset_scope.allow_directory(&app_paths.models_dir, true)?;
            asset_scope.allow_directory(&app_paths.backgrounds_dir, true)?;
            asset_scope.allow_directory(&app_paths.items_dir, true)?;

            app.manage(app_paths);
            desktop_shell::tray::create_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            model_library::commands::list_models,
            model_library::commands::import_model,
            model_library::commands::open_models_folder,
            model_library::commands::get_models_folder,
            media_library::commands::list_backgrounds,
            media_library::commands::import_background,
            media_library::commands::delete_background,
            media_library::commands::list_items,
            media_library::commands::import_item,
            media_library::commands::delete_item,
            click_through::set_click_through,
            click_through::get_click_through,
        ])
        .run(tauri::generate_context!())
        .expect("error while running vTubeArea");
}
