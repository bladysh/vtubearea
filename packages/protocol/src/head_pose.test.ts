import { describe, expect, it } from "vitest";
import { quaternion_to_head_angles, rotation_matrix_to_quaternion } from "./head_pose";

function rotation_matrix_around_y(angle_degrees: number): number[] {
  const radians = (angle_degrees * Math.PI) / 180;
  const cosine = Math.cos(radians), sine = Math.sin(radians);
  // Column-major 4x4.
  return [cosine, 0, -sine, 0, 0, 1, 0, 0, sine, 0, cosine, 0, 0, 0, 0, 1];
}

describe("head pose", () => {
  it("identity quaternion has zero angles", () => {
    const head_angles = quaternion_to_head_angles([0, 0, 0, 1]);
    expect(head_angles.yaw).toBeCloseTo(0);
    expect(head_angles.pitch).toBeCloseTo(0);
    expect(head_angles.roll).toBeCloseTo(0);
  });

  it("round-trips a yaw rotation through matrix and quaternion", () => {
    const quaternion = rotation_matrix_to_quaternion(rotation_matrix_around_y(25));
    const head_angles = quaternion_to_head_angles(quaternion);
    expect(head_angles.yaw).toBeCloseTo(25);
    expect(head_angles.pitch).toBeCloseTo(0);
    expect(head_angles.roll).toBeCloseTo(0);
  });

  it("handles a 180 degree turn without NaN", () => {
    const quaternion = rotation_matrix_to_quaternion(rotation_matrix_around_y(180));
    expect(quaternion.every(Number.isFinite)).toBe(true);
  });
});
