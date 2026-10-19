use std::path::PathBuf;

/// Folders for user content. Each can be moved with an environment variable.
#[derive(Debug, Clone)]
pub struct AppPaths {
    pub data_dir: PathBuf,
    pub models_dir: PathBuf,
    pub backgrounds_dir: PathBuf,
    /// Images placed on the scene (props, stickers).
    pub items_dir: PathBuf,
}

impl AppPaths {
    pub fn resolve(default_data_dir: PathBuf) -> Self {
        let data_dir = path_from_env("VTUBEAREA_DATA_DIR").unwrap_or(default_data_dir);
        let models_dir = path_from_env("VTUBEAREA_MODELS_DIR").unwrap_or_else(|| data_dir.join("models"));
        let backgrounds_dir = data_dir.join("backgrounds");
        let items_dir = data_dir.join("items");
        Self { data_dir, models_dir, backgrounds_dir, items_dir }
    }

    pub fn ensure_exists(&self) -> std::io::Result<()> {
        for directory in [&self.data_dir, &self.models_dir, &self.backgrounds_dir, &self.items_dir] {
            std::fs::create_dir_all(directory)?;
        }
        Ok(())
    }
}

fn path_from_env(variable_name: &str) -> Option<PathBuf> {
    std::env::var(variable_name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
}
