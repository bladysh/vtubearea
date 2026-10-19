import { describe, expect, it } from "vitest";
import { estimate_hand_distance_meters, focal_length_pixels } from "./hand_depth";

/** A flat palm facing the camera at the given distance, projected with a pinhole camera. */
function project_palm(distance_meters: number, focal_length: number, tilt_degrees = 0) {
  const world_points: [number, number, number][] = Array.from({ length: 21 }, () => [0, 0, 0]);
  world_points[5] = [-0.03, -0.08, 0];
  world_points[9] = [0, -0.09, 0];
  world_points[17] = [0.035, -0.07, 0];
  const tilt = (tilt_degrees * Math.PI) / 180;
  // Tilting the palm away shrinks its height in the image.
  const image_points = world_points.map(([x, y]) => [(focal_length * x) / distance_meters, (focal_length * y * Math.cos(tilt)) / distance_meters] as [number, number]);
  return { image_points, world_points };
}

describe("estimate_hand_distance_meters", () => {
  const focal_length = focal_length_pixels(720);

  it("recovers the distance of a palm facing the camera", () => {
    const { image_points, world_points } = project_palm(0.45, focal_length);
    expect(estimate_hand_distance_meters(image_points, world_points, focal_length)).toBeCloseTo(0.45, 2);
  });

  it("is not fooled much by a tilted palm, thanks to the knuckle bone", () => {
    const { image_points, world_points } = project_palm(0.45, focal_length, 60);
    expect(estimate_hand_distance_meters(image_points, world_points, focal_length)!).toBeLessThan(0.5);
  });

  it("returns null without usable points", () => {
    expect(estimate_hand_distance_meters([], [], focal_length)).toBeNull();
  });
});

describe("BehindHeadDetector", () => {
  it("switches to behind past the threshold and back only well below it", async () => {
    const { BehindHeadDetector } = await import("./hand_depth");
    const detector = new BehindHeadDetector();
    expect(detector.update(2, 0.1, 6).is_behind).toBe(false);
    for (let step = 0; step < 20; step += 1) detector.update(10, 0.05, 6);
    expect(detector.update(10, 0.05, 6).is_behind).toBe(true);
    // 5 cm is below the threshold but inside the hysteresis band: still behind.
    for (let step = 0; step < 20; step += 1) detector.update(5, 0.05, 6);
    expect(detector.update(5, 0.05, 6).is_behind).toBe(true);
    for (let step = 0; step < 20; step += 1) detector.update(0, 0.05, 6);
    expect(detector.update(0, 0.05, 6).is_behind).toBe(false);
  });
});
