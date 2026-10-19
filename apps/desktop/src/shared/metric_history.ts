export interface MetricSample {
  time_ms: number;
  values: Readonly<Record<string, number>>;
}

/**
 * Rolling window of recent values for live charts. Samples closer together than
 * minimum_interval_ms are dropped, so recording every render frame stays cheap.
 */
export class MetricHistory {
  private samples: MetricSample[] = [];

  constructor(
    private readonly window_ms: number,
    private readonly minimum_interval_ms = 33,
  ) {}

  record(time_ms: number, values: Readonly<Record<string, number>>): void {
    const last_sample = this.samples[this.samples.length - 1];
    if (last_sample && time_ms - last_sample.time_ms < this.minimum_interval_ms) return;
    this.samples.push({ time_ms, values: { ...values } });
    const oldest_kept_ms = time_ms - this.window_ms;
    const first_kept_index = this.samples.findIndex((sample) => sample.time_ms >= oldest_kept_ms);
    if (first_kept_index > 0) this.samples.splice(0, first_kept_index);
  }

  /** Oldest first. The array is shared; callers must not change it. */
  read(): readonly MetricSample[] {
    return this.samples;
  }
}
