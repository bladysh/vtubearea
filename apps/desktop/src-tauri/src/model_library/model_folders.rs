use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::app_error::{AppError, AppResult};
use crate::file_system::{copy_directory, sanitize_file_stem, unique_child_path};

pub const MODEL_DEFINITION_FILE_NAME: &str = "model.json";
/// One line per sample model id that was installed once.
const SEEDED_SAMPLE_MODELS_FILE: &str = ".seeded_sample_models";

/// A model folder found on disk. The UI loads and validates model.json itself.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ModelSummary {
    /// Folder name, unique inside the models folder.
    pub id: String,
    pub display_name: String,
    pub folder_path: PathBuf,
    pub definition_path: PathBuf,
}

pub fn list_model_folders(models_dir: &Path) -> AppResult<Vec<ModelSummary>> {
    let mut model_summaries = Vec::new();
    for entry in fs::read_dir(models_dir)? {
        let folder_path = entry?.path();
        if folder_path.join(MODEL_DEFINITION_FILE_NAME).is_file() {
            model_summaries.push(summarize_model_folder(&folder_path));
        }
    }
    model_summaries.sort_by_key(|summary| summary.display_name.to_lowercase());
    Ok(model_summaries)
}

/// Copies a model folder (or the folder of a picked model.json) into the models folder.
pub fn import_model_folder(source_path: &Path, models_dir: &Path) -> AppResult<ModelSummary> {
    let source_folder = if source_path.is_file() {
        source_path.parent().map(Path::to_path_buf).unwrap_or_default()
    } else {
        source_path.to_path_buf()
    };
    if !source_folder.join(MODEL_DEFINITION_FILE_NAME).is_file() {
        return Err(AppError::InvalidInput(format!(
            "{} has no {MODEL_DEFINITION_FILE_NAME}",
            source_folder.display()
        )));
    }
    if source_folder.starts_with(models_dir) {
        return Err(AppError::InvalidInput("this model is already in the models folder".into()));
    }
    let folder_name = source_folder.file_name().map(|name| name.to_string_lossy().to_string()).unwrap_or_default();
    let destination_folder = unique_child_path(models_dir, &sanitize_file_stem(&folder_name), None);
    copy_directory(&source_folder, &destination_folder)?;
    Ok(summarize_model_folder(&destination_folder))
}

/// Installs each bundled sample model once. A sample the user deleted stays deleted;
/// samples added in a newer app version still get installed. With `refresh_installed`
/// (development builds) installed samples are replaced, so edits in the repo show up.
pub fn seed_sample_models(sample_models_dir: &Path, models_dir: &Path, data_dir: &Path, refresh_installed: bool) -> AppResult<()> {
    if !sample_models_dir.is_dir() {
        return Ok(());
    }
    let seeded_list_path = data_dir.join(SEEDED_SAMPLE_MODELS_FILE);
    let seeded_list_text = fs::read_to_string(&seeded_list_path).unwrap_or_default();
    let mut seeded_model_ids: Vec<String> = seeded_list_text.lines().map(str::to_string).collect();

    for entry in fs::read_dir(sample_models_dir)? {
        let sample_folder = entry?.path();
        let model_id = sample_folder.file_name().map(|name| name.to_string_lossy().to_string()).unwrap_or_default();
        let is_model_folder = sample_folder.join(MODEL_DEFINITION_FILE_NAME).is_file();
        let destination_folder = models_dir.join(&model_id);
        if is_model_folder && refresh_installed && destination_folder.is_dir() {
            fs::remove_dir_all(&destination_folder)?;
            copy_directory(&sample_folder, &destination_folder)?;
        }
        if !is_model_folder || seeded_model_ids.contains(&model_id) {
            continue;
        }
        if !destination_folder.exists() {
            copy_directory(&sample_folder, &destination_folder)?;
        }
        seeded_model_ids.push(model_id);
    }
    fs::write(seeded_list_path, seeded_model_ids.join("\n"))?;
    Ok(())
}

