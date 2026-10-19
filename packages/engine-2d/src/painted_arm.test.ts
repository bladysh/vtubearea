import { describe, expect, it } from "vitest";
import { multiply_matrices, transform_point } from "./affine_matrix";
import { bone_matrix, hand_pose_matrix, mirror_matrix, type HandFrame } from "./painted_arm";

function expect_point(actual: [number, number], expected: [number, number]) {
  expect(actual[0]).toBeCloseTo(expected[0]);
  expect(actual[1]).toBeCloseTo(expected[1]);
}

describe("bone_matrix", () => {
  it("turns a hanging bone up and stretches only along its length", () => {
    // Painted pointing down from (0, 0) to (0, 100); solved pointing right, 150 long.
    const matrix = bone_matrix([0, 0], [0, 100], [10, 10], [160, 10]);
    expect_point(transform_point(matrix, 0, 0), [10, 10]);
    expect_point(transform_point(matrix, 0, 100), [160, 10]);
    // A point 20 px beside the bone stays 20 px beside it: the sleeve keeps its width.
    expect_point(transform_point(matrix, 20, 0), [10, -10]);
  });
});

describe("hand_pose_matrix", () => {
  const rest_frame: HandFrame = { wrist: [0, 0], index_base: [-10, 40], pinky_base: [10, 40] };

  it("pins the wrist and points the fingers like the tracked hand", () => {
    const target_frame: HandFrame = { wrist: [100, 100], index_base: [140, 110], pinky_base: [140, 90] };
    const matrix = hand_pose_matrix(rest_frame, target_frame);
    expect_point(transform_point(matrix, 0, 0), [100, 100]);
    expect_point(transform_point(matrix, 0, 40), [140, 100]);
    expect_point(transform_point(matrix, -10, 40), [140, 110]);
  });

  it("flips the image when the tracked thumb is on the other side", () => {
    const target_frame: HandFrame = { wrist: [0, 0], index_base: [10, 40], pinky_base: [-10, 40] };
    const matrix = hand_pose_matrix(rest_frame, target_frame);
    expect_point(transform_point(matrix, -10, 40), [10, 40]);
  });
});

describe("mirror_matrix", () => {
  it("mirrors the painted right arm around the body middle", () => {
    const mirrored = multiply_matrices(mirror_matrix(500), bone_matrix([0, 0], [0, 100], [0, 0], [0, 100]));
    expect_point(transform_point(mirrored, 400, 50), [600, 50]);
  });
});
