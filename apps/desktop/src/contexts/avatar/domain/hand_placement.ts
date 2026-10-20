import type { ModelHands } from "@vtubearea/model-format";

export type FramePoint = [number, number];

/** The user's face in camera-frame units (see FaceAnchor in the tracking context). */
export interface UserFaceAnchor {
  center: FramePoint;
  height: number;
}

// Used until the face has been seen once: a face roughly centered, 40% of the frame tall.
const FALLBACK_USER_FACE: UserFaceAnchor = { center: [0, -0.05], height: 0.4 };
/** Width of a real face as a share of its height (chin to forehead). */
const REAL_FACE_WIDTH_RATIO = 0.75;
// Wrist and the four finger bases.
const PALM_POINT_INDICES = [0, 5, 9, 13, 17];
// Gap between the two hands (in face heights) below which they count as touching,
// and above which each hand is sized on its own; in between the two blend.
const TOUCHING_GAP_FACE_HEIGHTS = 0.08;
const SEPARATE_GAP_FACE_HEIGHTS = 0.5;

/**
 * Places hand points (camera-frame units) on the model canvas relative to the face:
 * the hand's offset from the user's face, measured in face heights, is applied around
 * the model's face anchor. A hand touching the user's cheek lands on the model's cheek.
 */
export function place_hand_on_canvas(
  frame_points: readonly FramePoint[],
  model_hands: ModelHands,
  user_face: UserFaceAnchor | null,
  model_face_center: FramePoint,
  /** Point the hand is resized around; defaults to its own palm center. */
  scale_pivot: FramePoint = palm_center_of(frame_points),
): FramePoint[] {
  const face = user_face ?? FALLBACK_USER_FACE;
  const face_anchor = model_hands.face_anchor;
  // The hand keeps its shape (one scale, from face heights); only where it sits is measured in
  // face widths sideways, so a wide cartoon head still has the hand beside it, not on it.
  const canvas_per_frame_unit = face_anchor.height / face.height;
  const horizontal_canvas_per_frame_unit = (face_anchor.width ?? face_anchor.height * REAL_FACE_WIDTH_RATIO) / (face.height * REAL_FACE_WIDTH_RATIO);
  const pivot_on_canvas: FramePoint = [
    model_face_center[0] + (scale_pivot[0] - face.center[0]) * horizontal_canvas_per_frame_unit,
    model_face_center[1] + (scale_pivot[1] - face.center[1]) * canvas_per_frame_unit,
  ];
  const hand_size = canvas_per_frame_unit * model_hands.hand_scale;
  return frame_points.map(([frame_x, frame_y]) => [
    pivot_on_canvas[0] + (frame_x - scale_pivot[0]) * hand_size,
    pivot_on_canvas[1] + (frame_y - scale_pivot[1]) * hand_size,
  ]);
}

/**
 * Resize pivots for two hands. Far apart, each hand shrinks around its own palm. Touching,
 * both shrink around one shared point, so fingers that touch in real life still touch on
 * the model (separate pivots would open a gap between them).
 */
export function hand_scale_pivots(
  first_hand: readonly FramePoint[] | null,
  second_hand: readonly FramePoint[] | null,
  user_face: UserFaceAnchor | null,
): [FramePoint | undefined, FramePoint | undefined] {
  if (!first_hand?.length || !second_hand?.length) return [undefined, undefined];
  const face_height = (user_face ?? FALLBACK_USER_FACE).height;
  const first_center = palm_center_of(first_hand);
  const second_center = palm_center_of(second_hand);
  const shared_center: FramePoint = [(first_center[0] + second_center[0]) / 2, (first_center[1] + second_center[1]) / 2];
  const gap_in_face_heights = closest_distance(first_hand, second_hand) / face_height;
  const sharing = 1 - clamp_unit((gap_in_face_heights - TOUCHING_GAP_FACE_HEIGHTS) / (SEPARATE_GAP_FACE_HEIGHTS - TOUCHING_GAP_FACE_HEIGHTS));
  const blend = (own_center: FramePoint): FramePoint => [
    own_center[0] + (shared_center[0] - own_center[0]) * sharing,
    own_center[1] + (shared_center[1] - own_center[1]) * sharing,
  ];
  return [blend(first_center), blend(second_center)];
}

function palm_center_of(frame_points: readonly FramePoint[]): FramePoint {
  return average_point(PALM_POINT_INDICES.map((point_index) => frame_points[point_index]).filter((point) => point !== undefined));
}

function closest_distance(first_points: readonly FramePoint[], second_points: readonly FramePoint[]): number {
  let closest = Infinity;
  for (const first_point of first_points) {
    for (const second_point of second_points) {
      closest = Math.min(closest, Math.hypot(first_point[0] - second_point[0], first_point[1] - second_point[1]));
    }
  }
  return closest;
}

function clamp_unit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function average_point(points: readonly FramePoint[]): FramePoint {
  if (points.length === 0) return [0, 0];
  const sum = points.reduce<FramePoint>((total, point) => [total[0] + point[0], total[1] + point[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}
