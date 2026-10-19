import type { TrackingInputGroup } from "./tracking_inputs";

export type SensitivityByGroup = Record<Exclude<TrackingInputGroup, "other">, number>;

/** video: camera image with tracking points; tracking_only: points and outlines, no image; hidden: nothing. */
export type CameraPreviewMode = "video" | "tracking_only" | "hidden";

/** Requested camera mode; the camera may deliver the closest mode it supports. */
export interface CameraMode {
  width: number;
  height: number;
  frame_rate: number;
}

export interface TrackingSettings {
  is_enabled: boolean;
  camera_device_id: string | null;
  /** null = the default from config. */
  camera_mode: CameraMode | null;
  /** 0 = most responsive, 1 = smoothest. */
  smoothness: number;
  /** Same scale, for fingers only. */
  hand_smoothness: number;
  sensitivity_by_group: SensitivityByGroup;
  /** Avatar moves like a mirror reflection of the user. */
  is_mirrored: boolean;
  /** Same for hands, separately: off = the user's right hand is the avatar's right hand. */
  is_hand_mirrored: boolean;
  camera_preview_mode: CameraPreviewMode;
  is_hand_tracking_enabled: boolean;
  /** Close both eyes together unless one is clearly more closed (a wink). */
  is_eye_sync_enabled: boolean;
  /** Draw a hand behind the head when it is farther from the camera than the face. */
  is_hand_depth_enabled: boolean;
  /** How much farther than the face (cm) a hand must be to go behind the head. */
  hand_behind_head_threshold_centimeters: number;
}

export const CAMERA_RESOLUTION_PRESETS: readonly { width: number; height: number }[] = [
  { width: 640, height: 480 },
  { width: 960, height: 540 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
];
export const CAMERA_FRAME_RATE_PRESETS: readonly number[] = [15, 24, 30, 60];

export const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
  is_enabled: false,
  camera_device_id: null,
  camera_mode: null,
  smoothness: 0.5,
  hand_smoothness: 0.35,
  sensitivity_by_group: { head: 1, eyes: 1, mouth: 1, brows: 1 },
  is_mirrored: true,
  is_hand_mirrored: true,
  camera_preview_mode: "video",
  is_hand_tracking_enabled: false,
  is_eye_sync_enabled: true,
  is_hand_depth_enabled: true,
  hand_behind_head_threshold_centimeters: 6,
};