fn summarize_model_folder(folder_path: &Path) -> ModelSummary {
    let id = folder_path.file_name().map(|name| name.to_string_lossy().to_string()).unwrap_or_default();
    let definition_path = folder_path.join(MODEL_DEFINITION_FILE_NAME);
    let display_name = read_model_name(&definition_path).unwrap_or_else(|| id.clone());
    ModelSummary { id, display_name, folder_path: folder_path.to_path_buf(), definition_path }
}

fn read_model_name(definition_path: &Path) -> Option<String> {
    let definition_text = fs::read_to_string(definition_path).ok()?;
    let definition_json: serde_json::Value = serde_json::from_str(&definition_text).ok()?;
    definition_json.pointer("/metadata/name")?.as_str().map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_model(folder: &Path, name: &str) {
        fs::create_dir_all(folder.join("textures")).unwrap();
        fs::write(folder.join(MODEL_DEFINITION_FILE_NAME), format!(r#"{{"metadata":{{"name":"{name}"}}}}"#)).unwrap();
        fs::write(folder.join("textures/face.png"), b"png").unwrap();
    }

    #[test]
    fn lists_only_folders_with_model_json_sorted_by_name() {
        let models_dir = tempfile::tempdir().unwrap();
        write_model(&models_dir.path().join("zeta"), "Zeta");
        write_model(&models_dir.path().join("alpha"), "alpha");
        fs::create_dir_all(models_dir.path().join("empty")).unwrap();

        let model_summaries = list_model_folders(models_dir.path()).unwrap();
        let names: Vec<_> = model_summaries.iter().map(|summary| summary.display_name.as_str()).collect();
        assert_eq!(names, ["alpha", "Zeta"]);
    }

    #[test]
    fn imports_a_copy_with_a_unique_folder_name() {
        let source_dir = tempfile::tempdir().unwrap();
        let models_dir = tempfile::tempdir().unwrap();
        let source_model = source_dir.path().join("My Model");
        write_model(&source_model, "Mine");

        let first_import = import_model_folder(&source_model, models_dir.path()).unwrap();
        let second_import = import_model_folder(&source_model.join(MODEL_DEFINITION_FILE_NAME), models_dir.path()).unwrap();

        assert_eq!(first_import.id, "My_Model");
        assert_eq!(second_import.id, "My_Model-2");
        assert!(second_import.folder_path.join("textures/face.png").is_file());
    }

    #[test]
    fn rejects_folders_without_model_json() {
        let source_dir = tempfile::tempdir().unwrap();
        let models_dir = tempfile::tempdir().unwrap();
        assert!(import_model_folder(source_dir.path(), models_dir.path()).is_err());
    }

    #[test]
    fn seeds_each_sample_model_once_and_picks_up_new_ones() {
        let samples_dir = tempfile::tempdir().unwrap();
        let data_dir = tempfile::tempdir().unwrap();
        let models_dir = data_dir.path().join("models");
        fs::create_dir_all(&models_dir).unwrap();
        write_model(&samples_dir.path().join("lumi"), "Lumi");

        seed_sample_models(samples_dir.path(), &models_dir, data_dir.path(), false).unwrap();
        assert!(models_dir.join("lumi").is_dir());

        // The user deletes Lumi, and a newer app version ships Kuro.
        fs::remove_dir_all(models_dir.join("lumi")).unwrap();
        write_model(&samples_dir.path().join("kuro"), "Kuro");
        seed_sample_models(samples_dir.path(), &models_dir, data_dir.path(), false).unwrap();

        assert!(!models_dir.join("lumi").exists());
        assert!(models_dir.join("kuro").is_dir());
    }

    #[test]
    fn refreshes_installed_samples_in_development() {
        let samples_dir = tempfile::tempdir().unwrap();
        let data_dir = tempfile::tempdir().unwrap();
        let models_dir = data_dir.path().join("models");
        fs::create_dir_all(&models_dir).unwrap();
        write_model(&samples_dir.path().join("lumi"), "Lumi");
        seed_sample_models(samples_dir.path(), &models_dir, data_dir.path(), false).unwrap();

        write_model(&samples_dir.path().join("lumi"), "Lumi v2");
        seed_sample_models(samples_dir.path(), &models_dir, data_dir.path(), true).unwrap();

        let model_summaries = list_model_folders(&models_dir).unwrap();
        assert_eq!(model_summaries[0].display_name, "Lumi v2");
    }
}
