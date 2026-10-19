import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repository_root = fileURLToPath(new URL("../..", import.meta.url));
const desktop_package: { version: string } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const sample_models_path = fileURLToPath(new URL("../../assets/sample-models", import.meta.url));
// Browser preview has no file system access, so it gets the sample model folders at build time.
const sample_model_ids = readdirSync(sample_models_path, { withFileTypes: true })
  .filter((directory_entry) => directory_entry.isDirectory())
  .map((directory_entry) => directory_entry.name);

// Tauri expects a fixed dev port and must see Rust-side errors in the terminal.
export default defineConfig({
  plugins: [react()],
  envDir: repository_root,
  clearScreen: false,
  define: {
    __SAMPLE_MODELS_DEV_PATH__: JSON.stringify(sample_models_path),
    __SAMPLE_MODEL_IDS__: JSON.stringify(sample_model_ids),
    __APP_VERSION__: JSON.stringify(desktop_package.version),
  },
  server: {
    port: 1420,
    strictPort: true,
    fs: { allow: [repository_root] },
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "safari16",
    chunkSizeWarningLimit: 2000,
  },
});
