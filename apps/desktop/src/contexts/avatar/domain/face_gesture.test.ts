import { describe, expect, it } from "vitest";
import { FaceGestureDetector, gesture_strength, read_gesture, threshold_for_strength } from "./face_gesture";

const winking = { EyeOpenLeft: 0.05, EyeOpenRight: 0.95 };
const neutral = { EyeOpenLeft: 1, EyeOpenRight: 1 };

describe("FaceGestureDetector", () => {
  it("fires a wink once it is held, and only once while it is held", () => {
    const detector = new FaceGestureDetector();
    expect(detector.update(winking, true, 0.2).started).toEqual([]);
    expect(detector.update(winking, true, 0.2).started).toEqual(["wink_left"]);
    expect(detector.update(winking, true, 0.5).started).toEqual([]);
    // One noisy open frame does not end it; letting go for a moment does.
    expect(detector.update(neutral, true, 0.05).ended).toEqual([]);
    expect(detector.update(winking, true, 0.05).started).toEqual([]);
    expect(detector.update(neutral, true, 0.25).ended).toEqual(["wink_left"]);
    detector.update(winking, true, 0.2);
    expect(detector.update(winking, true, 0.2).started).toEqual(["wink_left"]);
  });

  it("does not take a blink of both eyes for a wink", () => {
    const detector = new FaceGestureDetector();
    expect(detector.update({ EyeOpenLeft: 0, EyeOpenRight: 0 }, true, 1).started).toEqual([]);
  });

  it("forgets a gesture when the face is lost", () => {
    const detector = new FaceGestureDetector();
    detector.update(winking, true, 0.3);
    detector.update(winking, true, 0.1);
    expect(detector.update(winking, false, 0.3)).toEqual({ started: [], ended: ["wink_left"] });
    expect(detector.update(winking, true, 0.1).started).toEqual([]);
  });
});

describe("gesture thresholds", () => {
  it("uses the user's threshold over the default", () => {
    const slight_sad = { MouthSmile: -0.1 };
    expect(read_gesture("sad_mouth", slight_sad, {}).is_shown).toBe(false);
    expect(read_gesture("sad_mouth", slight_sad, { sad_mouth: -0.05 }).is_shown).toBe(true);
  });

  it("measures strength from the relaxed face, whichever way the gesture goes", () => {
    expect(gesture_strength("wink_left", 1)).toBe(0);
    expect(gesture_strength("wink_left", 0.05)).toBe(1);
    expect(gesture_strength("sad_mouth", -0.3)).toBeCloseTo(0.5);
    expect(threshold_for_strength("sad_mouth", 0.5)).toBeCloseTo(-0.3);
  });
});
