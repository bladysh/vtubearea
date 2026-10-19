import { describe, expect, it } from "vitest";
import { MetricHistory } from "./metric_history";

describe("MetricHistory", () => {
  it("keeps only the window and thins out samples that come too fast", () => {
    const metric_history = new MetricHistory(1000, 30);
    for (let time_ms = 0; time_ms <= 3000; time_ms += 10) metric_history.record(time_ms, { value: time_ms });
    const samples = metric_history.read();
    expect(samples[0]!.time_ms).toBeGreaterThanOrEqual(2000);
    expect(samples[samples.length - 1]!.values.value).toBeGreaterThanOrEqual(2970);
    expect(samples.length).toBeLessThanOrEqual(35);
  });
});
