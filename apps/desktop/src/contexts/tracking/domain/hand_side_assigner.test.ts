import { describe, expect, it } from "vitest";
import type { HandPose } from "@vtubearea/protocol";
import { HandSideAssigner, type HandDetection } from "./hand_side_assigner";

function hand_at(x: number, y = 0.5): HandPose {
  return { landmarks: Array.from({ length: 21 }, () => [x, y, 0] as [number, number, number]) };
}

const detection = (x: number): HandDetection => ({ pose: hand_at(x) });

describe("HandSideAssigner", () => {
  it("splits two new hands by position: left of the face in the image is the user's right hand", () => {
    const assigner = new HandSideAssigner();
    const assigned = assigner.assign([detection(0.8), detection(0.2)], 0, 0.5);
    expect(assigned.right?.landmarks[0]![0]).toBe(0.2);
    expect(assigned.left?.landmarks[0]![0]).toBe(0.8);
  });

  it("decides a single new hand by which side of the face it appears on", () => {
    expect(new HandSideAssigner().assign([detection(0.3)], 0, 0.6).right).not.toBeNull();
    expect(new HandSideAssigner().assign([detection(0.7)], 0, 0.6).left).not.toBeNull();
  });

  it("keeps each hand on its side when hands cross", () => {
    const assigner = new HandSideAssigner();
    assigner.assign([detection(0.45), detection(0.55)], 0, 0.5);
    // Hands moved past each other a little; continuity wins over image position.
    const assigned = assigner.assign([detection(0.52), detection(0.48)], 33, 0.5);
    expect(assigned.right?.landmarks[0]![0]).toBe(0.48);
    expect(assigned.left?.landmarks[0]![0]).toBe(0.52);
  });

  it("keeps following a single hand that crosses the face", () => {
    const assigner = new HandSideAssigner();
    assigner.assign([detection(0.4)], 0, 0.5);
    const assigned = assigner.assign([detection(0.52)], 33, 0.5);
    expect(assigned.right).not.toBeNull();
    expect(assigned.left).toBeNull();
  });

  it("drops a hand that was detected twice while hands touch", () => {
    const assigner = new HandSideAssigner();
    const assigned = assigner.assign([detection(0.5), detection(0.51)], 0, 0.5);
    expect([assigned.left, assigned.right].filter(Boolean)).toHaveLength(1);
  });
});
