import type { PaintedArms } from "@vtubearea/model-format";
import type { FramePoint } from "./hand_placement";
import { HandPoseSelector } from "./hand_pose_selector";

/** Wrist, index finger base and pinky base on the model canvas. */
export interface PaintedHandFrame {
  wrist: FramePoint;
  index_base: FramePoint;
  pinky_base: FramePoint;
}

export interface PaintedArmStep {
  hand_frame: PaintedHandFrame;
  /** null = no finger poses painted: draw the tracked hand so every finger follows. */
  pose_id: string | null;
  /** 0 = resting as painted, 1 = following the tracked hand. */
  tracked_weight: number;
  /** The last tracked hand moved to the blended wrist; drawn when pose_id is null. */
  hand_points: FramePoint[];
}

/** Seconds to raise the arm from rest to the tracked hand, and to drop it back when tracking loses the hand. */
const REST_BLEND_SECONDS = 0.3;
const INDEX_FINGER_BASE = 5;
const PINKY_BASE = 17;

/** One painted arm: follows the tracked hand, and eases back into its painted rest pose without it. */
export class PaintedArmMotion {
  private tracked_weight = 0;
  private last_tracked_frame: PaintedHandFrame | null = null;
  /** The pose image or null (drawn hand) while tracked. */
  private last_tracked_pose_id: string | null = null;
  private last_tracked_points: readonly FramePoint[] = [];
  private readonly pose_selector = new HandPoseSelector();

  step(
    arm_art: PaintedArms,
    tracked_points: readonly FramePoint[] | null,
    rest_frame: PaintedHandFrame,
    delta_seconds: number,
    /** Draw the tracked hand even if the model has painted finger poses. */
    prefers_drawn_hand = false,
  ): PaintedArmStep {
    if (tracked_points && tracked_points.length >= 21) {
      this.last_tracked_points = tracked_points;
      this.last_tracked_frame = { wrist: tracked_points[0]!, index_base: tracked_points[INDEX_FINGER_BASE]!, pinky_base: tracked_points[PINKY_BASE]! };
      const has_finger_poses = arm_art.hand_poses.some((hand_pose) => hand_pose.extended_fingers);
      this.last_tracked_pose_id = has_finger_poses && !prefers_drawn_hand ? this.pose_selector.select(arm_art.hand_poses, tracked_points) : null;
    }
    const weight_step = delta_seconds / REST_BLEND_SECONDS;
    this.tracked_weight = Math.min(1, Math.max(0, this.tracked_weight + (tracked_points ? weight_step : -weight_step)));
    if (!this.last_tracked_frame || this.tracked_weight === 0) {
      return { hand_frame: rest_frame, pose_id: arm_art.rest_hand_pose_id, tracked_weight: 0, hand_points: [] };
    }
    const eased_weight = this.tracked_weight * this.tracked_weight * (3 - 2 * this.tracked_weight);
    const blend = (rest_point: FramePoint, tracked_point: FramePoint): FramePoint => [
      rest_point[0] + (tracked_point[0] - rest_point[0]) * eased_weight,
      rest_point[1] + (tracked_point[1] - rest_point[1]) * eased_weight,
    ];
    const tracked_frame = this.last_tracked_frame;
    const wrist = blend(rest_frame.wrist, tracked_frame.wrist);
    const [shift_x, shift_y] = [wrist[0] - tracked_frame.wrist[0], wrist[1] - tracked_frame.wrist[1]];
    return {
      hand_frame: {
        wrist,
        index_base: blend(rest_frame.index_base, tracked_frame.index_base),
        pinky_base: blend(rest_frame.pinky_base, tracked_frame.pinky_base),
      },
      // The image swaps halfway, while the hand is moving and the swap is least visible.
      pose_id: eased_weight > 0.5 ? this.last_tracked_pose_id : arm_art.rest_hand_pose_id,
      tracked_weight: eased_weight,
      hand_points: this.last_tracked_points.map(([point_x, point_y]): FramePoint => [point_x + shift_x, point_y + shift_y]),
    };
  }
}
