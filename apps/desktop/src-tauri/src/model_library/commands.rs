use std::path::PathBuf;

use tauri::State;

use super::model_folders::{import_model_folder, list_model_folders, ModelSummary};
use crate::app_error::AppResult;
use crate::app_paths::AppPaths;
use crate::desktop_shell::file_manager::reveal_in_file_manager;

#[tauri::command]
pub fn list_models(app_paths: State<'_, AppPaths>) -> AppResult<Vec<ModelSummary>> {
    list_model_folders(&app_paths.models_dir)
}

#[tauri::command]
pub fn import_model(source_path: PathBuf, app_paths: State<'_, AppPaths>) -> AppResult<ModelSummary> {
    import_model_folder(&source_path, &app_paths.models_dir)
}

#[tauri::command]
pub fn open_models_folder(app_paths: State<'_, AppPaths>) -> AppResult<()> {
    reveal_in_file_manager(&app_paths.models_dir)
}

#[tauri::command]
pub fn get_models_folder(app_paths: State<'_, AppPaths>) -> PathBuf {
    app_paths.models_dir.clone()
}
