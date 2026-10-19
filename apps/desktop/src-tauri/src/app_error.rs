use serde::{Serialize, Serializer};

/// Errors returned to the UI from Tauri commands.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("file system error: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    InvalidInput(String),
    #[error("window error: {0}")]
    Window(#[from] tauri::Error),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
