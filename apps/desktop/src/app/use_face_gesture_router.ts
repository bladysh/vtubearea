import { useEffect } from "react";
import { expression_playback_for, useAvatarStore } from "../contexts/avatar/application/avatar_store";
import { FaceGestureDetector } from "../contexts/avatar/domain/face_gesture";
import { avatar_control, tracking_hub } from "./app_runtime";

/** How often face gestures are checked; fast enough for a wink, light on the CPU. */
const CHECK_INTERVAL_MS = 50;

/**
 * Starts expressions from face gestures. A toggling trigger works like the expression's key; a
 * while-held trigger keeps the expression on as long as the gesture lasts and lets go with it.
 */
export function useFaceGestureRouter(): void {
  useEffect(() => {
    const detector = new FaceGestureDetector();
    let last_check_ms = performance.now();
    const timer = setInterval(() => {
      const now_ms = performance.now();
      const { is_face_found, input_values } = tracking_hub.snapshot();
      const { started, ended } = detector.update(input_values, is_face_found, (now_ms - last_check_ms) / 1000, useAvatarStore.getState().gesture_thresholds);
      last_check_ms = now_ms;
      if (started.length === 0 && ended.length === 0) return;
      const avatar_state = useAvatarStore.getState();
      const model_triggers = avatar_state.active_model_id ? avatar_state.expression_gestures_by_model[avatar_state.active_model_id] ?? {} : {};
      const model_expression_ids = new Set(avatar_state.loaded_model?.model_definition.expressions.map((expression) => expression.id) ?? []);
      for (const [expression_id, trigger] of Object.entries(model_triggers)) {
        if (!model_expression_ids.has(expression_id)) continue;
        if (trigger.mode === "toggle") {
          if (started.includes(trigger.gesture)) avatar_state.toggle_expression(expression_id);
        } else if (started.includes(trigger.gesture)) {
          avatar_state.set_expression(expression_id, { ...expression_playback_for(avatar_state, expression_id), mode: "hold" });
        } else if (ended.includes(trigger.gesture) && avatar_control.get_active_expression_id() === expression_id) {
          avatar_state.set_expression(null);
        }
      }
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
}
