import type { HandPose, HandPoses } from "@vtubearea/protocol";

export const HAND_TRACKING_INPUT_NAMES = [
  "HandLeftFound",
  "HandLeftPositionX",
  "HandLeftPositionY",
  "HandLeftOpen",
  "HandRightFound",
  "HandRightPositionX",
  "HandRightPositionY",
  "HandRightOpen",
] as const;

export type HandTrackingInputName = (typeof HAND_TRACKING_INPUT_NAMES)[number];
export type AvatarSide = "Left" | "Right";

// MediaPipe hand landmark indices.
const WRIST = 0;
const INDEX_FINGER_BASE = 5;
const MIDDLE_FINGER_BASE = 9;
const PINKY_BASE = 17;
const FINGER_TIPS = [8, 12, 16, 20];
// Tip distance / palm size: about 1.0 for a fist, about 2.0 for a flat open hand.
const FIST_RATIO = 1.1;
const OPEN_RATIO = 1.9;

/**
 * Hand inputs for one avatar side. Positions are -1..1 in the picture the user
 * sees: x positive = right of screen, y positive = up.
 */
export function derive_hand_side_inputs(hand_pose: HandPose, side: AvatarSide, is_mirrored: boolean): Record<string, number> {
  const landmarks = hand_pose.landmarks;
  const palm_points = [landmarks[WRIST]!, landmarks[INDEX_FINGER_BASE]!, landmarks[PINKY_BASE]!];
  const palm_center_x = palm_points.reduce((sum, point) => sum + point[0], 0) / palm_points.length;
  const palm_center_y = palm_points.reduce((sum, point) => sum + point[1], 0) / palm_points.length;

  const palm_size = distance_2d(landmarks[WRIST]!, landmarks[MIDDLE_FINGER_BASE]!);
  const average_tip_distance =
    FINGER_TIPS.reduce((sum, tip_index) => sum + distance_2d(landmarks[WRIST]!, landmarks[tip_index]!), 0) / FINGER_TIPS.length;
  const openness_ratio = palm_size > 1e-4 ? average_tip_distance / palm_size : FIST_RATIO;

  const centered_x = (palm_center_x - 0.5) * 2;
  return {
    [`Hand${side}Found`]: 1,
    [`Hand${side}PositionX`]: is_mirrored ? -centered_x : centered_x,
    [`Hand${side}PositionY`]: (0.5 - palm_center_y) * 2,
    [`Hand${side}Open`]: clamp_unit((openness_ratio - FIST_RATIO) / (OPEN_RATIO - FIST_RATIO)),
  };
}

/**
 * Picks which real hand drives which avatar side. Mirrored: the user's right hand
 * is the avatar's left (it shows on the same screen side as in a mirror).
 */
export function hands_by_avatar_side(hands: HandPoses, is_mirrored: boolean): Record<AvatarSide, HandPose | null> {
  return is_mirrored ? { Left: hands.right, Right: hands.left } : { Left: hands.left, Right: hands.right };
}

function distance_2d(first_point: readonly number[], second_point: readonly number[]): number {
  return Math.hypot((first_point[0] ?? 0) - (second_point[0] ?? 0), (first_point[1] ?? 0) - (second_point[1] ?? 0));
}

function clamp_unit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
