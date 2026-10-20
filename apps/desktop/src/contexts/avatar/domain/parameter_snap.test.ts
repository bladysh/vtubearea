import { describe, expect, it } from "vitest";
import { ParameterSnapper } from "./parameter_snap";

const steps = { values: [0, 0.5, 1], hysteresis: 0.05 };

describe("ParameterSnapper", () => {
  it("holds a step while the input jitters around a boundary", () => {
    const snapper = new ParameterSnapper();
    expect(snapper.snap("eye", 0.7, steps)).toBe(0.5);
    for (const jitter of [0.76, 0.74, 0.78, 0.73]) expect(snapper.snap("eye", jitter, steps)).toBe(0.5);
    expect(snapper.snap("eye", 0.81, steps)).toBe(1);
    expect(snapper.snap("eye", 0.72, steps)).toBe(1);
  });

  it("still jumps straight to closed on a fast blink", () => {
    const snapper = new ParameterSnapper();
    snapper.snap("eye", 1, steps);
    expect(snapper.snap("eye", 0, steps)).toBe(0);
  });
});
