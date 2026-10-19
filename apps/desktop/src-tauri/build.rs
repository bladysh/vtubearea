fn main() {
    // Icons are embedded at compile time; without this, swapping the logo would not rebuild the app.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
