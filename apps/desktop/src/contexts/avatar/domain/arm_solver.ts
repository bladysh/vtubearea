import type { FramePoint } from "./hand_placement";

/** Farthest the elbow may stick out from the shoulder-wrist line, as a share of the arm length. */
const MAXIMUM_ELBOW_OFFSET_RATIO = 0.28;
/** Shortest the bones may get on screen when the forearm points at the camera. */
const MINIMUM_FORESHORTENING = 0.3;

export interface ArmPose {
  shoulder: FramePoint;
  elbow: FramePoint;
  wrist: FramePoint;
}

/**
 * Two-bone inverse kinematics: finds the elbow between a fixed shoulder and the tracked
 * wrist. Of the two possible elbows, the one pointing away from the body is used, like a
 * real arm. Too far to reach: the arm stretches straight (a cartoon arm may grow a little).
 * A hand close to the shoulder would push the elbow far out to the side; a real arm points
 * the forearm at the camera instead, so the bones get shorter on screen (foreshortening).
 */
export function solve_arm(
  shoulder: FramePoint,
  wrist: FramePoint,
  upper_arm_length: number,
  forearm_length: number,
  /** Which way is "outward" for this arm: +1 = toward larger x, -1 = toward smaller x. */
  outward_direction: 1 | -1,
  /** Where the forearm leaves the wrist (any length), e.g. from knuckles to wrist; places the elbow. */
  forearm_direction?: FramePoint,
): ArmPose {
  const elbow_along_forearm = forearm_direction && elbow_on_forearm_line(shoulder, wrist, upper_arm_length, forearm_length, forearm_direction);
  if (elbow_along_forearm) return { shoulder, elbow: elbow_along_forearm, wrist };
  const delta_x = wrist[0] - shoulder[0];
  const delta_y = wrist[1] - shoulder[1];
  const reach = Math.max(Math.hypot(delta_x, delta_y), 1e-6);
  const full_length = upper_arm_length + forearm_length;
  const stretch = reach > full_length ? reach / full_length : foreshortening(reach, upper_arm_length, forearm_length);
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
  // Prefer the elbow on the forearm's side when that is known, otherwise the one pointing away from the body.
  const elbow_score = (elbow: FramePoint) =>
    forearm_direction
      ? (elbow[0] - wrist[0]) * forearm_direction[0] + (elbow[1] - wrist[1]) * forearm_direction[1]
      : elbow[0] * outward_direction;
  const elbow = candidate_elbows.reduce((best_elbow, candidate_elbow) => (elbow_score(candidate_elbow) > elbow_score(best_elbow) ? candidate_elbow : best_elbow));
  return { shoulder, elbow, wrist };
}

/** Bone scale (at most 1) that keeps the elbow within MAXIMUM_ELBOW_OFFSET_RATIO of the shoulder-wrist line. */
function foreshortening(reach: number, upper_arm_length: number, forearm_length: number): number {
  const maximum_offset = (upper_arm_length + forearm_length) * MAXIMUM_ELBOW_OFFSET_RATIO;
  const elbow_offset = (scale: number) => {
    const upper_length = upper_arm_length * scale;
    const lower_length = forearm_length * scale;
    // Heron: twice the triangle area over its base is the elbow's distance from the shoulder-wrist line.
    const half_perimeter = (upper_length + lower_length + reach) / 2;
    const area_squared = half_perimeter * (half_perimeter - upper_length) * (half_perimeter - lower_length) * (half_perimeter - reach);
    return (2 * Math.sqrt(Math.max(0, area_squared))) / Math.max(reach, 1e-6);
  };
  if (elbow_offset(1) <= maximum_offset) return 1;
  // The offset grows with the scale, so a short bisection finds the largest scale that fits.
  let lowest_scale = reach / (upper_arm_length + forearm_length);
  let highest_scale = 1;
  for (let step = 0; step < 24; step += 1) {
    const middle_scale = (lowest_scale + highest_scale) / 2;
    if (elbow_offset(middle_scale) > maximum_offset) highest_scale = middle_scale;
    else lowest_scale = middle_scale;
  }
  return lowest_scale;
}

/**
 * Elbow on the line the forearm leaves the wrist along, with both bones shortened by the same
 * share so the upper arm still reaches the shoulder (the arm turned toward the camera).
 * null when no such pose exists, for example a forearm pointing away from the shoulder.
 */
function elbow_on_forearm_line(
  shoulder: FramePoint,
  wrist: FramePoint,
  upper_arm_length: number,
  forearm_length: number,
  forearm_direction: FramePoint,
): FramePoint | null {
  const direction_length = Math.hypot(forearm_direction[0], forearm_direction[1]);
  if (direction_length < 1e-6) return null;
  const [direction_x, direction_y] = [forearm_direction[0] / direction_length, forearm_direction[1] / direction_length];
  const [offset_x, offset_y] = [wrist[0] - shoulder[0], wrist[1] - shoulder[1]];
  // |wrist + direction * forearm * scale - shoulder| = upper_arm * scale, a quadratic in scale.
  const quadratic = forearm_length ** 2 - upper_arm_length ** 2;
  const linear = 2 * forearm_length * (offset_x * direction_x + offset_y * direction_y);
  const constant = offset_x ** 2 + offset_y ** 2;
  const roots =
    Math.abs(quadratic) < 1e-6
      ? [-constant / linear]
      : (() => {
          const discriminant = linear ** 2 - 4 * quadratic * constant;
          if (discriminant < 0) return [];
          const root_of_discriminant = Math.sqrt(discriminant);
          return [(-linear + root_of_discriminant) / (2 * quadratic), (-linear - root_of_discriminant) / (2 * quadratic)];
        })();
  const scale = Math.max(...roots.filter((root) => root >= MINIMUM_FORESHORTENING && root <= 1));
  if (!Number.isFinite(scale)) return null;
  return [wrist[0] + direction_x * forearm_length * scale, wrist[1] + direction_y * forearm_length * scale];
}
