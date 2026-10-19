import { describe, expect, it } from "vitest";
import { solve_arm } from "./arm_solver";

const distance = (first: readonly number[], second: readonly number[]) => Math.hypot(first[0]! - second[0]!, first[1]! - second[1]!);

describe("solve_arm", () => {
  it("keeps both bone lengths when the arm is fairly straight", () => {
    const arm_pose = solve_arm([0, 0], [200, 60], 120, 110, 1);
    expect(distance(arm_pose.shoulder, arm_pose.elbow)).toBeCloseTo(120);
    expect(distance(arm_pose.elbow, arm_pose.wrist)).toBeCloseTo(110);
  });

  it("shortens the bones instead of throwing the elbow far out when the hand is near the shoulder", () => {
    const arm_pose = solve_arm([0, 0], [0, -60], 120, 110, 1);
    // At full length the elbow would sit about 110 px out to the side.
    expect(arm_pose.elbow[0]).toBeLessThan(230 * 0.28 + 1);
    expect(distance(arm_pose.elbow, arm_pose.wrist)).toBeLessThan(110);
  });

  it("bends the elbow outward", () => {
    // Hand raised straight above a left-side shoulder: the elbow sticks out to the left.
    const left_arm = solve_arm([0, 0], [0, -150], 120, 110, -1);
    expect(left_arm.elbow[0]).toBeLessThan(0);
    const right_arm = solve_arm([0, 0], [0, -150], 120, 110, 1);
    expect(right_arm.elbow[0]).toBeGreaterThan(0);
  });

  it("stretches straight when the wrist is out of reach", () => {
    const arm_pose = solve_arm([0, 0], [500, 0], 120, 110, 1);
    expect(arm_pose.elbow[1]).toBeCloseTo(0);
    expect(arm_pose.elbow[0]).toBeGreaterThan(0);
    expect(arm_pose.elbow[0]).toBeLessThan(500);
  });

  it("puts the elbow on the forearm line when the hand's direction is known", () => {
    // Hand raised beside the head, fingers up: the forearm hangs straight down from the wrist.
    const arm_pose = solve_arm([0, 0], [80, -60], 120, 110, 1, [0, 1]);
    expect(arm_pose.elbow[0]).toBeCloseTo(80);
    expect(arm_pose.elbow[1]).toBeGreaterThan(-60);
    // Both bones shorten by the same share, so the upper arm still reaches the shoulder.
    const forearm_scale = distance(arm_pose.elbow, arm_pose.wrist) / 110;
    expect(distance(arm_pose.shoulder, arm_pose.elbow) / 120).toBeCloseTo(forearm_scale);
  });

  it("falls back to inverse kinematics when the forearm line cannot reach the shoulder", () => {
    const arm_pose = solve_arm([0, 0], [150, 100], 120, 110, 1, [1, 0]);
    expect(distance(arm_pose.elbow, arm_pose.wrist)).toBeGreaterThan(0);
    expect(arm_pose.elbow[0]).toBeLessThan(150);
  });
});
