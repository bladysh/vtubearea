import { describe, expect, it } from "vitest";
import { create_empty_face_frame, type FaceFrame } from "@vtubearea/protocol";
import { OneEuroFilter } from "../domain/one_euro_filter";
import { DEFAULT_TRACKING_SETTINGS } from "../domain/tracking_settings";
import { TrackingHub } from "./tracking_hub";

function face_frame(timestamp_ms: number, blendshapes: FaceFrame["blendshapes"]): FaceFrame {
  return { ...create_empty_face_frame("desktop-webcam", timestamp_ms), face_found: true, blendshapes };
}

function create_hub() {
  let current_time_ms = 0;
  const tracking_hub = new TrackingHub(500, () => current_time_ms);
  const advance_to = (time_ms: number) => {
    current_time_ms = time_ms;
  };
  return { tracking_hub, advance_to };
}

describe("TrackingHub", () => {
  it("converges to a steady input and reports the face as found", () => {
    const { tracking_hub, advance_to } = create_hub();
    for (let frame_index = 0; frame_index < 60; frame_index += 1) {
      advance_to(frame_index * 33);
      tracking_hub.push_frame(face_frame(frame_index * 33, { jawOpen: 0.8 }));
    }
    const snapshot = tracking_hub.snapshot();
    expect(snapshot.is_face_found).toBe(true);
    expect(snapshot.input_values.MouthOpen).toBeCloseTo(0.8, 2);
    expect(snapshot.frames_per_second).toBeCloseTo(30, 0);
  });

  it("marks the face lost after the timeout", () => {
    const { tracking_hub, advance_to } = create_hub();
    tracking_hub.push_frame(face_frame(0, {}));
    advance_to(600);
    expect(tracking_hub.snapshot().is_face_found).toBe(false);
  });

  it("scales deviation from neutral by group sensitivity", () => {
    const { tracking_hub } = create_hub();
    tracking_hub.update_settings({
      ...DEFAULT_TRACKING_SETTINGS,
      sensitivity_by_group: { ...DEFAULT_TRACKING_SETTINGS.sensitivity_by_group, mouth: 2 },
    });
    tracking_hub.push_frame(face_frame(0, { jawOpen: 0.25 }));
    // Mouth open 0.25 above neutral 0; doubled sensitivity gives 0.5.
    expect(tracking_hub.snapshot().input_values.MouthOpen).toBeCloseTo(0.5);
  });

  it("uses the calibrated neutral face", () => {
    const { tracking_hub } = create_hub();
    tracking_hub.set_neutral_face({ BrowLeftY: 0.2 });
    tracking_hub.push_frame(face_frame(0, { browInnerUp: 0.4, browOuterUpLeft: 0.4, browOuterUpRight: 0.4 }));
    // Brows measured at 0.4 with a neutral of 0.2 read as 0.2 raised.
    expect(tracking_hub.snapshot().input_values.BrowLeftY).toBeCloseTo(0.2);
  });

  it("stretches each user's blink to a fully closed eye", () => {
    const { tracking_hub, advance_to } = create_hub();
    for (let frame_index = 0; frame_index < 30; frame_index += 1) {
      advance_to(frame_index * 33);
      tracking_hub.push_frame(face_frame(frame_index * 33, { eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05 }));
    }
    // A blink that MediaPipe only scores at 0.5 must still reach (nearly) zero openness.
    for (let frame_index = 30; frame_index < 36; frame_index += 1) {
      advance_to(frame_index * 33);
      tracking_hub.push_frame(face_frame(frame_index * 33, { eyeBlinkLeft: 0.5, eyeBlinkRight: 0.5 }));
    }
    expect(tracking_hub.snapshot().input_values.EyeOpenLeft).toBeLessThan(0.1);
  });
});

describe("TrackingHub hands", () => {
  const open_hand = {
    landmarks: Array.from({ length: 21 }, (_, point_index) => [0.3, point_index === 0 ? 0.6 : 0.4, 0] as [number, number, number]),
  };

  it("keeps a briefly lost hand, then reports it gone", () => {
    const { tracking_hub, advance_to } = create_hub();
    tracking_hub.push_frame({ ...face_frame(0, {}), hands: { left: open_hand, right: null, image_aspect_ratio: 4 / 3 } });
    expect(tracking_hub.snapshot().input_values.HandRightFound).toBeCloseTo(1);
    expect(tracking_hub.snapshot().hand_skeletons.Right?.points).toHaveLength(21);

    advance_to(100);
    tracking_hub.push_frame({ ...face_frame(100, {}), hands: { left: null, right: null, image_aspect_ratio: 4 / 3 } });
    expect(tracking_hub.snapshot().input_values.HandRightFound).toBeCloseTo(1);

    advance_to(1000);
    tracking_hub.push_frame({ ...face_frame(1000, {}), hands: { left: null, right: null, image_aspect_ratio: 4 / 3 } });
    expect(tracking_hub.snapshot().input_values.HandRightFound).toBe(0);
    expect(tracking_hub.snapshot().hand_skeletons.Right?.is_present).toBe(false);
  });

  it("tracks hands even while the face is hidden", () => {
    const { tracking_hub } = create_hub();
    const frame_without_face = { ...face_frame(0, {}), face_found: false, hands: { left: open_hand, right: null, image_aspect_ratio: 4 / 3 } };
    tracking_hub.push_frame(frame_without_face);
    expect(tracking_hub.snapshot().hand_skeletons.Right?.is_present).toBe(true);
  });
});

describe("OneEuroFilter", () => {
  it("smooths jitter on a still signal", () => {
    const filter = new OneEuroFilter(1, 0);
    let filtered_value = 0;
    for (let sample_index = 0; sample_index < 100; sample_index += 1) {
      filtered_value = filter.filter(sample_index % 2 === 0 ? 1 : -1, sample_index / 60);
    }
    expect(Math.abs(filtered_value)).toBeLessThan(0.2);
  });
});
