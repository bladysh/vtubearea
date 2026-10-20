import type { ArticulatedHand } from "@vtubearea/model-format";
import { IDENTITY_MATRIX, multiply_matrices, transform_point, type AffineMatrix } from "./affine_matrix";
import type { CanvasPoint } from "./hand_drawing";
import { bone_matrix, hand_pose_matrix, thumb_side_of, type HandFrame } from "./painted_arm";

/** Tracked joints of each finger (MediaPipe order), base to tip. */
const FINGER_JOINTS: readonly (readonly [number, number, number, number])[] = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];
/** A finger segment may look this much shorter (pointing at the camera) or longer than painted. */
const SEGMENT_SCALE_RANGE: readonly [number, number] = [0.35, 1.15];

export interface ArticulatedHandPose {
  palm: AffineMatrix;
  /** [finger][segment], same order as the art. */
  fingers: AffineMatrix[][];
}

/**
 * Places a painted hand on tracked points. The palm keeps its painted size and turns like the
 * tracked hand; each finger is a chain that starts at the painted palm's knuckle and runs along
 * the tracked finger, so fingers bend one by one yet never come off the palm. A segment pointing
 * at the camera looks shorter, the same share shorter as the tracked one.
 *
 * `to_side` / `side_matrix` turn the painted right hand into the left one (identity for the right).
 */
export function solve_articulated_hand(
  hand: ArticulatedHand,
  tracked_points: readonly CanvasPoint[],
  to_side: (point: CanvasPoint) => CanvasPoint,
  side_matrix: AffineMatrix,
): ArticulatedHandPose {
  const rest_frame: HandFrame = { wrist: to_side(hand.palm.wrist), index_base: to_side(hand.palm.index_base), pinky_base: to_side(hand.palm.pinky_base) };
  const tracked_frame: HandFrame = { wrist: tracked_points[0]!, index_base: tracked_points[5]!, pinky_base: tracked_points[17]! };
  const palm_turn = hand_pose_matrix(rest_frame, tracked_frame);
  const is_flipped = thumb_side_of(rest_frame) !== thumb_side_of(tracked_frame);
  const rest_palm_length = palm_length_of(rest_frame);
  const tracked_palm_length = palm_length_of(tracked_frame);

  const fingers = hand.fingers.map((finger_bones, finger_index) => {
    const joint_indices = FINGER_JOINTS[finger_index]!;
    let segment_start = transform_point(palm_turn, ...to_side(finger_bones[0]!.start));
    return finger_bones.map((finger_bone, segment_index) => {
      const rest_start = to_side(finger_bone.start);
      const rest_end = to_side(finger_bone.end);
      const tracked_start = tracked_points[joint_indices[segment_index]!]!;
      const tracked_end = tracked_points[joint_indices[segment_index + 1]!]!;
      const tracked_length = distance(tracked_start, tracked_end);
      const rest_length = distance(rest_start, rest_end);
      // Compare lengths relative to each palm, so hand size and camera distance cancel out.
      const scale = clamp(
        tracked_length / Math.max(tracked_palm_length, 1e-6) / Math.max(rest_length / Math.max(rest_palm_length, 1e-6), 1e-6),
        ...SEGMENT_SCALE_RANGE,
      );
      const direction = tracked_length > 1e-6 ? [(tracked_end[0] - tracked_start[0]) / tracked_length, (tracked_end[1] - tracked_start[1]) / tracked_length] : [0, -1];
      const segment_end: CanvasPoint = [segment_start[0] + direction[0]! * rest_length * scale, segment_start[1] + direction[1]! * rest_length * scale];
      // Showing the other side of the hand mirrors each piece along its own length, like the palm.
      const flip = is_flipped ? reflection_across(rest_start, rest_end) : IDENTITY_MATRIX;
      const matrix = multiply_matrices(multiply_matrices(bone_matrix(rest_start, rest_end, segment_start, segment_end), flip), side_matrix);
      segment_start = segment_end;
      return matrix;
    });
  });
  return { palm: multiply_matrices(palm_turn, side_matrix), fingers };
}

function palm_length_of(frame: HandFrame): number {
  return distance(frame.wrist, [(frame.index_base[0] + frame.pinky_base[0]) / 2, (frame.index_base[1] + frame.pinky_base[1]) / 2]);
}

/** Mirror across the line through start and end. */
function reflection_across(start: CanvasPoint, end: CanvasPoint): AffineMatrix {
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const [cosine, sine] = [Math.cos(2 * angle), Math.sin(2 * angle)];
  return {
    a: cosine,
    b: sine,
    c: sine,
    d: -cosine,
    tx: start[0] - (cosine * start[0] + sine * start[1]),
    ty: start[1] - (sine * start[0] - cosine * start[1]),
  };
}

function distance(first_point: CanvasPoint, second_point: CanvasPoint): number {
  return Math.hypot(second_point[0] - first_point[0], second_point[1] - first_point[1]);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
