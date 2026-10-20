import { useEffect } from "react";
import { useAvatarStore } from "../contexts/avatar/application/avatar_store";
import { useSceneStore } from "../contexts/scene/application/scene_store";
import { listen_click_through_changes, set_always_on_top } from "../contexts/scene/infrastructure/window_controls";
import { useSettingsStore } from "../contexts/settings/application/settings_store";
import { useTrackingStore } from "../contexts/tracking/application/tracking_store";
import { avatar_frame_composer } from "./app_runtime";
import { useHotkeyRouter } from "./hotkey_router";
import { useFaceGestureRouter } from "./use_face_gesture_router";

/** One-time startup work and global wiring between stores and runtime services. */
export function useAppBootstrap(): void {
  useEffect(() => {
    void useAvatarStore.getState().refresh_models();
    void useSceneStore.getState().refresh_media_library();
    void useTrackingStore.getState().refresh_camera_devices();
    void set_always_on_top(useSceneStore.getState().is_always_on_top);
    if (useTrackingStore.getState().settings.is_enabled) void useTrackingStore.getState().start_tracking();
    return listen_click_through_changes((is_enabled) => useSceneStore.getState().sync_click_through(is_enabled));
  }, []);

  useEffect(() => {
    const apply_idle_motion_settings = () => {
      const { is_auto_blink_enabled, is_breathing_enabled } = useSettingsStore.getState();
      avatar_frame_composer.set_idle_motion_settings({ is_auto_blink_enabled, is_breathing_enabled });
    };
    apply_idle_motion_settings();
    return useSettingsStore.subscribe(apply_idle_motion_settings);
  }, []);

  useEffect(() => {
    const apply_arm_options = () => {
      const { is_elbow_from_wrist_enabled, hand_style, arm_stretch_factor } = useTrackingStore.getState().settings;
      avatar_frame_composer.set_arm_options({ is_elbow_from_wrist_enabled, hand_preference: hand_style, arm_stretch_factor });
    };
    apply_arm_options();
    return useTrackingStore.subscribe(apply_arm_options);
  }, []);

  useHotkeyRouter();
  useFaceGestureRouter();
}
