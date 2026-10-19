/**
 * One tracking input driving one model parameter, like a VTube Studio parameter row:
 * the input range is stretched onto the output range.
 */
export interface ParameterMapping {
  id: string;
  input_name: string;
  output_parameter_id: string;
  input_minimum: number;
  input_maximum: number;
  output_minimum: number;
  output_maximum: number;
  /** Keep the result inside the output range. */
  clamp_output: boolean;
  /** 0 = raw, 100 = very smooth. Same scale as VTube Studio. */
  smoothing: number;
  is_enabled: boolean;
}

export function map_input_value(mapping: ParameterMapping, input_value: number): number {
  const input_span = mapping.input_maximum - mapping.input_minimum;
  const progress = input_span === 0 ? 0 : (input_value - mapping.input_minimum) / input_span;
  const output_value = mapping.output_minimum + progress * (mapping.output_maximum - mapping.output_minimum);
  if (!mapping.clamp_output) return output_value;
  const lower_bound = Math.min(mapping.output_minimum, mapping.output_maximum);
  const upper_bound = Math.max(mapping.output_minimum, mapping.output_maximum);
  return Math.min(upper_bound, Math.max(lower_bound, output_value));
}

const MAXIMUM_SMOOTHING_SECONDS = 0.35;

/** Frame-rate independent exponential smoothing toward the target. */
export function smooth_toward(current_value: number, target_value: number, smoothing: number, delta_seconds: number): number {
  if (smoothing <= 0) return target_value;
  const time_constant_seconds = (Math.min(smoothing, 100) / 100) * MAXIMUM_SMOOTHING_SECONDS;
  const blend = 1 - Math.exp(-delta_seconds / time_constant_seconds);
  return current_value + (target_value - current_value) * blend;
}

export function create_mapping_id(input_name: string, output_parameter_id: string): string {
  return `${input_name}->${output_parameter_id}`;
}
