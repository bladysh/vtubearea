import type { HandPose } from "@vtubearea/protocol";

/** One hand as the detector reports it. MediaPipe's left/right label is ignored: it flips too often. */
export interface HandDetection {
  pose: HandPose;
}

type UserSide = "left" | "right";
type Point = [number, number];

// A hand that jumped further than this (image widths) between frames is treated as new.
const MAXIMUM_CONTINUITY_JUMP = 0.25;
// How long a side's last position still counts for matching.
const MEMORY_MS = 500;
// Two detections closer than this on average (image widths) are the same hand found twice,
// which MediaPipe does when hands touch.
const DUPLICATE_DISTANCE = 0.035;

/**
 * Decides which detection is the user's left and right hand, by geometry only. Rules:
 * a hand stays the side it was last frame (so crossed hands keep their identity);
 * a new hand is the user's right hand if it appears left of the face in the unmirrored
 * camera image, else the left hand. MediaPipe's own labels were wrong too often and
 * sent the avatar's arm across its body.
 */
export class HandSideAssigner {
  private last_wrist: Record<UserSide, { point: Point; time_ms: number } | null> = { left: null, right: null };

  /** face_center_x: the face's horizontal position in the image (0..1); 0.5 when unknown. */
  assign(all_detections: readonly HandDetection[], time_ms: number, face_center_x = 0.5): Record<UserSide, HandPose | null> {
    const detections = remove_duplicate_hands(all_detections);
    const recent_wrist = (side: UserSide) => {
      const last = this.last_wrist[side];
      return last && time_ms - last.time_ms <= MEMORY_MS ? last.point : null;
    };
    const assigned: Record<UserSide, HandPose | null> = { left: null, right: null };

    if (detections.length >= 2) {
      const [first, second] = detections as [HandDetection, HandDetection];
      const pair_cost = (detection: HandDetection, side: UserSide) => this.pair_cost(detection, side, recent_wrist, face_center_x);
      const keep_order_cost = pair_cost(first, "left") + pair_cost(second, "right");
      const swap_order_cost = pair_cost(first, "right") + pair_cost(second, "left");
      const [left_detection, right_detection] = keep_order_cost <= swap_order_cost ? [first, second] : [second, first];
      assigned.left = left_detection.pose;
      assigned.right = right_detection.pose;
    } else if (detections.length === 1) {
      const detection = detections[0]!;
      const wrist = wrist_of(detection.pose);
      const distance_to = (side: UserSide) => {
        const previous_wrist = recent_wrist(side);
        return previous_wrist ? distance(wrist, previous_wrist) : Infinity;
      };
      const nearest_side: UserSide = distance_to("left") <= distance_to("right") ? "left" : "right";
      const is_continuing = distance_to(nearest_side) <= MAXIMUM_CONTINUITY_JUMP;
      // Unmirrored camera: the user's right hand shows left of their face.
      const side_by_position: UserSide = wrist[0] < face_center_x ? "right" : "left";
      const side = is_continuing ? nearest_side : side_by_position;
      assigned[side] = detection.pose;
    }

    for (const side of ["left", "right"] as const) {
      const pose = assigned[side];
      if (pose) this.last_wrist[side] = { point: wrist_of(pose), time_ms };
    }
    return assigned;
  }

  /** Lower is better: distance to the side's last position, or image position when there is none. */
  private pair_cost(detection: HandDetection, side: UserSide, recent_wrist: (side: UserSide) => Point | null, face_center_x: number): number {
    const wrist = wrist_of(detection.pose);
    const previous_wrist = recent_wrist(side);
    if (previous_wrist) return distance(wrist, previous_wrist);
    // Unmirrored camera: the user's right hand shows on the image's left of the face.
    return side === "right" ? wrist[0] - face_center_x : face_center_x - wrist[0];
  }
}

function remove_duplicate_hands(detections: readonly HandDetection[]): HandDetection[] {
  const kept_detections: HandDetection[] = [];
  for (const detection of detections) {
    const is_duplicate = kept_detections.some((kept_detection) => mean_landmark_distance(kept_detection.pose, detection.pose) < DUPLICATE_DISTANCE);
    if (!is_duplicate) kept_detections.push(detection);
  }
  return kept_detections;
}

function mean_landmark_distance(first_pose: HandPose, second_pose: HandPose): number {
  const point_count = Math.min(first_pose.landmarks.length, second_pose.landmarks.length);
  let distance_sum = 0;
  for (let point_index = 0; point_index < point_count; point_index += 1) {
    const [first_x, first_y] = first_pose.landmarks[point_index]!;
    const [second_x, second_y] = second_pose.landmarks[point_index]!;
    distance_sum += Math.hypot(first_x - second_x, first_y - second_y);
  }
  return point_count > 0 ? distance_sum / point_count : Infinity;
}

function wrist_of(pose: HandPose): Point {
  const wrist = pose.landmarks[0]!;
  return [wrist[0], wrist[1]];
}

function distance(first_point: Point, second_point: Point): number {
  return Math.hypot(first_point[0] - second_point[0], first_point[1] - second_point[1]);
}
