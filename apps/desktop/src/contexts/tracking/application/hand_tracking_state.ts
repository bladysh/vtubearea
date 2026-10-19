import type { FaceFrame } from "@vtubearea/protocol";
import { face_anchor_from_head_position, type FaceAnchor } from "../domain/face_anchor";
import { BehindHeadDetector } from "../domain/hand_depth";
import { derive_hand_side_inputs, hands_by_avatar_side, type AvatarSide } from "../domain/hand_inputs";
import { HandSkeletonSmoother, to_view_space_points, type TrackedHandSkeleton } from "../domain/hand_skeleton";
import { filter_settings_for_smoothness } from "../domain/one_euro_filter";
import type { TrackingInputValues } from "../domain/tracking_inputs";
import type { TrackingSettings } from "../domain/tracking_settings";

const METERS_TO_CENTIMETERS = 100;

type HandSettings = Pick<TrackingSettings, "is_hand_mirrored" | "is_hand_depth_enabled" | "hand_behind_head_threshold_centimeters">;

const AVATAR_SIDES: readonly AvatarSide[] = ["Left", "Right"];
// Fingers move fast; filter them more responsively than the head.
const HAND_RESPONSIVENESS = 2;

interface SideState {
  inputs: TrackingInputValues;
  skeleton: TrackedHandSkeleton | null;
  last_seen_ms: number;
  smoother: HandSkeletonSmoother;
  behind_head_detector: BehindHeadDetector;
}

/**
 * Hand part of the tracking hub: per avatar side inputs (for parameter-driven hand art)
 * and smoothed 21-point skeletons (for drawn hands). A hand missed for a few frames
 * keeps its last pose until the hold time runs out.
 */
export class HandTrackingState {
  private readonly sides: Record<AvatarSide, SideState>;
  /** Last known camera-to-face distance; kept while a hand hides the face. */
  private head_distance_meters: number | null = null;
  /** Last known face position in the picture; hands are placed relative to it. */
  private face_anchor: FaceAnchor | null = null;
  private last_frame_ms: number | null = null;

  constructor(private readonly hand_lost_timeout_ms: number) {
    const create_side = (): SideState => ({
      inputs: {},
      skeleton: null,
      last_seen_ms: Number.NEGATIVE_INFINITY,
      smoother: new HandSkeletonSmoother(1, 1),
      behind_head_detector: new BehindHeadDetector(),
    });
    this.sides = { Left: create_side(), Right: create_side() };
  }

  update_smoothness(smoothness: number): void {
    const filter_settings = filter_settings_for_smoothness(smoothness);
    for (const side of AVATAR_SIDES) {
      this.sides[side].smoother.update_settings(
        filter_settings.minimum_cutoff_hertz * HAND_RESPONSIVENESS,
        filter_settings.speed_coefficient * HAND_RESPONSIVENESS,
      );
    }
  }

  push_frame(face_frame: FaceFrame, arrival_ms: number, hand_settings: HandSettings): void {
    const delta_seconds = this.last_frame_ms === null ? 0 : (arrival_ms - this.last_frame_ms) / 1000;
    this.last_frame_ms = arrival_ms;
    // MediaPipe's camera looks down -z, so the face distance is -z.
    if (face_frame.face_found) {
      this.head_distance_meters = -face_frame.head.position_meters[2];
      // Same mirroring as the hands, so hand positions relative to the face stay right.
      this.face_anchor = face_anchor_from_head_position(face_frame.head.position_meters, hand_settings.is_hand_mirrored) ?? this.face_anchor;
    }
    if (!face_frame.hands) return;
    const is_mirrored = hand_settings.is_hand_mirrored;
    const hand_by_side = hands_by_avatar_side(face_frame.hands, is_mirrored);
    for (const side of AVATAR_SIDES) {
      const side_state = this.sides[side];
      const hand_pose = hand_by_side[side];
      if (hand_pose) {
        const depth = this.behind_head_state(side_state, hand_pose.distance_meters, delta_seconds, hand_settings);
        side_state.inputs = { ...derive_hand_side_inputs(hand_pose, side, is_mirrored), ...(depth.offset_centimeters !== null && { [`Hand${side}DepthOffset`]: depth.offset_centimeters }) };
        const view_points = to_view_space_points(hand_pose, face_frame.hands.image_aspect_ratio, is_mirrored);
        if (!side_state.skeleton?.is_present) side_state.smoother.reset();
        side_state.skeleton = { points: side_state.smoother.smooth(view_points, arrival_ms / 1000), is_present: true, is_behind_head: depth.is_behind };
        side_state.last_seen_ms = arrival_ms;
      } else if (arrival_ms - side_state.last_seen_ms > this.hand_lost_timeout_ms) {
        side_state.inputs = { ...side_state.inputs, [`Hand${side}Found`]: 0 };
        if (side_state.skeleton) side_state.skeleton = { ...side_state.skeleton, is_present: false };
      }
    }
  }

  /** Hand-to-face distance difference (cm, positive = behind) and the stable behind/in front decision. */
  private behind_head_state(
    side_state: SideState,
    hand_distance_meters: number | undefined,
    delta_seconds: number,
    hand_settings: HandSettings,
  ): { offset_centimeters: number | null; is_behind: boolean } {
    if (!hand_settings.is_hand_depth_enabled || hand_distance_meters === undefined || this.head_distance_meters === null) {
      side_state.behind_head_detector.reset();
      return { offset_centimeters: null, is_behind: false };
    }
    const offset_centimeters = (hand_distance_meters - this.head_distance_meters) * METERS_TO_CENTIMETERS;
    return side_state.behind_head_detector.update(offset_centimeters, delta_seconds, hand_settings.hand_behind_head_threshold_centimeters);
  }

  input_values(): TrackingInputValues {
    return { ...this.sides.Left.inputs, ...this.sides.Right.inputs };
  }

  current_face_anchor(): FaceAnchor | null {
    return this.face_anchor;
  }

  skeletons(): Record<AvatarSide, TrackedHandSkeleton | null> {
    return { Left: this.sides.Left.skeleton, Right: this.sides.Right.skeleton };
  }
}
