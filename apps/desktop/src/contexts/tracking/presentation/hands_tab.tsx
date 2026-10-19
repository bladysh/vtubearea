import { Section, SliderField, ToggleField, useTranslate } from "@vtubearea/ui";
import { useTrackingStore } from "../application/tracking_store";
import { CameraPreview } from "./camera_preview";
import { HandCharts } from "./tracking_charts";

export function HandsTab() {
  const translate = useTranslate();
  const settings = useTrackingStore((state) => state.settings);
  const is_running = useTrackingStore((state) => state.session_status === "running");
  const update_settings = useTrackingStore((state) => state.update_settings);

  return (
    <>
      <Section title={translate("tracking.hands")}>
        <ToggleField
          label={translate("tracking.hands")}
          hint={translate("tracking.hands_hint")}
          is_checked={settings.is_hand_tracking_enabled}
          on_change={(is_enabled) => void update_settings({ is_hand_tracking_enabled: is_enabled })}
        />
        {is_running && settings.is_hand_tracking_enabled && settings.camera_preview_mode !== "hidden" && (
          <CameraPreview is_mirrored={settings.is_mirrored} shows_video={settings.camera_preview_mode === "video"} />
        )}
        <ToggleField
          label={translate("tracking.hand_mirror")}
          hint={translate("tracking.hand_mirror_hint")}
          is_checked={settings.is_hand_mirrored}
          on_change={(is_hand_mirrored) => void update_settings({ is_hand_mirrored })}
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
      </Section>
      {settings.is_hand_tracking_enabled && (
        <Section title={translate("tracking.hand_depth")}>
          <ToggleField
            label={translate("tracking.hand_depth_enabled")}
            hint={translate("tracking.hand_depth_hint")}
            is_checked={settings.is_hand_depth_enabled}
            on_change={(is_enabled) => void update_settings({ is_hand_depth_enabled: is_enabled })}
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
      {settings.is_hand_tracking_enabled && (
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
