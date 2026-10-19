import { describe, expect, it } from "vitest";
import type { PaintedHandPose } from "@vtubearea/model-format";
import { extended_fingers, HandPoseSelector } from "./hand_pose_selector";
import type { FramePoint } from "./hand_placement";

/** A hand pointing up: wrist at the bottom, each finger straight or curled back toward the palm. */
function hand_points(straight_fingers: boolean[]): FramePoint[] {
  const points: FramePoint[] = [[0, 0]];
  const finger_x = [-0.06, -0.03, 0, 0.03, 0.06];
  finger_x.forEach((base_x, finger_index) => {
    const is_straight = straight_fingers[finger_index];
    const base_y = finger_index === 0 ? -0.04 : -0.1;
    // Thumb bends sideways toward the palm center; other fingers fold down.
    const joint_offsets: FramePoint[] = is_straight
      ? [[0, -0.03], [0, -0.06], [0, -0.09]]
      : finger_index === 0
        ? [[0.02, -0.02], [0.045, -0.03], [0.06, -0.035]]
        : [[0, -0.03], [0, -0.01], [0, 0.02]];
    points.push([base_x, base_y], ...joint_offsets.map(([offset_x, offset_y]): FramePoint => [base_x + offset_x, base_y + offset_y]));
  });
  return points;
}

const pose = (id: string, fingers: [boolean, boolean, boolean, boolean, boolean]): PaintedHandPose => ({
  id,
  texture: `${id}.png`,
  rect: { x: 0, y: 0, width: 1, height: 1 },
  wrist: [0, 0],
  index_base: [0, 0],
  pinky_base: [0, 0],
  extended_fingers: fingers,
});

const HAND_POSES = [
  pose("open", [true, true, true, true, true]),
  pose("fist", [false, false, false, false, false]),
  pose("peace", [false, true, true, false, false]),
];

describe("extended_fingers", () => {
  it("tells straight fingers from curled ones", () => {
    expect(extended_fingers(hand_points([true, true, true, true, true]))).toEqual([true, true, true, true, true]);
    expect(extended_fingers(hand_points([false, true, true, false, false]))).toEqual([false, true, true, false, false]);
  });
});

describe("HandPoseSelector", () => {
  it("picks the closest pose and waits a few frames before switching", () => {
    const selector = new HandPoseSelector();
    expect(selector.select(HAND_POSES, hand_points([true, true, true, true, true]))).toBe("open");
    const peace_points = hand_points([false, true, true, false, false]);
    expect(selector.select(HAND_POSES, peace_points)).toBe("open");
    expect(selector.select(HAND_POSES, peace_points)).toBe("open");
    expect(selector.select(HAND_POSES, peace_points)).toBe("peace");
  });
});
