const BLINK_DURATION_SECONDS = 0.16;

/** Random natural blinking for when the camera cannot see the eyes. */
export class AutoBlink {
  private seconds_until_blink: number;
  private blink_elapsed_seconds: number | null = null;

  constructor(
    private readonly minimum_interval_seconds: number,
    private readonly maximum_interval_seconds: number,
    private readonly random_unit: () => number = Math.random,
  ) {
    this.seconds_until_blink = this.next_interval();
  }

  /** Returns how closed the eyes are: 0 = open, 1 = shut. */
  step(delta_seconds: number): number {
    if (this.blink_elapsed_seconds === null) {
      this.seconds_until_blink -= delta_seconds;
      if (this.seconds_until_blink > 0) return 0;
      this.blink_elapsed_seconds = 0;
    }
    this.blink_elapsed_seconds += delta_seconds;
    const blink_progress = this.blink_elapsed_seconds / BLINK_DURATION_SECONDS;
    if (blink_progress >= 1) {
      this.blink_elapsed_seconds = null;
      this.seconds_until_blink = this.next_interval();
      return 0;
    }
    return Math.sin(blink_progress * Math.PI);
  }

  private next_interval(): number {
    const interval_span = this.maximum_interval_seconds - this.minimum_interval_seconds;
    return this.minimum_interval_seconds + this.random_unit() * interval_span;
  }
}

/** 0..1 breathing wave. */
export function breathing_value(elapsed_seconds: number, period_seconds: number): number {
  return (Math.sin((elapsed_seconds / period_seconds) * 2 * Math.PI) + 1) / 2;
}
