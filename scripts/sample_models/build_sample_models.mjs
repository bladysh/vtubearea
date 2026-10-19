// Regenerates assets/sample-models/<id>/ (model.json + textures) from code.
// Run: pnpm build:sample-models
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build_sample_model_definition } from "./sample_model_rig.mjs";
import { build_sample_model_textures } from "./sample_model_textures.mjs";

const SAMPLE_MODELS = [
  {
    id: "lumi",
    metadata: {
      name: "Lumi",
      author: "vTubeArea",
      license: "PolyForm-Noncommercial-1.0.0 (part of vTubeArea)",
      description: "Sample model: head turn, blink, gaze, brows, mouth, blush, tracked hands, hair physics.",
    },
    features: { hair_style: "long", bangs_style: "spiky", has_cat_ears: false },
    palette: {
      hair_back: ["#5B3FA8", "#22184A"],
      bangs: ["#8B6BE0", "#4A3391"],
      accent: "#D1FE17",
      brow: "#3B2A6E",
      iris: ["#E8FF7A", "#B5DC12", "#4E6300"],
      hoodie: ["#2A2D31", "#16181A"],
      collar: "#383E46",
      strings: "#D1FE17",
      skin: ["#FFE6D8", "#F3C6B4"],
      neck: ["#E9BFAE", "#FFE3D3"],
      lash: "#1A1626",
      mouth_line: "#8A3A4A",
      mouth_inner: "#5A1E2E",
      tongue: "#E06C7C",
      blush: "#FF7A9A",
      nose: "#D9998A",
      hand_outline: "#D9A08E",
    },
  },
  {
    id: "kuro",
    metadata: {
      name: "Kuro",
      author: "vTubeArea",
      license: "PolyForm-Noncommercial-1.0.0 (part of vTubeArea)",
      description: "Second sample model: cat ears, bob haircut, tracked hands.",
    },
    features: { hair_style: "bob", bangs_style: "straight", has_cat_ears: true },
    palette: {
      hair_back: ["#3A3F5C", "#12141F"],
      bangs: ["#4A5175", "#1F2335"],
      accent: "#5CE1FF",
      brow: "#1F2335",
      iris: ["#FFC2CE", "#FF4D6D", "#7A0019"],
      hoodie: ["#F2F2F5", "#C9CBD3"],
      collar: "#A9ACB8",
      strings: "#FF4D6D",
      skin: ["#FFF0E6", "#F0CDBD"],
      neck: ["#EBC6B6", "#FFEDE2"],
      lash: "#14121C",
      mouth_line: "#8A3A4A",
      mouth_inner: "#5A1E2E",
      tongue: "#E06C7C",
      blush: "#FF8FA8",
      nose: "#DDA394",
      hand_outline: "#DDB0A0",
      ear_inner: "#FF9EB5",
    },
  },
  {
    id: "haru",
    metadata: {
      name: "Haru",
      author: "vTubeArea",
      license: "PolyForm-Noncommercial-1.0.0 (part of vTubeArea)",
      description: "Male sample model: ash-white swept hair, amber eyes, zip hoodie, tracked hands with every finger.",
    },
    features: { hair_style: "short", bangs_style: "swept", face_style: "defined", eye_style: "narrow", brow_style: "straight", body_style: "zip_hoodie", has_bangs_shadow: true, has_cat_ears: false },
    palette: {
      hair_back: ["#A9AEC4", "#5F6480"],
      bangs: ["#F1F2F7", "#B3B7CA"],
      accent: "#D1FE17",
      brow: "#6E7389",
      iris: ["#FFE29A", "#E4922A", "#7A3A0A"],
      hoodie: ["#2C3550", "#171C2B"],
      collar: "#3C4766",
      strings: "#D1FE17",
      skin: ["#FFE6D8", "#F0C4B0"],
      neck: ["#E6BCA9", "#FFE2D2"],
      lash: "#262231",
      mouth_line: "#8A4048",
      mouth_inner: "#5A1E2E",
      tongue: "#E06C7C",
      blush: "#F2928A",
      nose: "#D49A8A",
      hand_outline: "#D6A08C",
    },
  },
];

const project_root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const output_root = join(project_root, "assets", "sample-models");

/** Pretty JSON that keeps short objects on one line, so model files stay readable and short. */
function format_compact_json(value, indent_level = 0) {
  const inline_text = JSON.stringify(value);
  const is_container = value !== null && typeof value === "object";
  if (!is_container || inline_text.length + indent_level * 2 <= 110) return inline_text.replaceAll('","', '", "').replaceAll('":', '": ');
  const inner_indent = "  ".repeat(indent_level + 1);
  const closing_indent = "  ".repeat(indent_level);
  if (Array.isArray(value)) {
    const items = value.map((item) => inner_indent + format_compact_json(item, indent_level + 1));
    return `[\n${items.join(",\n")}\n${closing_indent}]`;
  }
  const entries = Object.entries(value).map(
    ([key, entry_value]) => `${inner_indent}${JSON.stringify(key)}: ${format_compact_json(entry_value, indent_level + 1)}`,
  );
  return `{\n${entries.join(",\n")}\n${closing_indent}}`;
}

function write_model_definition(model_id, model_definition) {
  const model_directory = join(output_root, model_id);
  rmSync(model_directory, { recursive: true, force: true });
  mkdirSync(join(model_directory, "textures"), { recursive: true });
  writeFileSync(join(model_directory, "model.json"), `${format_compact_json(model_definition)}\n`);
  return model_directory;
}

for (const sample_model of SAMPLE_MODELS) {
  const model_definition = build_sample_model_definition(sample_model.metadata, sample_model.features, sample_model.palette);
  const model_directory = write_model_definition(sample_model.id, model_definition);
  const textures = build_sample_model_textures(sample_model.palette, sample_model.features);
  for (const [file_name, svg_text] of Object.entries(textures)) writeFileSync(join(model_directory, "textures", file_name), svg_text);
  console.log(`${sample_model.id}: ${model_definition.layers.length} layers, ${Object.keys(textures).length} textures`);
}
