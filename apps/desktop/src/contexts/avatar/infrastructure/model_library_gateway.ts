import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open as open_file_dialog } from "@tauri-apps/plugin-dialog";
import { MODEL_DEFINITION_FILE_NAME, parse_model_definition, type ModelDefinition } from "@vtubearea/model-format";
import { is_desktop_runtime } from "../../../shared/platform";
import { join_safe_relative_path } from "../../../shared/safe_relative_path";

export interface ModelSummary {
  id: string;
  display_name: string;
  folder_path: string;
}

export interface LoadedModel {
  model_definition: ModelDefinition;
  resolve_texture_url: (relative_texture_path: string) => string;
}

export interface ModelLibraryGateway {
  /** False in the browser build: no file system, only the bundled sample. */
  readonly can_manage_files: boolean;
  list_models(): Promise<ModelSummary[]>;
  load_model(model_summary: ModelSummary): Promise<LoadedModel>;
  /** Opens a folder picker. Resolves to null when the user cancels. */
  pick_and_import_model(): Promise<ModelSummary | null>;
  import_model_from_path(source_path: string): Promise<ModelSummary>;
  open_models_folder(): Promise<void>;
}

async function fetch_model_definition(definition_url: string): Promise<ModelDefinition> {
  const response = await fetch(definition_url);
  if (!response.ok) throw new Error(`Cannot read ${MODEL_DEFINITION_FILE_NAME} (${response.status})`);
  const parse_result = parse_model_definition(await response.json());
  if (!parse_result.success) throw new Error(parse_result.problems.join("\n"));
  return parse_result.model_definition;
}

const desktop_model_library_gateway: ModelLibraryGateway = {
  can_manage_files: true,
  list_models: () => invoke<ModelSummary[]>("list_models"),
  async load_model(model_summary) {
    const to_url = (relative_path: string) => convertFileSrc(join_safe_relative_path(model_summary.folder_path, relative_path));
    return {
      model_definition: await fetch_model_definition(to_url(MODEL_DEFINITION_FILE_NAME)),
      resolve_texture_url: to_url,
    };
  },
  async pick_and_import_model() {
    const selected_folder = await open_file_dialog({ directory: true, multiple: false });
    return typeof selected_folder === "string" ? this.import_model_from_path(selected_folder) : null;
  },
  import_model_from_path: (source_path) => invoke<ModelSummary>("import_model", { sourcePath: source_path }),
  open_models_folder: () => invoke<void>("open_models_folder"),
};

// Dev-only values injected by vite.config.ts; folders are served through Vite's /@fs route.
declare const __SAMPLE_MODELS_DEV_PATH__: string;
declare const __SAMPLE_MODEL_IDS__: string[];

const browser_model_library_gateway: ModelLibraryGateway = {
  can_manage_files: false,
  async list_models() {
    return __SAMPLE_MODEL_IDS__.map((model_id) => ({
      id: model_id,
      display_name: model_id.charAt(0).toUpperCase() + model_id.slice(1),
      folder_path: `/@fs${__SAMPLE_MODELS_DEV_PATH__}/${model_id}`,
    }));
  },
  async load_model(model_summary) {
    const to_url = (relative_path: string) => join_safe_relative_path(model_summary.folder_path, relative_path);
    return {
      model_definition: await fetch_model_definition(to_url(MODEL_DEFINITION_FILE_NAME)),
      resolve_texture_url: to_url,
    };
  },
  pick_and_import_model: async () => null,
  import_model_from_path: async () => {
    throw new Error("Importing needs the desktop app");
  },
  open_models_folder: async () => undefined,
};

export const model_library_gateway = is_desktop_runtime ? desktop_model_library_gateway : browser_model_library_gateway;
