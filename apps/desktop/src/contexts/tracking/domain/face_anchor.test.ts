import { describe, expect, it } from "vitest";
import { face_anchor_from_head_position } from "./face_anchor";

describe("face_anchor_from_head_position", () => {
  it("puts a face straight ahead at the frame center", () => {
    const face_anchor = face_anchor_from_head_position([0, 0, -0.5], false)!;
    expect(face_anchor.center[0]).toBeCloseTo(0);
    expect(face_anchor.center[1]).toBeCloseTo(0);
  });

  it("moves left in the picture for negative x, mirrored to the right", () => {
    expect(face_anchor_from_head_position([-0.1, 0, -0.5], false)!.center[0]).toBeLessThan(0);
    expect(face_anchor_from_head_position([-0.1, 0, -0.5], true)!.center[0]).toBeGreaterThan(0);
  });

  it("goes up in the picture (negative y) when the head is higher, and shrinks with distance", () => {
    expect(face_anchor_from_head_position([0, 0.1, -0.5], false)!.center[1]).toBeLessThan(0);
    const near = face_anchor_from_head_position([0, 0, -0.4], false)!;
    const far = face_anchor_from_head_position([0, 0, -0.8], false)!;
    expect(near.height).toBeCloseTo(far.height * 2);
  });
});
