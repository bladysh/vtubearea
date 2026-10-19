import { describe, expect, it } from "vitest";
import { ease_crop_box, face_crop_box } from "./face_crop";

describe("face_crop_box", () => {
  it("is a square centered on the face with room around it", () => {
    const crop_box = face_crop_box([{ x: 0.4, y: 0.3 }, { x: 0.6, y: 0.6 }], 1000, 1000);
    expect(crop_box.size).toBeCloseTo(300 * 1.7);
    expect(crop_box.left + crop_box.size / 2).toBeCloseTo(500);
    expect(crop_box.top + crop_box.size / 2).toBeCloseTo(450);
  });

  it("never grows past the camera picture", () => {
    expect(face_crop_box([{ x: 0, y: 0 }, { x: 1, y: 1 }], 1280, 720).size).toBe(720);
  });
});

describe("ease_crop_box", () => {
  it("moves part of the way toward the target", () => {
    expect(ease_crop_box({ left: 0, top: 0, size: 100 }, { left: 100, top: 50, size: 200 }, 0.5)).toEqual({ left: 50, top: 25, size: 150 });
  });
});
