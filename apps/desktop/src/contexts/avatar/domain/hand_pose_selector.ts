import type { PaintedHandPose } from "@vtubearea/model-format";
import type { FramePoint } from "./hand_placement";

export type ExtendedFingers = [boolean, boolean, boolean, boolean, boolean];

const WRIST = 0;
const MIDDLE_FINGER_BASE = 9;
const THUMB_MIDDLE_JOINT = 3;
const THUMB_TIP = 4;
/** Middle joint and tip of the index, middle, ring and pinky fingers (MediaPipe order). */
const FINGER_JOINTS: readonly [number, number][] = [
  [6, 8],
  [10, 12],
  [14, 16],
  [18, 20],
];
// A straight finger's tip is clearly farther from the wrist than its middle joint; a curled one is not.
const STRAIGHT_FINGER_RATIO = 1.1;
/** Frames a new pose must win in a row before it is shown, so noise does not flicker the image. */
const POSE_CONFIRMATION_FRAMES = 3;

export function extended_fingers(points: readonly FramePoint[]): ExtendedFingers {
  const distance = (first_index: number, second_index: number) =>
    Math.hypot(points[first_index]![0] - points[second_index]![0], points[first_index]![1] - points[second_index]![1]);
  // A tucked thumb tip comes closer to the palm center than its own middle joint.
  const is_thumb_extended = distance(THUMB_TIP, MIDDLE_FINGER_BASE) > distance(THUMB_MIDDLE_JOINT, MIDDLE_FINGER_BASE) * STRAIGHT_FINGER_RATIO;
  const [index, middle, ring, pinky] = FINGER_JOINTS.map(
    ([middle_joint, tip]) => distance(tip, WRIST) > distance(middle_joint, WRIST) * STRAIGHT_FINGER_RATIO,
  ) as [boolean, boolean, boolean, boolean];
  return [is_thumb_extended, index, middle, ring, pinky];
}

/** Picks the painted hand pose closest to the tracked fingers, holding it steady against noise. */
export class HandPoseSelector {
  private shown_pose_id: string | null = null;
  private candidate_pose_id: string | null = null;
  private candidate_frames = 0;

  select(hand_poses: readonly PaintedHandPose[], points: readonly FramePoint[]): string | null {
    if (points.length < 21) return this.shown_pose_id;
    const fingers = extended_fingers(points);
    let best_pose_id: string | null = null;
    let best_mismatches = Infinity;
    for (const hand_pose of hand_poses) {
      if (!hand_pose.extended_fingers) continue;
      const mismatches = hand_pose.extended_fingers.filter((is_extended, finger_index) => is_extended !== fingers[finger_index]).length;
      if (mismatches < best_mismatches) [best_pose_id, best_mismatches] = [hand_pose.id, mismatches];
    }
    if (best_pose_id === this.shown_pose_id || this.shown_pose_id === null) {
      this.shown_pose_id = best_pose_id;
      this.candidate_frames = 0;
    } else if (best_pose_id === this.candidate_pose_id && ++this.candidate_frames >= POSE_CONFIRMATION_FRAMES) {
      this.shown_pose_id = best_pose_id;
      this.candidate_frames = 0;
    } else if (best_pose_id !== this.candidate_pose_id) {
      this.candidate_pose_id = best_pose_id;
      this.candidate_frames = 1;
    }
    return this.shown_pose_id;
  }
}
