// Puts MediaPipe runtime files into apps/desktop/public/mediapipe so tracking works offline.
// The WASM runtime is copied from node_modules; the face and hand models are downloaded once.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Both models are Apache-2.0, published by Google.
const MODEL_DOWNLOADS = [
  {
    file_name: "face_landmarker.task",
    url:
      process.env.FACE_LANDMARKER_MODEL_URL ??
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  },
  {
    file_name: "hand_landmarker.task",
    url:
      process.env.HAND_LANDMARKER_MODEL_URL ??
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  },
];

const repository_root = join(dirname(fileURLToPath(import.meta.url)), "..");
const desktop_root = join(repository_root, "apps", "desktop");
const output_directory = join(desktop_root, "public", "mediapipe");
const require_from_desktop = createRequire(join(desktop_root, "package.json"));
const tasks_vision_directory = dirname(require_from_desktop.resolve("@mediapipe/tasks-vision"));

mkdirSync(output_directory, { recursive: true });
cpSync(join(tasks_vision_directory, "wasm"), join(output_directory, "wasm"), { recursive: true });
console.log("Copied MediaPipe WASM runtime");

for (const model_download of MODEL_DOWNLOADS) {
  const model_path = join(output_directory, model_download.file_name);
  if (existsSync(model_path)) {
    console.log(`${model_download.file_name} already present`);
    continue;
  }
  const response = await fetch(model_download.url);
  if (!response.ok) throw new Error(`${model_download.file_name} download failed: ${response.status} ${response.statusText}`);
  writeFileSync(model_path, Buffer.from(await response.arrayBuffer()));
  console.log(`Downloaded ${model_download.file_name}`);
}
