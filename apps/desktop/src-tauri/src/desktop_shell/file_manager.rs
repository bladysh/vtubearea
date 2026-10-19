use std::path::Path;
use std::process::Command;

use crate::app_error::AppResult;

/// Opens the folder in Finder, Explorer or the Linux file manager.
pub fn reveal_in_file_manager(folder_path: &Path) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let program = "xdg-open";

    Command::new(program).arg(folder_path).spawn()?;
    Ok(())
}
