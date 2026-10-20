import type { TrackingInputValues } from "./tracking_inputs";

/** The lowest and highest value a user really reaches for one input, relative to their relaxed face. */
export interface ExpressionRange {
  minimum: number;
  maximum: number;
}

/** Per input, what the user reaches; captured by "Calibrate expressions". */
export type ExpressionRanges = Readonly<Record<string, ExpressionRange>>;

/**
 * Where the default parameter mappings expect each input to end up: a user who raises their
 * brows as far as they can should reach the top of the brow mapping, whatever MediaPipe measured.
 */
const TARGET_RANGES: Readonly<Record<string, ExpressionRange>> = {
  BrowLeftY: { minimum: -0.25, maximum: 0.3 },
  BrowRightY: { minimum: -0.25, maximum: 0.3 },
  MouthOpen: { minimum: 0, maximum: 0.6 },
  MouthSmile: { minimum: -0.4, maximum: 0.5 },
};
export const CALIBRATED_EXPRESSION_INPUTS = Object.keys(TARGET_RANGES);
/** A side the user barely moved is left alone: stretching noise would make the avatar twitch. */
const MINIMUM_REACH = 0.03;

export class ExpressionRangeRecorder {
  private readonly ranges = new Map<string, ExpressionRange>();

  add_sample(input_values: TrackingInputValues): void {
    for (const input_name of CALIBRATED_EXPRESSION_INPUTS) {
      const value = input_values[input_name];
      if (value === undefined) continue;
      const range = this.ranges.get(input_name);
      this.ranges.set(input_name, range ? { minimum: Math.min(range.minimum, value), maximum: Math.max(range.maximum, value) } : { minimum: value, maximum: value });
    }
  }

  /** Null when no face was seen. */
  finish(): ExpressionRanges | null {
    return this.ranges.size === 0 ? null : Object.fromEntries(this.ranges);
  }
}

/**
 * Stretches each calibrated input so the user's own reach lands on the mapping's range. Zero
 * (the relaxed face) stays zero; each side is stretched on its own, since people raise their
 * brows much further than they lower them.
 */
export function apply_expression_ranges(input_values: TrackingInputValues, expression_ranges: ExpressionRanges | null): TrackingInputValues {
  if (!expression_ranges) return input_values;
  const adjusted_values: TrackingInputValues = { ...input_values };
  for (const [input_name, range] of Object.entries(expression_ranges)) {
    const value = input_values[input_name];
    const target = TARGET_RANGES[input_name];
    if (value === undefined || !target) continue;
    if (value > 0 && range.maximum > MINIMUM_REACH) adjusted_values[input_name] = (value / range.maximum) * target.maximum;
    else if (value < 0 && range.minimum < -MINIMUM_REACH && target.minimum < 0) adjusted_values[input_name] = (value / range.minimum) * target.minimum;
  }
  return adjusted_values;
}
