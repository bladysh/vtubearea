import type { BindingKeyframe, ParameterBinding } from "@vtubearea/model-format";

/** How a node differs from its rest state for the current parameter values. */
export interface NodePose {
  translate_x: number;
  translate_y: number;
  rotation_degrees: number;
  scale_x: number;
  scale_y: number;
  opacity: number;
  /** Summed vertex offsets, or null when no binding moves vertices. */
  vertex_offsets: Float32Array | null;
}

export type ParameterValues = Readonly<Record<string, number>>;

export function create_rest_pose(): NodePose {
  return { translate_x: 0, translate_y: 0, rotation_degrees: 0, scale_x: 1, scale_y: 1, opacity: 1, vertex_offsets: null };
}

/**
 * Combines every binding of a node. Bindings stack: translations and rotations add,
 * scale and opacity multiply, vertex offsets add. Values outside the keyframe range clamp.
 */
export function evaluate_node_pose(
  bindings: readonly ParameterBinding[],
  parameter_values: ParameterValues,
  vertex_value_count: number,
): NodePose {
  const node_pose = create_rest_pose();
  for (const binding of bindings) {
    const parameter_value = parameter_values[binding.parameter_id] ?? 0;
    const { lower_keyframe, upper_keyframe, blend } = find_surrounding_keyframes(binding.keyframes, parameter_value);

    const translate_lower = lower_keyframe.translate ?? [0, 0];
    const translate_upper = upper_keyframe.translate ?? [0, 0];
    node_pose.translate_x += interpolate(translate_lower[0], translate_upper[0], blend);
    node_pose.translate_y += interpolate(translate_lower[1], translate_upper[1], blend);
    node_pose.rotation_degrees += interpolate(lower_keyframe.rotation_degrees ?? 0, upper_keyframe.rotation_degrees ?? 0, blend);

    const scale_lower = lower_keyframe.scale ?? [1, 1];
    const scale_upper = upper_keyframe.scale ?? [1, 1];
    node_pose.scale_x *= interpolate(scale_lower[0], scale_upper[0], blend);
    node_pose.scale_y *= interpolate(scale_lower[1], scale_upper[1], blend);
    node_pose.opacity *= interpolate(lower_keyframe.opacity ?? 1, upper_keyframe.opacity ?? 1, blend);

    if (lower_keyframe.vertex_offsets || upper_keyframe.vertex_offsets) {
      node_pose.vertex_offsets ??= new Float32Array(vertex_value_count);
      for (let value_index = 0; value_index < vertex_value_count; value_index += 1) {
        const offset_lower = lower_keyframe.vertex_offsets?.[value_index] ?? 0;
        const offset_upper = upper_keyframe.vertex_offsets?.[value_index] ?? 0;
        node_pose.vertex_offsets[value_index]! += interpolate(offset_lower, offset_upper, blend);
      }
    }
  }
  return node_pose;
}

function find_surrounding_keyframes(keyframes: readonly BindingKeyframe[], parameter_value: number) {
  const first_keyframe = keyframes[0]!;
  const last_keyframe = keyframes[keyframes.length - 1]!;
  if (parameter_value <= first_keyframe.parameter_value) {
    return { lower_keyframe: first_keyframe, upper_keyframe: first_keyframe, blend: 0 };
  }
  if (parameter_value >= last_keyframe.parameter_value) {
    return { lower_keyframe: last_keyframe, upper_keyframe: last_keyframe, blend: 0 };
  }
  for (let keyframe_index = 1; keyframe_index < keyframes.length; keyframe_index += 1) {
    const upper_keyframe = keyframes[keyframe_index]!;
    if (parameter_value <= upper_keyframe.parameter_value) {
      const lower_keyframe = keyframes[keyframe_index - 1]!;
      const span = upper_keyframe.parameter_value - lower_keyframe.parameter_value;
      return { lower_keyframe, upper_keyframe, blend: (parameter_value - lower_keyframe.parameter_value) / span };
    }
  }
  return { lower_keyframe: last_keyframe, upper_keyframe: last_keyframe, blend: 0 };
}

function interpolate(start_value: number, end_value: number, blend: number): number {
  return start_value + (end_value - start_value) * blend;
}
