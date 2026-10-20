import { Field, SegmentedControl, Section, SliderField, ToggleField, useTranslate } from "@vtubearea/ui";
import type { HandStyle } from "../domain/tracking_settings";
import { useTrackingStore } from "../application/tracking_store";
import { CameraPreview } from "./camera_preview";
import { HandCharts } from "./tracking_charts";

/** Switches with the live preview under them, then sliders, and charts at the bottom. */
/** Run hands on every frame, every second or every third camera frame. */
const HAND_FRAME_INTERVALS = [1, 2, 3] as const;

export function HandsTab() {
  const translate = useTranslate();
  const settings = useTrackingStore((state) => state.settings);
  const is_running = useTrackingStore((state) => state.session_status === "running");
  const update_settings = useTrackingStore((state) => state.update_settings);
  const is_enabled = settings.is_hand_tracking_enabled;

  return (
    <>
      <Section title={translate("tracking.hands")}>
        <ToggleField
          label={translate("tracking.hands")}
          hint={translate("tracking.hands_hint")}
          is_checked={is_enabled}
          on_change={(is_hand_tracking_enabled) => void update_settings({ is_hand_tracking_enabled })}
        />
        {is_enabled && (
          <>
            <ToggleField
              label={translate("tracking.hand_mirror")}
              hint={translate("tracking.hand_mirror_hint")}
              is_checked={settings.is_hand_mirrored}
              on_change={(is_hand_mirrored) => void update_settings({ is_hand_mirrored })}
            />
            <ToggleField
              label={translate("tracking.elbow_from_wrist")}
              hint={translate("tracking.elbow_from_wrist_hint")}
              is_checked={settings.is_elbow_from_wrist_enabled}
              on_change={(is_elbow_from_wrist_enabled) => void update_settings({ is_elbow_from_wrist_enabled })}
            />
            <ToggleField
              label={translate("tracking.hand_depth_enabled")}
              hint={translate("tracking.hand_depth_hint")}
              is_checked={settings.is_hand_depth_enabled}
              on_change={(is_hand_depth_enabled) => void update_settings({ is_hand_depth_enabled })}
            />
            <Field
              label={translate("tracking.hand_style")}
              hint={translate("tracking.hand_style_hint")}
              is_stacked
              control={
                <SegmentedControl<HandStyle>
                  label={translate("tracking.hand_style")}
                  value={settings.hand_style}
                  options={[
                    { value: "auto", label: translate("tracking.hand_style_auto") },
                    { value: "drawn", label: translate("tracking.hand_style_drawn") },
                    { value: "model_art", label: translate("tracking.hand_style_model_art") },
                  ]}
                  on_change={(hand_style) => void update_settings({ hand_style })}
                />
              }
            />
          </>
        )}
        {is_enabled && is_running && settings.camera_preview_mode !== "hidden" && (
          <CameraPreview is_mirrored={settings.is_mirrored} shows_video={settings.camera_preview_mode === "video"} />
        )}
      </Section>

      {is_enabled && (
        <Section title={translate("tracking.response")}>
          <Field
            label={translate("tracking.hand_frame_interval")}
            hint={translate("tracking.hand_frame_interval_hint")}
            is_stacked
            control={
              <SegmentedControl<string>
                label={translate("tracking.hand_frame_interval")}
                value={String(settings.hand_frame_interval)}
                options={HAND_FRAME_INTERVALS.map((frame_interval) => ({
                  value: String(frame_interval),
                  label: translate(`tracking.hand_frame_interval.${frame_interval}`),
                }))}
                on_change={(frame_interval) => void update_settings({ hand_frame_interval: Number(frame_interval) })}
              />
            }
          />
          <SliderField
            label={translate("tracking.hand_smoothness")}
            hint={translate("tracking.hand_smoothness_hint")}
            value={settings.hand_smoothness}
            minimum={0}
            maximum={1}
            format_value={(value) => `${Math.round(value * 100)}%`}
            on_change={(hand_smoothness) => void update_settings({ hand_smoothness })}
          />
          <SliderField
            label={translate("tracking.arm_stretch")}
            hint={translate("tracking.arm_stretch_hint")}
            value={settings.arm_stretch_factor}
            minimum={0}
            maximum={2}
            step={0.05}
            format_value={(value) => `${Math.round(value * 100)}%`}
            on_change={(arm_stretch_factor) => void update_settings({ arm_stretch_factor })}
          />
          {settings.is_hand_depth_enabled && (
            <SliderField
              label={translate("tracking.hand_depth_threshold")}
              hint={translate("tracking.hand_depth_threshold_hint")}
              value={settings.hand_behind_head_threshold_centimeters}
              minimum={1}
              maximum={20}
              step={0.5}
              format_value={(value) => `${value.toFixed(1)} cm`}
              on_change={(hand_behind_head_threshold_centimeters) => void update_settings({ hand_behind_head_threshold_centimeters })}
            />
          )}
        </Section>
      )}

      {is_enabled && (
        <Section title={translate("charts.hand_monitor")}>
          <HandCharts />
        </Section>
      )}

      <Section title={translate("tracking.hands_tips")}>
        <p className="vta-field__hint">{translate("tracking.hands_tips_text")}</p>
      </Section>
    </>
  );
}
