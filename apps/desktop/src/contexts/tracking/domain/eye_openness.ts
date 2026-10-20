/** A face mesh point in image units (0..1 of width and height). */
export interface MeshPoint {
  x: number;
  y: number;
}

/**
 * Eye outline points of MediaPipe's 478-point face mesh. "left" is the user's own left eye
 * (on the image's right), like the ARKit blendshape names.
 */
const EYE_POINTS = {
  left: { outer_corner: 263, inner_corner: 362, upper: [385, 386, 387], lower: [380, 374, 373] },
  right: { outer_corner: 33, inner_corner: 133, upper: [158, 159, 160], lower: [153, 145, 144] },
} as const;

/** Lid gap over eye width for a wide-open and a shut eye; between them the blink is linear. */
const OPEN_ASPECT = 0.3;
const CLOSED_ASPECT = 0.08;

/**
 * How closed each eye is (0 open, 1 shut) from the gap between the lids. Unlike MediaPipe's
 * blink blendshape, which jumps between open and shut, this follows a squint smoothly.
 */
export function eye_blink_from_mesh(points: readonly MeshPoint[], image_aspect_ratio: number): { left: number; right: number } | null {
  if (points.length < 400) return null;
  const blink_of = (side: keyof typeof EYE_POINTS) => {
    const eye = EYE_POINTS[side];
    // Image x and y have different units unless x is scaled by the aspect ratio.
    const distance = (first_index: number, second_index: number) =>
      Math.hypot((points[first_index]!.x - points[second_index]!.x) * image_aspect_ratio, points[first_index]!.y - points[second_index]!.y);
    const width = distance(eye.outer_corner, eye.inner_corner);
    if (width < 1e-6) return 0;
    const gap = eye.upper.reduce((total, upper_index, pair_index) => total + distance(upper_index, eye.lower[pair_index]!), 0) / eye.upper.length;
    const openness = (gap / width - CLOSED_ASPECT) / (OPEN_ASPECT - CLOSED_ASPECT);
    return 1 - Math.min(1, Math.max(0, openness));
  };
  return { left: blink_of("left"), right: blink_of("right") };
}

/**
 * Bends eye openness (0 shut, 1 open) so the avatar's eye shuts later (lateness above 0) or
 * earlier (below 0) than the user's; a fully open and a fully shut eye stay as they are.
 */
export function bend_eye_closing(openness: number, lateness: number): number {
  return Math.min(1, Math.max(0, openness)) ** (2 ** -lateness);
}
