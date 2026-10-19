import { quaternion_to_head_angles, type FaceFrame } from "@vtubearea/protocol";

/**
 * Derived tracking inputs. Names match VTube Studio inputs so its parameter
 * settings can be imported later. Raw ARKit blendshape names are valid inputs too.
 */
export const DERIVED_TRACKING_INPUT_NAMES = [
  "FaceAngleX",
  "FaceAngleY",
  "FaceAngleZ",
  "FacePositionX",
  "FacePositionY",
  "FacePositionZ",
  "EyeOpenLeft",
  "EyeOpenRight",
  "EyeLeftX",
  "EyeLeftY",
  "EyeRightX",
  "EyeRightY",
  "MouthOpen",
  "MouthSmile",
  "MouthX",
  "BrowLeftY",
  "BrowRightY",
  "CheekPuff",
  "TongueOut",
] as const;

export type DerivedTrackingInputName = (typeof DERIVED_TRACKING_INPUT_NAMES)[number];
export type TrackingInputValues = Record<string, number>;

export type TrackingInputGroup = "head" | "eyes" | "mouth" | "brows" | "other";

interface TrackingInputBehavior {
  group: TrackingInputGroup;
  /** Value of a relaxed face looking at the camera. Sensitivity scales around it. */
  neutral_value: number;
  /** Typical magnitude, so one filter setting fits degrees and 0..1 values alike. */
  typical_range: number;
  /** offset: calibrated value becomes neutral by subtraction; scale: by division. */
  calibration: "offset" | "scale" | "none";
  /** Multiplies filter speed: blinks and mouth need to react faster than head turns. */
  responsiveness: number;
}

const head_angle_behavior: TrackingInputBehavior = { group: "head", neutral_value: 0, typical_range: 30, calibration: "offset", responsiveness: 1 };
const head_position_behavior: TrackingInputBehavior = { group: "head", neutral_value: 0, typical_range: 10, calibration: "offset", responsiveness: 1 };
// Eye openness is normalized per user by AdaptiveRange in the hub, so calibration skips it.
const eye_open_behavior: TrackingInputBehavior = { group: "eyes", neutral_value: 1, typical_range: 1, calibration: "none", responsiveness: 4 };
const gaze_behavior: TrackingInputBehavior = { group: "eyes", neutral_value: 0, typical_range: 1, calibration: "offset", responsiveness: 1.5 };
const mouth_behavior: TrackingInputBehavior = { group: "mouth", neutral_value: 0, typical_range: 1, calibration: "none", responsiveness: 2.5 };
const brow_behavior: TrackingInputBehavior = { group: "brows", neutral_value: 0, typical_range: 1, calibration: "offset", responsiveness: 1.5 };
const other_behavior: TrackingInputBehavior = { group: "other", neutral_value: 0, typical_range: 1, calibration: "none", responsiveness: 1 };

const behavior_by_input: Record<DerivedTrackingInputName, TrackingInputBehavior> = {
  FaceAngleX: head_angle_behavior,
  FaceAngleY: head_angle_behavior,
  FaceAngleZ: head_angle_behavior,
  FacePositionX: head_position_behavior,
  FacePositionY: head_position_behavior,
  FacePositionZ: head_position_behavior,
  EyeOpenLeft: eye_open_behavior,
  EyeOpenRight: eye_open_behavior,
  EyeLeftX: gaze_behavior,
  EyeLeftY: gaze_behavior,
  EyeRightX: gaze_behavior,
  EyeRightY: gaze_behavior,
  MouthOpen: mouth_behavior,
  MouthSmile: mouth_behavior,
  MouthX: mouth_behavior,
  BrowLeftY: brow_behavior,
  BrowRightY: brow_behavior,
  CheekPuff: mouth_behavior,
  TongueOut: mouth_behavior,
};

export function tracking_input_behavior(input_name: string): TrackingInputBehavior {
  return behavior_by_input[input_name as DerivedTrackingInputName] ?? other_behavior;
}

const METERS_TO_CENTIMETERS = 100;
/** Eyes closer than this are treated as one blink (MediaPipe often closes one eye less); a real wink differs more. */
const EYE_SYNC_THRESHOLD = 0.25;
/** Share of "looking down" that MediaPipe adds to the blink value of an open eye. */
const LOOK_DOWN_BLINK_SHARE = 0.5;

/**
 * Derives VTube Studio style inputs from a frame. Without mirroring the avatar copies
 * the camera picture; with is_mirrored it moves like the user's reflection.
 * Results: FaceAngleX positive = avatar turns toward the viewer's right,
 * FaceAngleY positive = looks up, FaceAngleZ positive = head top leans to the viewer's right.
 */
