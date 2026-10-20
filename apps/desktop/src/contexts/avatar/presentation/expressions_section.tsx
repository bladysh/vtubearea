import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ModelExpression } from "@vtubearea/model-format";
import { Play, Square } from "lucide-react";
import { Button, Field, SegmentedControl, Section, SliderField, useTranslate } from "@vtubearea/ui";
import { avatar_control } from "../../../app/app_runtime";
import { are_global_shortcuts_supported } from "../../../shared/global_shortcuts";
import type { HotkeyBinding } from "../../../shared/hotkey";
import { HotkeyBindingEditor } from "../../../shared/hotkey_binding_editor";
import { usePolledValue } from "../../../shared/use_polled_value";
import { useSettingsStore } from "../../settings/application/settings_store";
import { expression_playback_for, useAvatarStore } from "../application/avatar_store";
import type { ExpressionPlaybackMode } from "../domain/expression_mixer";
import { FACE_GESTURES, type FaceGesture, type GestureTrigger, type GestureTriggerMode } from "../domain/face_gesture";

// Stable empty values: a fresh [] or {} in a selector would re-render forever.
const NO_EXPRESSIONS: ModelExpression[] = [];
const NO_BINDINGS: Record<string, HotkeyBinding | undefined> = {};
const NO_GESTURES: Record<string, GestureTrigger | undefined> = {};
const NO_GESTURE = "none";

export function ExpressionsSection() {
  const translate = useTranslate();
  const expressions = useAvatarStore((state) => state.loaded_model?.model_definition.expressions ?? NO_EXPRESSIONS);
  const expression_bindings = useAvatarStore((state) =>
    state.active_model_id ? (state.expression_hotkeys_by_model[state.active_model_id] ?? NO_BINDINGS) : NO_BINDINGS,
  );
  const playback_state = useAvatarStore(
    useShallow((state) => ({ active_model_id: state.active_model_id, expression_playback_by_model: state.expression_playback_by_model })),
  );
  const expression_gestures = useAvatarStore((state) =>
    state.active_model_id ? (state.expression_gestures_by_model[state.active_model_id] ?? NO_GESTURES) : NO_GESTURES,
  );
  const set_expression_gesture = useAvatarStore((state) => state.set_expression_gesture);
  const set_expression_gesture_mode = useAvatarStore((state) => state.set_expression_gesture_mode);
  const gesture_mode_options: { value: GestureTriggerMode; label: string }[] = [
    { value: "while_held", label: translate("expressions.gesture_mode.while_held") },
    { value: "toggle", label: translate("expressions.gesture_mode.toggle") },
  ];
  const toggle_expression = useAvatarStore((state) => state.toggle_expression);
  const set_expression_hotkey = useAvatarStore((state) => state.set_expression_hotkey);
  const set_expression_playback = useAvatarStore((state) => state.set_expression_playback);
  const hotkey_errors = useSettingsStore((state) => state.hotkey_errors);
  // Live: "once" expressions end on their own.
  const read_active_expression = useCallback(() => avatar_control.get_active_expression_id(), []);
  const active_expression_id = usePolledValue(read_active_expression, 120);

  const gesture_options: { value: FaceGesture | typeof NO_GESTURE; label: string }[] = [
    { value: NO_GESTURE, label: translate("expressions.gesture.none") },
    ...FACE_GESTURES.map((gesture) => ({ value: gesture, label: translate(`expressions.gesture.${gesture}`) })),
  ];
  const mode_options: { value: ExpressionPlaybackMode; label: string }[] = [
    { value: "once", label: translate("expressions.mode.once") },
    { value: "hold", label: translate("expressions.mode.hold") },
    { value: "loop", label: translate("expressions.mode.loop") },
  ];

  if (expressions.length === 0) {
    return (
      <Section>
        <p className="vta-field__hint">{translate("models.no_expressions")}</p>
      </Section>
    );
  }
  return (
    <>
      {expressions.map((expression) => {
        const is_active = expression.id === active_expression_id;
        const binding = expression_bindings[expression.id] ?? null;
        const playback = expression_playback_for(playback_state, expression.id);
        return (
          <Section
            key={expression.id}
            title={expression.display_name}
            actions={
              <Button
                size="small"
                variant={is_active ? "primary" : "secondary"}
                aria-pressed={is_active}
                icon={is_active ? <Square size={14} /> : <Play size={14} />}
                onClick={() => toggle_expression(expression.id)}
              >
                {translate(is_active ? "expressions.stop" : "expressions.play")}
              </Button>
            }
          >
            {/* Two ways to start it: a key, a face gesture, or both. */}
            <HotkeyBindingEditor
              label={translate("expressions.trigger_key")}
              binding={binding}
              allow_plain_keys
              error_message={binding?.is_global ? hotkey_errors[binding.hotkey_text] : undefined}
              on_change={(next_binding) => set_expression_hotkey(expression.id, next_binding)}
            />
            {/* Same row layout as the key above, so both triggers line up. */}
            <Field
              label={translate("expressions.trigger_gesture")}
              hint={translate("expressions.trigger_gesture_hint")}
              control={
                <select
                  className="vta-select expression-card__gesture"
                  aria-label={translate("expressions.trigger_gesture")}
                  value={expression_gestures[expression.id]?.gesture ?? NO_GESTURE}
                  onChange={(change_event) => {
                    const gesture = change_event.target.value as FaceGesture | typeof NO_GESTURE;
                    set_expression_gesture(expression.id, gesture === NO_GESTURE ? null : gesture);
                  }}
                >
                  {gesture_options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              }
            />
            {expression_gestures[expression.id] && (
              <SegmentedControl
                label={translate("expressions.gesture_mode")}
                value={expression_gestures[expression.id]!.mode}
                options={gesture_mode_options}
                on_change={(mode) => set_expression_gesture_mode(expression.id, mode)}
              />
            )}
            <SegmentedControl
              label={translate("expressions.mode")}
              value={playback.mode}
              options={mode_options}
              on_change={(mode) => set_expression_playback(expression.id, { ...playback, mode })}
            />
            {playback.mode === "loop" && (
              <SliderField
                label={translate("expressions.repeat_count")}
                hint={translate("expressions.repeat_count_hint")}
                value={playback.repeat_count ?? 0}
                minimum={0}
                maximum={20}
                step={1}
                format_value={(value) => (value === 0 ? "∞" : `×${value}`)}
                on_change={(repeat_count) => set_expression_playback(expression.id, { ...playback, repeat_count })}
              />
            )}
            {playback.mode !== "hold" && (
              <SliderField
                label={translate("expressions.duration")}
                hint={translate("expressions.duration_hint")}
                value={playback.hold_seconds}
                minimum={0.3}
                maximum={10}
                step={0.1}
                format_value={(value) => `${value.toFixed(1)} s`}
                on_change={(hold_seconds) => set_expression_playback(expression.id, { ...playback, hold_seconds })}
              />
            )}
          </Section>
        );
      })}
      <p className="vta-field__hint">{translate("models.expressions_hint")}</p>
      {are_global_shortcuts_supported && <p className="vta-field__hint">{translate("hotkeys.global_hint")}</p>}
    </>
  );
}
