/** A square part of the camera picture, in camera pixels. */
export interface CropBox {
  left: number;
  top: number;
  size: number;
}

/** Room around the face in the crop, as a multiple of the face size. */
const FACE_CROP_MARGIN = 1.7;

/** Square around the face landmarks (0..1 image coordinates) with some margin, in camera pixels. */
export function face_crop_box(landmarks: readonly { x: number; y: number }[], video_width: number, video_height: number): CropBox {
  const xs = landmarks.map((landmark) => landmark.x * video_width);
  const ys = landmarks.map((landmark) => landmark.y * video_height);
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const size = Math.min(Math.max(right - left, bottom - top) * FACE_CROP_MARGIN, video_width, video_height);
  return { left: (left + right) / 2 - size / 2, top: (top + bottom) / 2 - size / 2, size };
}

/** Moves a crop part of the way toward the target each frame, so small head moves do not shake it. */
export function ease_crop_box(previous_box: CropBox, target_box: CropBox, share: number): CropBox {
  return {
    left: previous_box.left + (target_box.left - previous_box.left) * share,
    top: previous_box.top + (target_box.top - previous_box.top) * share,
    size: previous_box.size + (target_box.size - previous_box.size) * share,
  };
}
