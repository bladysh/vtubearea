import { describe, expect, it } from "vitest";
import { bend_eye_closing, eye_blink_from_mesh, type MeshPoint } from "./eye_openness";

/** A mesh where both eyes are 0.1 wide with the given lid gap (square image). */
function mesh_with_gap(gap: number): MeshPoint[] {
  const points: MeshPoint[] = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  const place_eye = (outer: number, inner: number, upper: readonly number[], lower: readonly number[], center_x: number) => {
    points[outer] = { x: center_x - 0.05, y: 0.5 };
    points[inner] = { x: center_x + 0.05, y: 0.5 };
    for (const index of upper) points[index] = { x: center_x, y: 0.5 - gap / 2 };
    for (const index of lower) points[index] = { x: center_x, y: 0.5 + gap / 2 };
  };
  place_eye(263, 362, [385, 386, 387], [380, 374, 373], 0.6);
  place_eye(33, 133, [158, 159, 160], [153, 145, 144], 0.4);
  return points;
}

describe("eye_blink_from_mesh", () => {
  it("reads a wide gap as open, no gap as shut and a squint in between", () => {
    expect(eye_blink_from_mesh(mesh_with_gap(0.03), 1)!.left).toBeCloseTo(0);
    expect(eye_blink_from_mesh(mesh_with_gap(0.005), 1)!.right).toBeCloseTo(1);
    const squint = eye_blink_from_mesh(mesh_with_gap(0.019), 1)!.left;
    expect(squint).toBeGreaterThan(0.3);
    expect(squint).toBeLessThan(0.7);
  });
});

describe("bend_eye_closing", () => {
  it("keeps a nearly shut eye open longer when lateness is above 0, and leaves the ends alone", () => {
    expect(bend_eye_closing(0.2, 0)).toBeCloseTo(0.2);
    expect(bend_eye_closing(0.2, 1)).toBeGreaterThan(0.4);
    expect(bend_eye_closing(0.2, -1)).toBeLessThan(0.1);
    expect(bend_eye_closing(0, 1)).toBe(0);
    expect(bend_eye_closing(1, -1)).toBe(1);
  });
});
