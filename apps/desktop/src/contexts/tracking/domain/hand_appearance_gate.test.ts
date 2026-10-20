import { describe, expect, it } from "vitest";
import { HandAppearanceGate, type ImageBox } from "./hand_appearance_gate";
import type { HandDetection } from "./hand_side_assigner";

function detection_at(x: number, y: number): HandDetection {
  return { pose: { landmarks: Array.from({ length: 21 }, () => [x, y, 0] as [number, number, number]) } };
}

const face_box: ImageBox = { minimum_x: 0.4, minimum_y: 0.2, maximum_x: 0.6, maximum_y: 0.6 };

describe("HandAppearanceGate", () => {
  it("shows a new hand only after it was seen several frames in a row", () => {
    const gate = new HandAppearanceGate(3);
    expect(gate.filter([detection_at(0.2, 0.7)], 0, face_box)).toHaveLength(0);
    expect(gate.filter([detection_at(0.21, 0.7)], 33, face_box)).toHaveLength(0);
    expect(gate.filter([detection_at(0.22, 0.7)], 66, face_box)).toHaveLength(1);
  });

  it("ignores a single-frame flash", () => {
    const gate = new HandAppearanceGate(3);
    gate.filter([detection_at(0.2, 0.7)], 0, face_box);
    gate.filter([], 33, face_box);
    expect(gate.filter([detection_at(0.2, 0.7)], 66, face_box)).toHaveLength(0);
  });

  it("never lets a small phantom appear out of nowhere on the face", () => {
    const gate = new HandAppearanceGate(3);
    for (let frame_index = 0; frame_index < 20; frame_index += 1) {
      expect(gate.filter([detection_at(0.5, 0.4)], frame_index * 33, face_box)).toHaveLength(0);
    }
  });

  it("accepts a real, hand-sized hand raised onto the face once it stays a while", () => {
    const gate = new HandAppearanceGate(3);
    // Palm 0.2 tall against a 0.4 face: hand-sized.
    const raised_hand: HandDetection = { pose: { landmarks: Array.from({ length: 21 }, (_, index) => [0.5, index === 0 ? 0.5 : 0.3, 0] as [number, number, number]) } };
    const results = Array.from({ length: 12 }, (_, frame_index) => gate.filter([raised_hand], frame_index * 33, face_box).length);
    expect(results.slice(0, 11).every((count) => count === 0)).toBe(true);
    expect(results[11]).toBe(1);
  });

  it("lets a tracked hand move over the face", () => {
    const gate = new HandAppearanceGate(1);
    expect(gate.filter([detection_at(0.3, 0.45)], 0, face_box)).toHaveLength(1);
    expect(gate.filter([detection_at(0.45, 0.45)], 33, face_box)).toHaveLength(1);
  });
});
