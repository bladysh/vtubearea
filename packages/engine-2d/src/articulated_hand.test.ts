import { describe, expect, it } from "vitest";
import type { ArticulatedHand } from "@vtubearea/model-format";
import { IDENTITY_MATRIX, transform_point } from "./affine_matrix";
import { solve_articulated_hand } from "./articulated_hand";
import type { CanvasPoint } from "./hand_drawing";

/** An upright open hand: wrist at (100, 200), knuckles at y 140, fingers straight up in 20 px segments. */
function hand_points(): CanvasPoint[] {
  const points: CanvasPoint[] = [[100, 200]];
  const finger_x = [60, 80, 100, 120, 140];
  finger_x.forEach((base_x, finger_index) => {
    const base_y = finger_index === 0 ? 170 : 140;
    for (let joint_index = 0; joint_index < 4; joint_index += 1) points.push([base_x, base_y - joint_index * 20]);
  });
  return points;
}

function art_of(points: CanvasPoint[]): ArticulatedHand {
  const part = { texture: "piece.png", rect: { x: 0, y: 0, width: 10, height: 10 } };
  return {
    palm: { ...part, wrist: points[0]!, index_base: points[5]!, pinky_base: points[17]! },
    fingers: [0, 1, 2, 3, 4].map((finger_index) =>
      [0, 1, 2].map((segment_index) => ({ ...part, start: points[1 + finger_index * 4 + segment_index]!, end: points[2 + finger_index * 4 + segment_index]! })),
    ),
  };
}

const keep_side = (point: CanvasPoint) => point;

describe("solve_articulated_hand", () => {
  it("leaves the painted hand where it is when the tracked hand matches it", () => {
    const points = hand_points();
    const pose = solve_articulated_hand(art_of(points), points, keep_side, IDENTITY_MATRIX);
    expect(transform_point(pose.palm, 100, 200)).toEqual([100, 200]);
    const index_tip = transform_point(pose.fingers[1]![2]!, ...points[8]!);
    expect(index_tip[0]).toBeCloseTo(points[8]![0]);
    expect(index_tip[1]).toBeCloseTo(points[8]![1]);
  });

  it("bends a finger at its tracked joints while its base stays on the painted knuckle", () => {
    const points = hand_points();
    const tracked = points.map((point): CanvasPoint => [point[0] + 50, point[1] + 30]);
    // Index tip segment folds 90 degrees to the right.
    tracked[8] = [tracked[7]![0] + 20, tracked[7]![1]];
    const pose = solve_articulated_hand(art_of(points), tracked, keep_side, IDENTITY_MATRIX);
    const knuckle = transform_point(pose.fingers[1]![0]!, ...points[5]!);
    expect(knuckle[0]).toBeCloseTo(130);
    expect(knuckle[1]).toBeCloseTo(170);
    const tip = transform_point(pose.fingers[1]![2]!, ...points[8]!);
    expect(tip[0]).toBeCloseTo(150);
    expect(tip[1]).toBeCloseTo(130);
  });

  it("shortens a segment that points at the camera", () => {
    const points = hand_points();
    const tracked = points.map((point): CanvasPoint => [point[0], point[1]]);
    tracked[8] = [tracked[7]![0], tracked[7]![1] - 6];
    const pose = solve_articulated_hand(art_of(points), tracked, keep_side, IDENTITY_MATRIX);
    const tip = transform_point(pose.fingers[1]![2]!, ...points[8]!);
    expect(points[7]![1] - tip[1]).toBeCloseTo(7, 0);
  });
});
