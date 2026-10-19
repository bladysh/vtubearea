use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Copies a folder tree. Symlinks are skipped so an import cannot pull in files from elsewhere.
pub fn copy_directory(source_dir: &Path, destination_dir: &Path) -> io::Result<()> {
    fs::create_dir_all(destination_dir)?;
    for entry in fs::read_dir(source_dir)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let destination_path = destination_dir.join(entry.file_name());
        if file_type.is_dir() {
            copy_directory(&entry.path(), &destination_path)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), destination_path)?;
        }
    }
    Ok(())
}

/// Returns `parent/name`, or `parent/name-2`, `-3`... if taken.
pub fn unique_child_path(parent_dir: &Path, file_stem: &str, extension: Option<&str>) -> PathBuf {
    let build_name = |suffix: String| match extension {
        Some(extension) => format!("{file_stem}{suffix}.{extension}"),
        None => format!("{file_stem}{suffix}"),
    };
    let mut candidate_path = parent_dir.join(build_name(String::new()));
    let mut copy_number = 2;
    while candidate_path.exists() {
        candidate_path = parent_dir.join(build_name(format!("-{copy_number}")));
        copy_number += 1;
    }
    candidate_path
}

/// Keeps letters, digits, dash and underscore so user file names are safe on every OS.
pub fn sanitize_file_stem(raw_name: &str) -> String {
    let sanitized_name: String = raw_name
        .chars()
        .map(|character| if character.is_alphanumeric() || character == '-' || character == '_' { character } else { '_' })
        .collect();
    let trimmed_name = sanitized_name.trim_matches('_');
    if trimmed_name.is_empty() { "untitled".to_string() } else { trimmed_name.to_string() }
}
