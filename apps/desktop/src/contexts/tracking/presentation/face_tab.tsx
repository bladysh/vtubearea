import { Crosshair } from "lucide-react";
import { Badge, Button, Section, SliderField, ToggleField, useTranslate } from "@vtubearea/ui";
import { format_hotkey } from "../../../shared/hotkey";
import { useEffectiveHotkey } from "../../settings/application/settings_store";
import { useTrackingStore } from "../application/tracking_store";
import type { SensitivityByGroup } from "../domain/tracking_settings";
import { FaceCharts } from "./tracking_charts";

const SENSITIVITY_GROUPS: readonly (keyof SensitivityByGroup)[] = ["head", "eyes", "mouth", "brows"];

export function FaceTab() {
  const translate = useTranslate();
  const settings = useTrackingStore((state) => state.settings);
  const is_running = useTrackingStore((state) => state.session_status === "running");
  const calibration_status = useTrackingStore((state) => state.calibration_status);
  const has_neutral_face = useTrackingStore((state) => state.neutral_face !== null);
  const update_settings = useTrackingStore((state) => state.update_settings);
  const set_sensitivity = useTrackingStore((state) => state.set_sensitivity);
  const calibrate = useTrackingStore((state) => state.calibrate);
  const reset_calibration = useTrackingStore((state) => state.reset_calibration);
  const calibrate_hotkey = useEffectiveHotkey("calibrate");

  return (
    <>
      <Section title={translate("charts.face_monitor")}>
        <FaceCharts />
      </Section>

      <Section title={translate("tracking.calibration")}>
        <p className="vta-field__hint">{translate("tracking.calibration_hint", { hotkey: format_hotkey(calibrate_hotkey) })}</p>
        <div className="button-row">
          <Button
            variant="primary"
            icon={<Crosshair size={16} />}
            disabled={!is_running || calibration_status === "recording"}
            onClick={() => void calibrate()}
          >
            {translate(calibration_status === "recording" ? "tracking.calibrating" : "tracking.calibrate")}
          </Button>
          <Button variant="ghost" disabled={!has_neutral_face} onClick={reset_calibration}>
            {translate("common.reset")}
          </Button>
        </div>
        {calibration_status === "done" && <Badge tone="success">{translate("tracking.calibration_done")}</Badge>}
        {calibration_status === "no_face" && <Badge tone="danger">{translate("tracking.calibration_no_face")}</Badge>}
      </Section>

      <Section title={translate("tracking.response")}>
        <SliderField
          label={translate("tracking.smoothness")}
          hint={translate("tracking.smoothness_hint")}
          value={settings.smoothness}
          minimum={0}
          maximum={1}
          format_value={(value) => `${Math.round(value * 100)}%`}
          on_change={(smoothness) => void update_settings({ smoothness })}
        />
        <ToggleField
          label={translate("tracking.eye_sync")}
          hint={translate("tracking.eye_sync_hint")}
          is_checked={settings.is_eye_sync_enabled}
          on_change={(is_enabled) => void update_settings({ is_eye_sync_enabled: is_enabled })}
        />
      </Section>

      <Section title={translate("tracking.sensitivity")}>
        {SENSITIVITY_GROUPS.map((group) => (
          <SliderField
            key={group}
            label={translate(`tracking.sensitivity.${group}`)}
            hint={translate("tracking.sensitivity_hint")}
            value={settings.sensitivity_by_group[group]}
            minimum={0.2}
            maximum={3}
            format_value={(value) => `×${value.toFixed(2)}`}
            on_change={(value) => set_sensitivity(group, value)}
          />
        ))}
      </Section>
    </>
  );
}
