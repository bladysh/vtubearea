use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::app_error::{AppError, AppResult};
use crate::file_system::{sanitize_file_stem, unique_child_path};

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif"];
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "webm", "mov"];

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BackgroundKind {
    Image,
    Video,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct BackgroundAsset {
    pub file_name: String,
    pub file_path: PathBuf,
    pub kind: BackgroundKind,
}

/// Which media a folder accepts: backgrounds take images and videos, scene items only images.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MediaRules {
    ImagesAndVideos,
    ImagesOnly,
}

impl MediaRules {
    fn accepts(self, kind: BackgroundKind) -> bool {
        self == MediaRules::ImagesAndVideos || kind == BackgroundKind::Image
    }
}

pub fn import_background_file(source_path: &Path, backgrounds_dir: &Path) -> AppResult<BackgroundAsset> {
    import_media_file(source_path, backgrounds_dir, MediaRules::ImagesAndVideos)
}

pub fn import_media_file(source_path: &Path, target_dir: &Path, media_rules: MediaRules) -> AppResult<BackgroundAsset> {
    let extension = lowercase_extension(source_path);
    let is_accepted = background_kind(&extension).is_some_and(|kind| media_rules.accepts(kind));
    if !is_accepted {
        return Err(AppError::InvalidInput(format!("unsupported background file type: .{extension}")));
    }
    let file_stem = source_path.file_stem().map(|stem| stem.to_string_lossy().to_string()).unwrap_or_default();
    let destination_path = unique_child_path(target_dir, &sanitize_file_stem(&file_stem), Some(&extension));
    fs::copy(source_path, &destination_path)?;
    describe_background(&destination_path)
        .ok_or_else(|| AppError::InvalidInput("imported file could not be read".into()))
}

pub fn list_background_files(backgrounds_dir: &Path) -> AppResult<Vec<BackgroundAsset>> {
    let mut background_assets: Vec<BackgroundAsset> = fs::read_dir(backgrounds_dir)?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter_map(|file_path| describe_background(&file_path))
        .collect();
    background_assets.sort_by(|first, second| first.file_name.cmp(&second.file_name));
    Ok(background_assets)
}

pub fn delete_background_file(file_name: &str, backgrounds_dir: &Path) -> AppResult<()> {
    // Only a bare file name is accepted, so the UI cannot delete outside the folder.
    let is_bare_name = Path::new(file_name).file_name().map(|name| name == file_name).unwrap_or(false);
    if !is_bare_name {
        return Err(AppError::InvalidInput("invalid background file name".into()));
    }
    fs::remove_file(backgrounds_dir.join(file_name))?;
    Ok(())
}

fn describe_background(file_path: &Path) -> Option<BackgroundAsset> {
    if !file_path.is_file() {
        return None;
    }
    let kind = background_kind(&lowercase_extension(file_path))?;
    let file_name = file_path.file_name()?.to_string_lossy().to_string();
    Some(BackgroundAsset { file_name, file_path: file_path.to_path_buf(), kind })
}

fn background_kind(extension: &str) -> Option<BackgroundKind> {
    if IMAGE_EXTENSIONS.contains(&extension) {
        Some(BackgroundKind::Image)
    } else if VIDEO_EXTENSIONS.contains(&extension) {
        Some(BackgroundKind::Video)
    } else {
        None
    }
}

fn lowercase_extension(file_path: &Path) -> String {
    file_path.extension().map(|extension| extension.to_string_lossy().to_lowercase()).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imports_lists_and_deletes_backgrounds() {
        let source_dir = tempfile::tempdir().unwrap();
        let backgrounds_dir = tempfile::tempdir().unwrap();
        let source_image = source_dir.path().join("Cozy Room.PNG");
        fs::write(&source_image, b"png").unwrap();

        let imported_asset = import_background_file(&source_image, backgrounds_dir.path()).unwrap();
        assert_eq!(imported_asset.file_name, "Cozy_Room.png");
        assert_eq!(imported_asset.kind, BackgroundKind::Image);
        assert_eq!(list_background_files(backgrounds_dir.path()).unwrap().len(), 1);

        delete_background_file("Cozy_Room.png", backgrounds_dir.path()).unwrap();
        assert!(list_background_files(backgrounds_dir.path()).unwrap().is_empty());
    }

    #[test]
    fn scene_items_accept_images_but_not_videos() {
        let source_dir = tempfile::tempdir().unwrap();
        let items_dir = tempfile::tempdir().unwrap();
        let sticker = source_dir.path().join("cat.webp");
        let clip = source_dir.path().join("clip.mp4");
        fs::write(&sticker, b"webp").unwrap();
        fs::write(&clip, b"mp4").unwrap();

        assert!(import_media_file(&sticker, items_dir.path(), MediaRules::ImagesOnly).is_ok());
        assert!(import_media_file(&clip, items_dir.path(), MediaRules::ImagesOnly).is_err());
    }

    #[test]
    fn rejects_unknown_types_and_path_tricks() {
        let source_dir = tempfile::tempdir().unwrap();
        let backgrounds_dir = tempfile::tempdir().unwrap();
        let script_file = source_dir.path().join("evil.sh");
        fs::write(&script_file, b"echo").unwrap();

        assert!(import_background_file(&script_file, backgrounds_dir.path()).is_err());
        assert!(delete_background_file("../evil.sh", backgrounds_dir.path()).is_err());
    }
}
