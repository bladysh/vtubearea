import { describe, expect, it } from "vitest";
import { create_empty_face_frame, type Quaternion } from "@vtubearea/protocol";
import { derive_tracking_inputs } from "./tracking_inputs";

const DEGREES_TO_RADIANS = Math.PI / 180;

function rotation_about(axis: "x" | "y" | "z", angle_degrees: number): Quaternion {
  const half_angle = (angle_degrees * DEGREES_TO_RADIANS) / 2;
  const sine = Math.sin(half_angle);
  return [axis === "x" ? sine : 0, axis === "y" ? sine : 0, axis === "z" ? sine : 0, Math.cos(half_angle)];
}

function inputs_for(rotation_quaternion: Quaternion, is_mirrored: boolean) {
  const face_frame = { ...create_empty_face_frame("desktop-webcam", 0), face_found: true };
  return derive_tracking_inputs({ ...face_frame, head: { position_meters: [0, 0, 0], rotation_quaternion } }, is_mirrored);
}

// MediaPipe camera space: positive rotation about x = looking down (measured with a rendered face).
describe("derive_tracking_inputs head angles", () => {
  it("looking down gives a negative FaceAngleY in both modes", () => {
    expect(inputs_for(rotation_about("x", 20), false).FaceAngleY).toBeCloseTo(-20);
    expect(inputs_for(rotation_about("x", 20), true).FaceAngleY).toBeCloseTo(-20);
  });

  it("a face turned to the image's right copies without mirror and flips with mirror", () => {
    expect(inputs_for(rotation_about("y", 15), false).FaceAngleX).toBeCloseTo(15);
    expect(inputs_for(rotation_about("y", 15), true).FaceAngleX).toBeCloseTo(-15);
  });

  it("a head top leaning to the image's right copies without mirror and flips with mirror", () => {
    // Negative rotation about z moves the head top toward the image's right.
    expect(inputs_for(rotation_about("z", -10), false).FaceAngleZ).toBeCloseTo(10);
    expect(inputs_for(rotation_about("z", -10), true).FaceAngleZ).toBeCloseTo(-10);
  });
});
