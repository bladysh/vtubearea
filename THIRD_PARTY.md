# Third-party components

vTubeArea itself is licensed under PolyForm Noncommercial 1.0.0 (see `LICENSE`).
It ships the components below under their own licenses. Rule for new dependencies:
only MIT, Apache-2.0, BSD, ISC, Zlib, MPL-2.0, Unicode-3.0 or Unlicense. Anything else
(GPL, LGPL-only, proprietary SDKs such as Live2D Cubism) needs the owner's decision first.

Audit commands: `pnpm licenses list --prod` and
`cargo metadata --format-version 1` (see `docs/architecture/licensing.md`).

## Shipped in the desktop app (direct dependencies)

| Component | License | Used for |
| --- | --- | --- |
| React, React DOM | MIT | UI |
| Zustand | MIT | UI state |
| Zod | MIT | Config, model and protocol validation |
| PixiJS 8 | MIT | 2D rendering (WebGL) |
| lucide-react | ISC | Icons |
| @mediapipe/tasks-vision | Apache-2.0 | Webcam face tracking (WASM) |
| MediaPipe `face_landmarker.task` model | Apache-2.0 | Face landmark and blendshape model, downloaded by `pnpm setup:assets` |
| MediaPipe `hand_landmarker.task` model | Apache-2.0 | Hand landmark model, downloaded by `pnpm setup:assets` |
| Tauri 2, @tauri-apps/api | MIT OR Apache-2.0 | Desktop shell |
| tauri-plugin-dialog | MIT OR Apache-2.0 | File and folder pickers |
| serde, serde_json, thiserror | MIT OR Apache-2.0 | Rust serialization and errors |
| dotenvy | MIT | `.env` loading in development |

## Notable transitive licenses

- **MPL-2.0** (file-level copyleft, fine in a closed product as long as these
  files themselves stay unmodified): `cssparser`, `cssparser-macros`,
  `selectors`, `dtoa-short`, `option-ext` — pulled in by Tauri.
- **Unicode-3.0**: ICU data crates (`icu_*`, `zerovec`, `yoke`, ...) via URL handling.
- **LGPL-2.1 as one option only**: `r-efi` is `MIT OR Apache-2.0 OR LGPL-2.1-or-later`;
  we use it under MIT.
- Everything else in the JS production tree is MIT, ISC or BSD-3-Clause.

## Development only (not shipped)

Vite, Vitest, ESLint, typescript-eslint, TypeScript, @vitejs/plugin-react,
@tauri-apps/cli, tempfile — all MIT or Apache-2.0.

## Not used, on purpose

- Live2D Cubism SDK / Cubism Core (proprietary; revenue-based license).
- VTube Studio files. Its sample models are Live2D `.moc3` and are not read or bundled.
- Fonts with OFL: the UI uses system fonts.
