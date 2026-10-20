import type { ModelParameter } from "@vtubearea/model-format";
import { create_mapping_id, type ParameterMapping } from "./parameter_mapping";

type MappingTemplate = Omit<ParameterMapping, "id" | "is_enabled" | "clamp_output">;

function template(
  input_name: string,
  output_parameter_id: string,
  input_range: [number, number],
  output_range: [number, number],
  smoothing: number,
): MappingTemplate {
  return {
    input_name,
    output_parameter_id,
    input_minimum: input_range[0],
    input_maximum: input_range[1],
    output_minimum: output_range[0],
    output_maximum: output_range[1],
    smoothing,
  };
}

/** Standard Live2D-style parameter names, with ranges close to VTube Studio defaults. */
const DEFAULT_MAPPING_TEMPLATES: readonly MappingTemplate[] = [
  // One to one: models with a wider ParamAngleX range turn further, the rest clamp at their limit.
  template("FaceAngleX", "ParamAngleX", [-90, 90], [-90, 90], 15),
  template("FaceAngleY", "ParamAngleY", [-20, 20], [-30, 30], 15),
  template("FaceAngleZ", "ParamAngleZ", [-30, 30], [-30, 30], 15),
  template("FaceAngleX", "ParamBodyAngleX", [-30, 30], [-10, 10], 20),
  template("FaceAngleZ", "ParamBodyAngleZ", [-30, 30], [-10, 10], 20),
  // Eye inputs are already 0..1 per user (adaptive range); the margins snap nearly-shut to shut.
  template("EyeOpenLeft", "ParamEyeLOpen", [0.15, 0.8], [0, 1], 0),
  template("EyeOpenRight", "ParamEyeROpen", [0.15, 0.8], [0, 1], 0),
  template("EyeLeftX", "ParamEyeBallX", [-1, 1], [-1, 1], 10),
  template("EyeLeftY", "ParamEyeBallY", [-1, 1], [-1, 1], 10),
  template("MouthOpen", "ParamMouthOpenY", [0.02, 0.6], [0, 1], 3),
  template("MouthSmile", "ParamMouthForm", [-0.4, 0.5], [-1, 1], 10),
  // Mouth shapes, for models that draw more than one open mouth.
  template("MouthFunnel", "ParamMouthFunnel", [0.1, 0.6], [0, 1], 5),
  template("MouthStretch", "ParamMouthStretch", [0.05, 0.45], [0, 1], 5),
  // MediaPipe's brow scores are small; a narrower input range gives brows a real range of motion.
  template("BrowLeftY", "ParamBrowLY", [-0.25, 0.3], [-1, 1], 10),
  template("BrowRightY", "ParamBrowRY", [-0.25, 0.3], [-1, 1], 10),
  // Hands: not Live2D standard names; models with hand layers use these.
  template("HandLeftFound", "ParamHandLeftVisible", [0, 1], [0, 1], 25),
  template("HandLeftPositionX", "ParamHandLeftX", [-1, 1], [-1, 1], 10),
  template("HandLeftPositionY", "ParamHandLeftY", [-1, 1], [-1, 1], 10),
  template("HandLeftOpen", "ParamHandLeftOpen", [0, 1], [0, 1], 15),
  template("HandRightFound", "ParamHandRightVisible", [0, 1], [0, 1], 25),
  template("HandRightPositionX", "ParamHandRightX", [-1, 1], [-1, 1], 10),
  template("HandRightPositionY", "ParamHandRightY", [-1, 1], [-1, 1], 10),
  template("HandRightOpen", "ParamHandRightOpen", [0, 1], [0, 1], 15),
];

/** Default mappings, keeping only parameters the model actually has. */
/**
 * The user's saved mappings, plus defaults for anything they have no mapping for yet (a model
 * update that added parameters, or a new default input), so new features work without a reset.
 */
export function mappings_with_defaults(saved_mappings: readonly ParameterMapping[] | undefined, model_parameters: readonly ModelParameter[]): ParameterMapping[] {
  const default_mappings = create_default_parameter_mappings(model_parameters);
  if (!saved_mappings) return default_mappings;
  const saved_ids = new Set(saved_mappings.map((mapping) => mapping.id));
  return [...saved_mappings, ...default_mappings.filter((mapping) => !saved_ids.has(mapping.id))];
}

export function create_default_parameter_mappings(model_parameters: readonly ModelParameter[]): ParameterMapping[] {
  const model_parameter_ids = new Set(model_parameters.map((parameter) => parameter.id));
  return DEFAULT_MAPPING_TEMPLATES.filter((mapping_template) => model_parameter_ids.has(mapping_template.output_parameter_id)).map(
    (mapping_template) => ({
      ...mapping_template,
      id: create_mapping_id(mapping_template.input_name, mapping_template.output_parameter_id),
      clamp_output: true,
      is_enabled: true,
    }),
  );
}
