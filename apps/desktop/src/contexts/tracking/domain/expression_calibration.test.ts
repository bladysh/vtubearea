import { describe, expect, it } from "vitest";
import { apply_expression_ranges, ExpressionRangeRecorder } from "./expression_calibration";

describe("expression calibration", () => {
  it("stretches what the user reaches onto the mapping range, keeping the relaxed face at zero", () => {
    const recorder = new ExpressionRangeRecorder();
    for (const brow of [0, 0.12, -0.05, 0.03]) recorder.add_sample({ BrowLeftY: brow, MouthOpen: brow + 0.05 });
    const ranges = recorder.finish();
    expect(ranges?.BrowLeftY).toEqual({ minimum: -0.05, maximum: 0.12 });
    const adjusted = apply_expression_ranges({ BrowLeftY: 0.12, MouthOpen: 0.17, FaceAngleX: 10 }, ranges);
    expect(adjusted.BrowLeftY).toBeCloseTo(0.3);
    expect(apply_expression_ranges({ BrowLeftY: -0.05 }, ranges).BrowLeftY).toBeCloseTo(-0.25);
    expect(apply_expression_ranges({ BrowLeftY: 0 }, ranges).BrowLeftY).toBe(0);
    expect(adjusted.MouthOpen).toBeCloseTo(0.6);
    expect(adjusted.FaceAngleX).toBe(10);
  });

  it("leaves a side alone that the user barely moved", () => {
    const ranges = { BrowLeftY: { minimum: -0.01, maximum: 0.2 } };
    expect(apply_expression_ranges({ BrowLeftY: -0.01 }, ranges).BrowLeftY).toBe(-0.01);
  });
});
