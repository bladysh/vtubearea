import type { HandDetection } from "./hand_side_assigner";

/** Normalized image box (0..1), e.g. around the face. */
export interface ImageBox {
  minimum_x: number;
  minimum_y: number;
  maximum_x: number;
  maximum_y: number;
}

type Point = [number, number];

// A detection within this distance (image widths) of a hand seen last frame continues it.
const CONTINUITY_DISTANCE = 0.25;
// How long a confirmed hand is remembered after its last frame.
const MEMORY_MS = 500;
// The face box is grown by this share of its size before testing.
const FACE_BOX_MARGIN = 0.15;
// A new hand on the face is accepted only after this many times the usual confirmation frames
// and only if it is hand-sized: phantoms in an ear or hair are small and come and go.
const ON_FACE_CONFIRMATION_FACTOR = 4;
const MINIMUM_PALM_TO_FACE_HEIGHT = 0.3;

/**
 * Stops phantom hands. The palm detector sometimes "finds" a hand in an ear, hair or a
 * face turned far to the side. A new hand must therefore show up in several frames in a
 * row; one that first appears on the face must stay there longer and be hand-sized (a real
 * hand raised straight to the chin). Hands already being tracked may move anywhere.
 */
export class HandAppearanceGate {
  private confirmed_hands: { wrist: Point; time_ms: number }[] = [];
  private candidates: { wrist: Point; frame_count: number }[] = [];

  constructor(private readonly confirmation_frames: number) {}

  filter(detections: readonly HandDetection[], time_ms: number, face_box: ImageBox | null): HandDetection[] {
    const recent_hands = this.confirmed_hands.filter((confirmed_hand) => time_ms - confirmed_hand.time_ms <= MEMORY_MS);
    const passed_detections: HandDetection[] = [];
    const next_candidates: typeof this.candidates = [];

    for (const detection of detections) {
      const wrist = wrist_of(detection);
      const is_continuing = recent_hands.some((recent_hand) => distance(recent_hand.wrist, wrist) <= CONTINUITY_DISTANCE);
      if (is_continuing) {
        passed_detections.push(detection);
        continue;
      }
      const is_on_face = face_box !== null && is_inside(palm_center_of(detection), grow_box(face_box, FACE_BOX_MARGIN));
      if (is_on_face && palm_length_of(detection) < (face_box.maximum_y - face_box.minimum_y) * MINIMUM_PALM_TO_FACE_HEIGHT) continue;
      const matching_candidate = this.candidates.find((candidate) => distance(candidate.wrist, wrist) <= CONTINUITY_DISTANCE);
      const frame_count = (matching_candidate?.frame_count ?? 0) + 1;
      const required_frames = is_on_face ? this.confirmation_frames * ON_FACE_CONFIRMATION_FACTOR : this.confirmation_frames;
      if (frame_count >= required_frames) passed_detections.push(detection);
      else next_candidates.push({ wrist, frame_count });
    }

    this.candidates = next_candidates;
    this.confirmed_hands = [
      ...recent_hands.filter((recent_hand) => !passed_detections.some((detection) => distance(recent_hand.wrist, wrist_of(detection)) <= CONTINUITY_DISTANCE)),
      ...passed_detections.map((detection) => ({ wrist: wrist_of(detection), time_ms })),
    ];
    return passed_detections;
  }
}

/** Bounding box of face landmarks in normalized image coordinates. */
export function box_around(points: readonly { x: number; y: number }[]): ImageBox | null {
  if (points.length === 0) return null;
  return {
    minimum_x: Math.min(...points.map((point) => point.x)),
    minimum_y: Math.min(...points.map((point) => point.y)),
    maximum_x: Math.max(...points.map((point) => point.x)),
    maximum_y: Math.max(...points.map((point) => point.y)),
  };
}

function grow_box(box: ImageBox, margin_ratio: number): ImageBox {
  const horizontal_margin = (box.maximum_x - box.minimum_x) * margin_ratio;
  const vertical_margin = (box.maximum_y - box.minimum_y) * margin_ratio;
  return {
    minimum_x: box.minimum_x - horizontal_margin,
    minimum_y: box.minimum_y - vertical_margin,
    maximum_x: box.maximum_x + horizontal_margin,
    maximum_y: box.maximum_y + vertical_margin,
  };
}

function is_inside(point: Point, box: ImageBox): boolean {
  return point[0] >= box.minimum_x && point[0] <= box.maximum_x && point[1] >= box.minimum_y && point[1] <= box.maximum_y;
}

function wrist_of(detection: HandDetection): Point {
  const wrist = detection.pose.landmarks[0]!;
  return [wrist[0], wrist[1]];
}

function palm_length_of(detection: HandDetection): number {
  const wrist = detection.pose.landmarks[0]!;
  const middle_base = detection.pose.landmarks[9]!;
  return Math.hypot(middle_base[0] - wrist[0], middle_base[1] - wrist[1]);
}

// Wrist and the four finger bases.
function palm_center_of(detection: HandDetection): Point {
  const palm_points = [0, 5, 9, 13, 17].map((point_index) => detection.pose.landmarks[point_index]!);
  return [
    palm_points.reduce((sum, point) => sum + point[0], 0) / palm_points.length,
    palm_points.reduce((sum, point) => sum + point[1], 0) / palm_points.length,
  ];
}

function distance(first_point: Point, second_point: Point): number {
  return Math.hypot(first_point[0] - second_point[0], first_point[1] - second_point[1]);
}
