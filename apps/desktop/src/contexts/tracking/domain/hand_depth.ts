/**
 * Distance estimates with one camera. MediaPipe's face geometry assumes a camera with a
 * 63° vertical field of view; using the same camera for hands keeps head and hand
 * distances on one scale, so comparing them is meaningful even if the real lens differs.
 */
export const ASSUMED_VERTICAL_FIELD_OF_VIEW_DEGREES = 63;

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

// Palm bones that stay rigid: wrist to finger bases and across the knuckles.
const RIGID_PALM_BONES: readonly (readonly [number, number])[] = [
  [0, 5],
  [0, 9],
  [0, 17],
  [5, 17],
];

export function focal_length_pixels(image_height_pixels: number): number {
  return image_height_pixels / 2 / Math.tan((ASSUMED_VERTICAL_FIELD_OF_VIEW_DEGREES * Math.PI) / 360);
}

/**
 * Pinhole estimate: distance = focal length × real size / size in the image. A tilted palm
 * looks shorter and therefore farther, so the least foreshortened bone (smallest estimate) wins.
 * image_points are in pixels, world_points in meters (MediaPipe hand world landmarks).
 */
export function estimate_hand_distance_meters(
  image_points: readonly Point2[],
  world_points: readonly Point3[],
  focal_length: number,
): number | null {
  const bone_estimates = RIGID_PALM_BONES.flatMap(([start_index, end_index]) => {
    const image_start = image_points[start_index], image_end = image_points[end_index];
    const world_start = world_points[start_index], world_end = world_points[end_index];
    if (!image_start || !image_end || !world_start || !world_end) return [];
    const image_length = Math.hypot(image_end[0] - image_start[0], image_end[1] - image_start[1]);
    const world_length = Math.hypot(world_end[0] - world_start[0], world_end[1] - world_start[1], world_end[2] - world_start[2]);
    return image_length > 1 && world_length > 0 ? [(focal_length * world_length) / image_length] : [];
  });
  return bone_estimates.length > 0 ? Math.min(...bone_estimates) : null;
}

// The hand must come this much closer again before it counts as in front (stops flicker).
const BEHIND_HYSTERESIS_CENTIMETERS = 3;
const DEPTH_SMOOTHING_SECONDS = 0.15;

/**
 * Smooths "how far behind the head is the hand" and turns it into a stable yes/no.
 * Positive offset = the hand is farther from the camera than the face.
 */
export class BehindHeadDetector {
  private smoothed_offset_centimeters: number | null = null;
  private is_behind = false;

  update(offset_centimeters: number, delta_seconds: number, threshold_centimeters: number): { offset_centimeters: number; is_behind: boolean } {
    const blend = this.smoothed_offset_centimeters === null ? 1 : 1 - Math.exp(-delta_seconds / DEPTH_SMOOTHING_SECONDS);
    const previous_offset = this.smoothed_offset_centimeters ?? offset_centimeters;
    this.smoothed_offset_centimeters = previous_offset + (offset_centimeters - previous_offset) * blend;
    if (this.smoothed_offset_centimeters > threshold_centimeters) this.is_behind = true;
    else if (this.smoothed_offset_centimeters < threshold_centimeters - BEHIND_HYSTERESIS_CENTIMETERS) this.is_behind = false;
    return { offset_centimeters: this.smoothed_offset_centimeters, is_behind: this.is_behind };
  }

  reset(): void {
    this.smoothed_offset_centimeters = null;
    this.is_behind = false;
  }
}
