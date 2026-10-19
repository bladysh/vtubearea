import { describe, expect, it } from "vitest";
import type { ModelHands } from "@vtubearea/model-format";
import { hand_scale_pivots, place_hand_on_canvas, type FramePoint } from "./hand_placement";

const model_hands: ModelHands = {
  skin_color: "#ffffff",
  outline_color: "#000000",
  outline_width: 4,
  finger_width_ratio: 0.26,
  hand_scale: 1,
  face_anchor: { center: [500, 400], height: 400 },
};

const hand_at = (x: number, y: number): FramePoint[] => Array.from({ length: 21 }, () => [x, y]);

describe("place_hand_on_canvas", () => {
  it("puts a hand on the user's face center onto the model's face center", () => {
    const user_face = { center: [0.2, -0.1] as FramePoint, height: 0.3 };
    expect(place_hand_on_canvas(hand_at(0.2, -0.1), model_hands, user_face, [500, 400])[0]).toEqual([500, 400]);
  });

  it("keeps the offset in face heights, wherever the user sits and however far away", () => {
    const near_user = { center: [-0.3, 0] as FramePoint, height: 0.5 };
    const far_user = { center: [0.1, 0] as FramePoint, height: 0.25 };
    // Half a face height to the right of the face, for both users.
    const near_point = place_hand_on_canvas(hand_at(-0.05, 0), model_hands, near_user, [500, 400])[0]!;
    const far_point = place_hand_on_canvas(hand_at(0.225, 0), model_hands, far_user, [500, 400])[0]!;
    expect(near_point[0]).toBeCloseTo(700);
    expect(far_point[0]).toBeCloseTo(700);
  });

  it("keeps touching fingertips touching when hands shrink", () => {
    const shrinking_hands = { ...model_hands, hand_scale: 0.5 };
    const user_face = { center: [0, 0] as FramePoint, height: 0.4 };
    // Two hands side by side whose fingertips (point 8) meet at x = 0.
    const left_hand: FramePoint[] = Array.from({ length: 21 }, () => [-0.1, 0]);
    const right_hand: FramePoint[] = Array.from({ length: 21 }, () => [0.1, 0]);
    left_hand[8] = [0, 0];
    right_hand[8] = [0, 0];
    const [left_pivot, right_pivot] = hand_scale_pivots(left_hand, right_hand, user_face);
    const left_tip = place_hand_on_canvas(left_hand, shrinking_hands, user_face, [500, 400], left_pivot)[8]!;
    const right_tip = place_hand_on_canvas(right_hand, shrinking_hands, user_face, [500, 400], right_pivot)[8]!;
    expect(left_tip[0]).toBeCloseTo(right_tip[0]);
  });

  it("sizes far-apart hands around their own palms", () => {
    const user_face = { center: [0, 0] as FramePoint, height: 0.4 };
    const left_hand: FramePoint[] = Array.from({ length: 21 }, () => [-0.5, 0]);
    const right_hand: FramePoint[] = Array.from({ length: 21 }, () => [0.5, 0]);
    const [left_pivot] = hand_scale_pivots(left_hand, right_hand, user_face);
    expect(left_pivot).toEqual([-0.5, 0]);
  });

  it("follows the model's face when the anchor moves", () => {
    const user_face = { center: [0, 0] as FramePoint, height: 0.4 };
    expect(place_hand_on_canvas(hand_at(0, 0), model_hands, user_face, [540, 380])[0]).toEqual([540, 380]);
  });
});
