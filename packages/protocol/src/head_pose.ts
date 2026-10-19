import type { Quaternion } from "./face_frame";

/**
 * Angles in MediaPipe's camera space (x right, y up, z toward the camera), as seen
 * in the unmirrored camera image. Signs were measured, not assumed.
 */
export interface HeadAnglesDegrees {
  /** Turn, positive = face points toward the image's right edge. */
  yaw: number;
  /** Nod, positive = looking down. */
  pitch: number;
  /** Tilt, positive = top of the head leans toward the image's left edge. */
  roll: number;
}

const RADIANS_TO_DEGREES = 180 / Math.PI;

/** Converts a camera-space quaternion (x, y, z, w) to yaw/pitch/roll, YXZ order. */
export function quaternion_to_head_angles(quaternion: Quaternion): HeadAnglesDegrees {
  const [x, y, z, w] = quaternion;
  const sin_pitch = Math.max(-1, Math.min(1, 2 * (w * x - y * z)));
  return {
    yaw: Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y)) * RADIANS_TO_DEGREES,
    pitch: Math.asin(sin_pitch) * RADIANS_TO_DEGREES,
    roll: Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z)) * RADIANS_TO_DEGREES,
  };
}

/** Builds a quaternion from a column-major 4x4 rotation matrix (WebGL / MediaPipe layout). */
export function rotation_matrix_to_quaternion(matrix: ArrayLike<number>): Quaternion {
  const element = (row: number, column: number) => matrix[column * 4 + row] ?? 0;
  const m00 = element(0, 0), m11 = element(1, 1), m22 = element(2, 2);
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    return [
      (element(2, 1) - element(1, 2)) / scale,
      (element(0, 2) - element(2, 0)) / scale,
      (element(1, 0) - element(0, 1)) / scale,
      0.25 * scale,
    ];
  }
  if (m00 > m11 && m00 > m22) {
    const scale = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [
      0.25 * scale,
      (element(0, 1) + element(1, 0)) / scale,
      (element(0, 2) + element(2, 0)) / scale,
      (element(2, 1) - element(1, 2)) / scale,
    ];
  }
  if (m11 > m22) {
    const scale = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [
      (element(0, 1) + element(1, 0)) / scale,
      0.25 * scale,
      (element(1, 2) + element(2, 1)) / scale,
      (element(0, 2) - element(2, 0)) / scale,
    ];
  }
  const scale = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [
    (element(0, 2) + element(2, 0)) / scale,
    (element(1, 2) + element(2, 1)) / scale,
    0.25 * scale,
    (element(1, 0) - element(0, 1)) / scale,
  ];
}
