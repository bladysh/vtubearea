import { describe, expect, it } from "vitest";
import { AdaptiveRange } from "./adaptive_range";

describe("AdaptiveRange", () => {
  it("turns a weak blink into a fully closed eye", () => {
    const eye_range = new AdaptiveRange(0.25, 0.05);
    for (let frame_index = 0; frame_index < 30; frame_index += 1) eye_range.normalize(0.95, 1 / 30);
    // This person's closed eye only reaches 0.5, which must still read as shut.
    expect(eye_range.normalize(0.5, 1 / 30)).toBeCloseTo(0);
    expect(eye_range.normalize(0.95, 1 / 30)).toBeCloseTo(1);
    expect(eye_range.normalize(0.725, 1 / 30)).toBeCloseTo(0.5, 1);
  });

  it("does not amplify noise on a steady open eye", () => {
    const eye_range = new AdaptiveRange(0.25, 0.05);
    eye_range.normalize(0.9, 1 / 30);
    expect(eye_range.normalize(0.88, 1 / 30)).toBeGreaterThan(0.85);
  });

  it("forgets an outlier after a while", () => {
    const eye_range = new AdaptiveRange(0.25, 0.1);
    eye_range.normalize(0.9, 0);
    eye_range.normalize(0.05, 0);
    for (let frame_index = 0; frame_index < 300; frame_index += 1) eye_range.normalize(0.9, 1 / 30);
    // Ten seconds later the old 0.05 no longer counts; a half-closed 0.6 is fairly closed again.
    expect(eye_range.normalize(0.6, 1 / 30)).toBeLessThan(0.1);
  });
});
