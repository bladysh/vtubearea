import type { Vector3 } from "@vtubearea/protocol";
import { ASSUMED_VERTICAL_FIELD_OF_VIEW_DEGREES } from "./hand_depth";

/** Where the user's face is in the picture, in camera-frame units (1 = frame height, origin at the center). */
export interface FaceAnchor {
  center: [number, number];
  /** Apparent face height in frame units. */
  height: number;
}

/** Chin to forehead of an average adult; only the ratio to the model's face size matters. */
const REAL_FACE_HEIGHT_METERS = 0.2;
// Focal length in frame-height units for the camera MediaPipe assumes.
const FOCAL_LENGTH_FRAME_UNITS = 1 / (2 * Math.tan((ASSUMED_VERTICAL_FIELD_OF_VIEW_DEGREES * Math.PI) / 360));

/**
 * Projects the head position (MediaPipe camera space: x right, y up, camera looking down -z)
 * into the same frame units the hand skeletons use, so hands can be placed relative to the face.
 */
export function face_anchor_from_head_position(position_meters: Vector3, is_mirrored: boolean): FaceAnchor | null {
  const [x, y, z] = position_meters;
  const distance = -z;
  if (distance <= 0.05) return null;
  const image_x = (FOCAL_LENGTH_FRAME_UNITS * x) / distance;
  return {
    center: [is_mirrored ? -image_x : image_x, (-FOCAL_LENGTH_FRAME_UNITS * y) / distance],
    height: (FOCAL_LENGTH_FRAME_UNITS * REAL_FACE_HEIGHT_METERS) / distance,
  };
}
