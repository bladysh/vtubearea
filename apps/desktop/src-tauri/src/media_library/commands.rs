use std::path::PathBuf;

use tauri::State;

use super::background_files::{
    delete_background_file, import_background_file, import_media_file, list_background_files, BackgroundAsset, MediaRules,
};
use crate::app_error::AppResult;
use crate::app_paths::AppPaths;

#[tauri::command]
pub fn list_backgrounds(app_paths: State<'_, AppPaths>) -> AppResult<Vec<BackgroundAsset>> {
    list_background_files(&app_paths.backgrounds_dir)
}

#[tauri::command]
pub fn import_background(source_path: PathBuf, app_paths: State<'_, AppPaths>) -> AppResult<BackgroundAsset> {
    import_background_file(&source_path, &app_paths.backgrounds_dir)
}

#[tauri::command]
pub fn delete_background(file_name: String, app_paths: State<'_, AppPaths>) -> AppResult<()> {
    delete_background_file(&file_name, &app_paths.backgrounds_dir)
}

#[tauri::command]
pub fn list_items(app_paths: State<'_, AppPaths>) -> AppResult<Vec<BackgroundAsset>> {
    list_background_files(&app_paths.items_dir)
}

#[tauri::command]
pub fn import_item(source_path: PathBuf, app_paths: State<'_, AppPaths>) -> AppResult<BackgroundAsset> {
    import_media_file(&source_path, &app_paths.items_dir, MediaRules::ImagesOnly)
}

#[tauri::command]
pub fn delete_item(file_name: String, app_paths: State<'_, AppPaths>) -> AppResult<()> {
    delete_background_file(&file_name, &app_paths.items_dir)
}
