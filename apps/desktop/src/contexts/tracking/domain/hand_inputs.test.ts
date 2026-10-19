import { describe, expect, it } from "vitest";
import type { HandPose } from "@vtubearea/protocol";
import { derive_hand_side_inputs, hands_by_avatar_side } from "./hand_inputs";

type Point = [number, number, number];

/** A hand at (center_x, center_y) with fingers reaching tip_reach palm-lengths from the wrist. */
function build_hand(center_x: number, center_y: number, tip_reach: number): HandPose {
  const palm_size = 0.1;
  const landmarks: Point[] = Array.from({ length: 21 }, () => [center_x, center_y, 0]);
  landmarks[0] = [center_x, center_y + palm_size / 2, 0];
  landmarks[5] = [center_x - 0.03, center_y - palm_size / 4, 0];
  landmarks[9] = [center_x, center_y - palm_size / 2, 0];
  landmarks[17] = [center_x + 0.03, center_y - palm_size / 4, 0];
  for (const tip_index of [8, 12, 16, 20]) landmarks[tip_index] = [center_x, center_y + palm_size / 2 - palm_size * tip_reach, 0];
  return { landmarks };
}

describe("derive_hand_side_inputs", () => {
  it("measures an open hand as open and a fist as closed", () => {
    expect(derive_hand_side_inputs(build_hand(0.5, 0.5, 2), "Left", false).HandLeftOpen).toBeCloseTo(1);
    expect(derive_hand_side_inputs(build_hand(0.5, 0.5, 1), "Left", false).HandLeftOpen).toBe(0);
  });

  it("flips horizontal position in mirror mode and points y up", () => {
    const hand_in_top_left_of_camera = build_hand(0.2, 0.2, 2);
    const mirrored_inputs = derive_hand_side_inputs(hand_in_top_left_of_camera, "Right", true);
    expect(mirrored_inputs.HandRightPositionX).toBeGreaterThan(0.5);
    expect(mirrored_inputs.HandRightPositionY).toBeGreaterThan(0.5);
    expect(mirrored_inputs.HandRightFound).toBe(1);
  });
});

describe("hands_by_avatar_side", () => {
  it("swaps sides in mirror mode", () => {
    const left_hand = build_hand(0.2, 0.5, 2);
    expect(hands_by_avatar_side({ left: left_hand, right: null, image_aspect_ratio: 4 / 3 }, true).Right).toBe(left_hand);
    expect(hands_by_avatar_side({ left: left_hand, right: null, image_aspect_ratio: 4 / 3 }, false).Left).toBe(left_hand);
  });
});
