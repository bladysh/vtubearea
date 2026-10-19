import { create } from "zustand";
import { persist } from "zustand/middleware";
import { tracking_hub, webcam_tracking_session } from "../../../app/app_runtime";
import { app_config } from "../../../config/app_config";
import type { NeutralFace } from "../domain/face_calibration";
import { DEFAULT_TRACKING_SETTINGS, type SensitivityByGroup, type TrackingSettings } from "../domain/tracking_settings";
import { list_camera_devices, type CameraDevice, type CameraInfo } from "../infrastructure/webcam_camera";

export type TrackingSessionStatus = "stopped" | "starting" | "running" | "error";
export type CalibrationStatus = "idle" | "recording" | "done" | "no_face";

interface TrackingState {
  settings: TrackingSettings;
  neutral_face: NeutralFace | null;
  session_status: TrackingSessionStatus;
  error_message: string | null;
  camera_devices: CameraDevice[];
  /** Known after the camera starts: its limits and the mode it actually delivers. */
  camera_info: CameraInfo | null;
  calibration_status: CalibrationStatus;
  update_settings: (settings_patch: Partial<TrackingSettings>) => Promise<void>;
  set_sensitivity: (group: keyof SensitivityByGroup, value: number) => void;
  refresh_camera_devices: () => Promise<void>;
  start_tracking: () => Promise<void>;
  stop_tracking: () => void;
  calibrate: () => Promise<void>;
  reset_calibration: () => void;
}

export const useTrackingStore = create<TrackingState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_TRACKING_SETTINGS,
      neutral_face: null,
      session_status: "stopped",
      error_message: null,
      camera_devices: [],
      camera_info: null,
      calibration_status: "idle",

      update_settings: async (settings_patch) => {
        const previous_settings = get().settings;
        const next_settings = { ...previous_settings, ...settings_patch };
        set({ settings: next_settings });
        tracking_hub.update_settings(next_settings);
        if (next_settings.is_hand_tracking_enabled !== previous_settings.is_hand_tracking_enabled) {
          try {
            await webcam_tracking_session.set_hand_tracking_enabled(next_settings.is_hand_tracking_enabled);
          } catch (hand_error) {
            set({ settings: { ...next_settings, is_hand_tracking_enabled: false }, error_message: String(hand_error) });
            return;
          }
        }
        const is_camera_changed =
          next_settings.camera_device_id !== previous_settings.camera_device_id ||
          JSON.stringify(next_settings.camera_mode) !== JSON.stringify(previous_settings.camera_mode);
        if (is_camera_changed && webcam_tracking_session.is_running) await get().start_tracking();
      },

      set_sensitivity: (group, value) => {
        const settings = get().settings;
        void get().update_settings({ sensitivity_by_group: { ...settings.sensitivity_by_group, [group]: value } });
      },

      refresh_camera_devices: async () => {
        set({ camera_devices: await list_camera_devices() });
      },

      start_tracking: async () => {
        set({ session_status: "starting", error_message: null });
        try {
          await webcam_tracking_session.set_hand_tracking_enabled(get().settings.is_hand_tracking_enabled);
          const camera_mode = get().settings.camera_mode ?? app_config.camera;
          await webcam_tracking_session.start({
            device_id: get().settings.camera_device_id,
            width: camera_mode.width,
            height: camera_mode.height,
            frame_rate: camera_mode.frame_rate,
          });
          set({
            session_status: "running",
            camera_info: webcam_tracking_session.camera_info(),
            settings: { ...get().settings, is_enabled: true },
          });
          // Camera names become readable only after access was granted.
          await get().refresh_camera_devices();
        } catch (start_error) {
          webcam_tracking_session.stop();
          set({ session_status: "error", error_message: start_error instanceof Error ? start_error.message : String(start_error) });
        }
      },

      stop_tracking: () => {
        webcam_tracking_session.stop();
        set({ session_status: "stopped", camera_info: null, settings: { ...get().settings, is_enabled: false } });
      },

      calibrate: async () => {
        set({ calibration_status: "recording" });
        const neutral_face = await tracking_hub.calibrate(app_config.tracking.calibration_duration_ms);
        if (neutral_face) set({ neutral_face, calibration_status: "done" });
        else set({ calibration_status: "no_face" });
      },

      reset_calibration: () => {
        tracking_hub.set_neutral_face(null);
        set({ neutral_face: null, calibration_status: "idle" });
      },
    }),
    {
      name: "vtubearea.tracking",
      version: 2,
      // New settings fields get their defaults when older saved settings load.
      merge: (persisted_state, current_state) => {
        const saved_state = (persisted_state ?? {}) as Partial<TrackingState>;
        return { ...current_state, ...saved_state, settings: { ...DEFAULT_TRACKING_SETTINGS, ...saved_state.settings } };
      },
      migrate: (persisted_state) => persisted_state as TrackingState,
      partialize: (state) => ({ settings: state.settings, neutral_face: state.neutral_face }),
      onRehydrateStorage: () => (rehydrated_state) => {
        if (!rehydrated_state) return;
        tracking_hub.update_settings(rehydrated_state.settings);
        tracking_hub.set_neutral_face(rehydrated_state.neutral_face);
      },
    },
  ),
);
