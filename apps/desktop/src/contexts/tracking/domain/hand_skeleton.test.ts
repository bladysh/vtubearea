import { describe, expect, it } from "vitest";
import { to_view_space_points } from "./hand_skeleton";

const single_point_hand = (x: number, y: number) => ({
  landmarks: Array.from({ length: 21 }, () => [x, y, 0] as [number, number, number]),
});

describe("to_view_space_points", () => {
  it("centers on the frame and keeps proportions", () => {
    const [point] = to_view_space_points(single_point_hand(1, 0), 16 / 9, false);
    expect(point![0]).toBeCloseTo(8 / 9);
    expect(point![1]).toBeCloseTo(-0.5);
  });

  it("mirrors horizontally", () => {
    const [point] = to_view_space_points(single_point_hand(0.75, 0.5), 1, true);
    expect(point![0]).toBeCloseTo(-0.25);
  });
});