export function derive_tracking_inputs(face_frame: FaceFrame, is_mirrored: boolean, is_eye_sync_enabled = true): TrackingInputValues {
  const blendshapes = face_frame.blendshapes;
  const blendshape = (name: keyof typeof blendshapes) => blendshapes[name] ?? 0;
  const head_angles = quaternion_to_head_angles(face_frame.head.rotation_quaternion);
  const [position_x, position_y, position_z] = face_frame.head.position_meters;
  const mirror_sign = is_mirrored ? -1 : 1;

  // Blendshape names follow ARKit: "Left" is the user's own left eye (on the camera image's right).
  // Looking down lowers the lids and reads as a half blink, so part of it is taken back out.
  const blink = (side: "Left" | "Right") =>
    Math.max(0, blendshape(`eyeBlink${side}`) - LOOK_DOWN_BLINK_SHARE * blendshape(`eyeLookDown${side}`));
  let user_left_eye_open = 1 - blink("Left") + 0.5 * blendshape("eyeWideLeft");
  let user_right_eye_open = 1 - blink("Right") + 0.5 * blendshape("eyeWideRight");
  if (is_eye_sync_enabled && Math.abs(user_left_eye_open - user_right_eye_open) < EYE_SYNC_THRESHOLD) {
    user_left_eye_open = user_right_eye_open = (user_left_eye_open + user_right_eye_open) / 2;
  }
  // Gaze: positive x = eyes move to the camera's right, positive y = up.
  const user_left_gaze_x = blendshape("eyeLookOutLeft") - blendshape("eyeLookInLeft");
  const user_right_gaze_x = blendshape("eyeLookInRight") - blendshape("eyeLookOutRight");
  const user_left_gaze_y = blendshape("eyeLookUpLeft") - blendshape("eyeLookDownLeft");
  const user_right_gaze_y = blendshape("eyeLookUpRight") - blendshape("eyeLookDownRight");
  const user_left_brow = (blendshape("browInnerUp") + blendshape("browOuterUpLeft")) / 2 - blendshape("browDownLeft");
  const user_right_brow = (blendshape("browInnerUp") + blendshape("browOuterUpRight")) / 2 - blendshape("browDownRight");

  // "Left" outputs drive the avatar eye on the viewer's left. Mirrored, that is the user's own left
  // eye (a reflection keeps sides); unmirrored the camera picture is copied, where it is the right eye.
  const [left_eye_open, right_eye_open] = is_mirrored ? [user_left_eye_open, user_right_eye_open] : [user_right_eye_open, user_left_eye_open];
  const [left_gaze_x, right_gaze_x] = is_mirrored ? [user_left_gaze_x, user_right_gaze_x] : [user_right_gaze_x, user_left_gaze_x];
  const [left_gaze_y, right_gaze_y] = is_mirrored ? [user_left_gaze_y, user_right_gaze_y] : [user_right_gaze_y, user_left_gaze_y];
  const [left_brow, right_brow] = is_mirrored ? [user_left_brow, user_right_brow] : [user_right_brow, user_left_brow];

  const derived_inputs: Record<DerivedTrackingInputName, number> = {
    FaceAngleX: head_angles.yaw * mirror_sign,
    FaceAngleY: -head_angles.pitch,
    FaceAngleZ: -head_angles.roll * mirror_sign,
    FacePositionX: position_x * METERS_TO_CENTIMETERS * mirror_sign,
    FacePositionY: position_y * METERS_TO_CENTIMETERS,
    FacePositionZ: position_z * METERS_TO_CENTIMETERS,
    EyeOpenLeft: left_eye_open,
    EyeOpenRight: right_eye_open,
    EyeLeftX: left_gaze_x * mirror_sign,
    EyeLeftY: left_gaze_y,
    EyeRightX: right_gaze_x * mirror_sign,
    EyeRightY: right_gaze_y,
    MouthOpen: Math.max(0, blendshape("jawOpen") - 0.5 * blendshape("mouthClose")),
    MouthSmile:
      (blendshape("mouthSmileLeft") + blendshape("mouthSmileRight")) / 2 -
      (blendshape("mouthFrownLeft") + blendshape("mouthFrownRight")) / 2,
    MouthX: (blendshape("mouthRight") - blendshape("mouthLeft")) * mirror_sign,
    BrowLeftY: left_brow,
    BrowRightY: right_brow,
    CheekPuff: blendshape("cheekPuff"),
    TongueOut: blendshape("tongueOut"),
  };
  return { ...blendshapes, ...derived_inputs };
}
