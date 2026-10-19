/**
 * One Euro filter (Casiez et al. 2012): strong smoothing when the value is still,
 * little lag when it moves fast. Works on one channel; timestamps in seconds.
 */
export class OneEuroFilter {
  private previous_value: number | null = null;
  private previous_derivative = 0;
  private previous_time_seconds = 0;

  constructor(
    public minimum_cutoff_hertz: number,
    public speed_coefficient: number,
    private readonly derivative_cutoff_hertz = 1,
  ) {}

  filter(value: number, time_seconds: number): number {
    if (this.previous_value === null) {
      this.previous_value = value;
      this.previous_time_seconds = time_seconds;
      return value;
    }
    const elapsed_seconds = Math.max(time_seconds - this.previous_time_seconds, 1e-4);
    const derivative = (value - this.previous_value) / elapsed_seconds;
    const smoothed_derivative = blend(
      this.previous_derivative,
      derivative,
      smoothing_factor(elapsed_seconds, this.derivative_cutoff_hertz),
    );
    const cutoff_hertz = this.minimum_cutoff_hertz + this.speed_coefficient * Math.abs(smoothed_derivative);
    const smoothed_value = blend(this.previous_value, value, smoothing_factor(elapsed_seconds, cutoff_hertz));

    this.previous_value = smoothed_value;
    this.previous_derivative = smoothed_derivative;
    this.previous_time_seconds = time_seconds;
    return smoothed_value;
  }

  reset(): void {
    this.previous_value = null;
    this.previous_derivative = 0;
  }
}

function smoothing_factor(elapsed_seconds: number, cutoff_hertz: number): number {
  const time_constant = 1 / (2 * Math.PI * cutoff_hertz);
  return 1 / (1 + time_constant / elapsed_seconds);
}

function blend(previous_value: number, next_value: number, factor: number): number {
  return previous_value + factor * (next_value - previous_value);
}

/** Maps the single "responsive (0) <-> smooth (1)" slider to filter settings for values around -1..1. */
export function filter_settings_for_smoothness(smoothness: number) {
  const clamped_smoothness = Math.min(1, Math.max(0, smoothness));
  return {
    minimum_cutoff_hertz: 3 - 2.6 * clamped_smoothness,
    speed_coefficient: 1 - 0.95 * clamped_smoothness,
  };
}
