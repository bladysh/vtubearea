import { describe, expect, it } from "vitest";
import { solve_arm } from "./arm_solver";

const distance = (first: readonly number[], second: readonly number[]) => Math.hypot(first[0]! - second[0]!, first[1]! - second[1]!);

describe("solve_arm", () => {
  it("keeps both bone lengths when the wrist is in reach", () => {
    const arm_pose = solve_arm([0, 0], [150, 100], 120, 110, 1);
    expect(distance(arm_pose.shoulder, arm_pose.elbow)).toBeCloseTo(120);
    expect(distance(arm_pose.elbow, arm_pose.wrist)).toBeCloseTo(110);
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
});
