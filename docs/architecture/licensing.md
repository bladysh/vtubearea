# Licensing

- **vTubeArea**: [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)
  (`LICENSE`). Free to use, study, modify and share for any noncommercial purpose
  (personal use, streaming as a hobby, research, education, charities). Building a commercial
  product or service on it is not allowed. Source-available, not OSI "open source".
- **Copyright holder**: bladysh, sole author of the code. Because of that the owner can
  relicense later (for example sell a commercial license separately). Keep it that way:
  outside contributions need a contributor agreement (CLA) that allows relicensing.
- **Manifests**: `"license": "PolyForm-Noncommercial-1.0.0"` in every package.json, the same SPDX id
  in Cargo; packages stay `"private": true` / `publish = false`.
- **Dependencies**: see `THIRD_PARTY.md`. Before adding one, check its license:
  - JS: `pnpm licenses list --prod`
  - Rust: `cargo metadata --format-version 1 | jq -r '.packages[] | "\(.name) \(.license)"' | sort -u`
- **Sample models** "Lumi" and "Kuro" were drawn for this project (generated from code); same license.
- **Logo** (`design/logo/`) was made with an AI image generator (Codex). In many countries purely
  AI-generated images get weak or no copyright protection, so have a designer redraw it, and
  register the name/logo as a trademark if the brand matters.
- Do not bundle VTube Studio or Live2D sample models or Live2D Cubism Core.
