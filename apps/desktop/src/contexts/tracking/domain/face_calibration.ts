import { tracking_input_behavior, type TrackingInputValues } from "./tracking_inputs";

/** The user's relaxed face, captured by "Calibrate". Inputs are corrected relative to it. */
export type NeutralFace = Readonly<Record<string, number>>;

export class NeutralFaceRecorder {
  private readonly sums = new Map<string, number>();
  private sample_count = 0;

  add_sample(input_values: TrackingInputValues): void {
    for (const [input_name, value] of Object.entries(input_values)) {
      this.sums.set(input_name, (this.sums.get(input_name) ?? 0) + value);
    }
    this.sample_count += 1;
  }

  /** Returns null when no face was seen during calibration. */
  finish(): NeutralFace | null {
    if (this.sample_count === 0) return null;
    return Object.fromEntries([...this.sums].map(([input_name, sum]) => [input_name, sum / this.sample_count]));
  }
}

export function apply_neutral_face(input_values: TrackingInputValues, neutral_face: NeutralFace | null): TrackingInputValues {
  if (!neutral_face) return input_values;
  const calibrated_values: TrackingInputValues = {};
  for (const [input_name, value] of Object.entries(input_values)) {
    const behavior = tracking_input_behavior(input_name);
    const neutral_measurement = neutral_face[input_name];
    if (neutral_measurement === undefined || behavior.calibration === "none") {
      calibrated_values[input_name] = value;
    } else if (behavior.calibration === "offset") {
      calibrated_values[input_name] = value - neutral_measurement + behavior.neutral_value;
    } else {
      // A relaxed eye that measured 0.8 open should read as fully open.
      calibrated_values[input_name] = neutral_measurement > 0.05 ? (value / neutral_measurement) * behavior.neutral_value : value;
    }
  }
  return calibrated_values;
}
