import { Section, ToggleField, useTranslate } from "@vtubearea/ui";
import { useSettingsStore } from "../../settings/application/settings_store";

export function IdleMotionSection() {
  const translate = useTranslate();
  const is_auto_blink_enabled = useSettingsStore((state) => state.is_auto_blink_enabled);
  const is_breathing_enabled = useSettingsStore((state) => state.is_breathing_enabled);
  const update_settings = useSettingsStore((state) => state.update_settings);

  return (
    <Section title={translate("tracking.idle_motion")}>
      <ToggleField
        label={translate("tracking.auto_blink")}
        hint={translate("tracking.auto_blink_hint")}
        is_checked={is_auto_blink_enabled}
        on_change={(is_enabled) => update_settings({ is_auto_blink_enabled: is_enabled })}
      />
      <ToggleField
        label={translate("tracking.breathing")}
        hint={translate("tracking.breathing_hint")}
        is_checked={is_breathing_enabled}
        on_change={(is_enabled) => update_settings({ is_breathing_enabled: is_enabled })}
      />
    </Section>
  );
}
