import type { FramePoint } from "./hand_placement";

export interface ArmPose {
  shoulder: FramePoint;
  elbow: FramePoint;
  wrist: FramePoint;
}

/**
 * Two-bone inverse kinematics: finds the elbow between a fixed shoulder and the tracked
 * wrist. Of the two possible elbows, the one pointing away from the body is used, like a
 * real arm. Too far to reach: the arm stretches straight (a cartoon arm may grow a little).
 */
export function solve_arm(
  shoulder: FramePoint,
  wrist: FramePoint,
  upper_arm_length: number,
  forearm_length: number,
  /** Which way is "outward" for this arm: +1 = toward larger x, -1 = toward smaller x. */
  outward_direction: 1 | -1,
): ArmPose {
  const delta_x = wrist[0] - shoulder[0];
  const delta_y = wrist[1] - shoulder[1];
  const reach = Math.max(Math.hypot(delta_x, delta_y), 1e-6);
  const full_length = upper_arm_length + forearm_length;
  const stretch = reach > full_length ? reach / full_length : 1;
  const upper_length = upper_arm_length * stretch;
  const lower_length = forearm_length * stretch;
  // Clamp to the reachable range so a hand right at the shoulder still folds sensibly.
  const clamped_reach = Math.min(Math.max(reach, Math.abs(upper_length - lower_length) + 1e-6), upper_length + lower_length);

  // Law of cosines: angle at the shoulder between the shoulder-wrist line and the upper arm.
  const cosine_at_shoulder = (upper_length ** 2 + clamped_reach ** 2 - lower_length ** 2) / (2 * upper_length * clamped_reach);
  const shoulder_angle = Math.acos(Math.min(1, Math.max(-1, cosine_at_shoulder)));
  const line_angle = Math.atan2(delta_y, delta_x);
  const candidate_elbows = [line_angle + shoulder_angle, line_angle - shoulder_angle].map(
    (elbow_angle): FramePoint => [shoulder[0] + Math.cos(elbow_angle) * upper_length, shoulder[1] + Math.sin(elbow_angle) * upper_length],
  );
  const elbow = candidate_elbows.reduce((best_elbow, candidate_elbow) =>
    candidate_elbow[0] * outward_direction > best_elbow[0] * outward_direction ? candidate_elbow : best_elbow,
  );
  return { shoulder, elbow, wrist };
}
