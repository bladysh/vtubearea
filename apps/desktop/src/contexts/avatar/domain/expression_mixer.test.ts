import { describe, expect, it } from "vitest";
import type { ModelExpression } from "@vtubearea/model-format";
import { ExpressionMixer } from "./expression_mixer";

const happy: ModelExpression = { id: "happy", display_name: "Happy", parameter_values: { ParamMouthForm: 1 }, fade_seconds: 0.2 };

function run(mixer: ExpressionMixer, seconds: number): number {
  let parameter_values: Record<string, number> = {};
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) {
    parameter_values = { ParamMouthForm: 0 };
    mixer.apply(parameter_values, 0.05);
  }
  return parameter_values.ParamMouthForm ?? 0;
}

describe("ExpressionMixer", () => {
  it("plays once by default and ends by itself", () => {
    const mixer = new ExpressionMixer();
    mixer.activate(happy);
    expect(run(mixer, 0.5)).toBeCloseTo(1);
    expect(mixer.active_expression_id).toBe("happy");
    expect(run(mixer, 2)).toBeCloseTo(0);
    expect(mixer.active_expression_id).toBeNull();
  });

  it("holds until switched off", () => {
    const mixer = new ExpressionMixer();
    mixer.activate(happy, { mode: "hold", hold_seconds: 1, repeat_count: 0 });
    expect(run(mixer, 5)).toBeCloseTo(1);
    mixer.activate(null);
    expect(run(mixer, 0.5)).toBeCloseTo(0);
    expect(mixer.active_expression_id).toBeNull();
  });

  it("loops until switched off", () => {
    const mixer = new ExpressionMixer();
    mixer.activate(happy, { mode: "loop", hold_seconds: 0.5, repeat_count: 0 });
    const seen_values = Array.from({ length: 40 }, () => run(mixer, 0.1));
    expect(Math.max(...seen_values)).toBeCloseTo(1);
    expect(Math.min(...seen_values.slice(10))).toBeLessThan(0.05);
    // It comes back after fading out.
    expect(seen_values.slice(20).some((value) => value > 0.9)).toBe(true);
    expect(mixer.active_expression_id).toBe("happy");
  });

  it("stops a loop after its repeat count", () => {
    const mixer = new ExpressionMixer();
    mixer.activate(happy, { mode: "loop", hold_seconds: 0.3, repeat_count: 2 });
    let peaks = 0;
    let was_high = false;
    for (let step = 0; step < 100; step += 1) {
      const value = run(mixer, 0.05);
      if (value > 0.9 && !was_high) peaks += 1;
      was_high = value > 0.9;
    }
    expect(peaks).toBe(2);
    expect(mixer.active_expression_id).toBeNull();
  });
});
