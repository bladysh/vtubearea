import { describe, expect, it } from "vitest";
import { create_empty_face_frame, face_frame_schema, HAND_LANDMARK_COUNT } from "./face_frame";

describe("face_frame_schema", () => {
  it("accepts frames with and without hands", () => {
    const face_frame = create_empty_face_frame("desktop-webcam", 1);
    expect(face_frame_schema.safeParse(face_frame).success).toBe(true);

    const hand_landmarks = Array.from({ length: HAND_LANDMARK_COUNT }, () => [0.5, 0.5, 0] as [number, number, number]);
    const frame_with_hands = { ...face_frame, hands: { left: { landmarks: hand_landmarks }, right: null, image_aspect_ratio: 16 / 9 } };
    expect(face_frame_schema.safeParse(frame_with_hands).success).toBe(true);
  });

  it("rejects hands with the wrong number of points", () => {
    const frame_with_broken_hand = {
      ...create_empty_face_frame("desktop-webcam", 1),
      hands: { left: { landmarks: [[0, 0, 0]] }, right: null },
    };
    expect(face_frame_schema.safeParse(frame_with_broken_hand).success).toBe(false);
  });
});
