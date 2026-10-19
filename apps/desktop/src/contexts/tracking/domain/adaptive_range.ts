/**
 * Learns the range a signal really uses and maps it to 0..1. Used for eye openness:
 * MediaPipe may report a shut eye as 0.4 for one person and 0.1 for another, so a
 * fixed threshold never fully closes the avatar's eyes for everyone.
 *
 * The extremes slowly drift toward the current value, so one odd frame is forgotten
 * after a few seconds, while regular blinks keep the closed end fresh.
 */
export class AdaptiveRange {
  private lowest_value: number | null = null;
  private highest_value: number | null = null;

  constructor(
    /** Never stretch less than this, so noise on a still eye is not amplified into a blink. */
    private readonly minimum_span: number,
    /** How fast the remembered extremes drift back toward the current value, per second. */
    private readonly drift_per_second: number,
  ) {}

  normalize(value: number, delta_seconds: number): number {
    const drift = this.drift_per_second * Math.max(0, delta_seconds);
    this.lowest_value = this.lowest_value === null ? value : Math.min(value, this.lowest_value + drift);
    this.highest_value = this.highest_value === null ? value : Math.max(value, this.highest_value - drift);
    const span = Math.max(this.highest_value - this.lowest_value, this.minimum_span);
    const range_start = this.highest_value - span;
    return Math.min(1, Math.max(0, (value - range_start) / span));
  }

  reset(): void {
    this.lowest_value = null;
    this.highest_value = null;
  }
}
