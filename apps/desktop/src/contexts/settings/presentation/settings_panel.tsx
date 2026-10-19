import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Info, Keyboard, RotateCcw, Settings2 } from "lucide-react";
import { Button, Field, Panel, Section, SelectField, SliderField, TabBar, ToggleField, useTranslate, type Locale } from "@vtubearea/ui";
import { app_config } from "../../../config/app_config";
import { is_desktop_runtime, is_mac_platform } from "../../../shared/platform";
import { HotkeyBindingEditor } from "../../../shared/hotkey_binding_editor";
import { effective_app_hotkey, useActiveTab, useSettingsStore } from "../application/settings_store";
import { HOTKEY_ACTIONS } from "../domain/app_settings";

const SETTINGS_TABS = ["general", "hotkeys", "about"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export function SettingsPanel() {
  const translate = useTranslate();
  const [active_tab, set_active_tab] = useActiveTab<SettingsTab>("settings", SETTINGS_TABS);
  const tab_options = [
    { value: "general" as const, label: translate("settings.tab.general"), icon: <Settings2 size={14} /> },
    { value: "hotkeys" as const, label: translate("settings.tab.hotkeys"), icon: <Keyboard size={14} /> },
    { value: "about" as const, label: translate("settings.tab.about"), icon: <Info size={14} /> },
  ];

  return (
    <Panel
      title={translate("settings.title")}
      subtitle={translate("settings.subtitle")}
      toolbar={<TabBar label={translate("settings.title")} value={active_tab} options={tab_options} on_change={set_active_tab} />}
    >
      {active_tab === "general" && <GeneralTab />}
      {active_tab === "hotkeys" && <HotkeysTab />}
      {active_tab === "about" && <AboutTab />}
    </Panel>
  );
}

function GeneralTab() {
  const translate = useTranslate();
  const locale = useSettingsStore((state) => state.locale);
  const max_frames_per_second = useSettingsStore((state) => state.max_frames_per_second);
  const is_debug_overlay_visible = useSettingsStore((state) => state.is_debug_overlay_visible);
  const update_settings = useSettingsStore((state) => state.update_settings);

  return (
    <Section>
      <SelectField
        label={translate("settings.language")}
        value={locale}
        options={LOCALE_OPTIONS}
        on_change={(next_locale) => update_settings({ locale: next_locale })}
      />
      <SliderField
        label={translate("settings.max_fps")}
        hint={translate("settings.max_fps_hint")}
        value={max_frames_per_second}
        minimum={15}
        maximum={144}
        step={1}
        format_value={(value) => `${value} FPS`}
        on_change={(value) => update_settings({ max_frames_per_second: value })}
      />
      <ToggleField
        label={translate("settings.debug_overlay")}
        hint={translate("settings.debug_overlay_hint")}
        is_checked={is_debug_overlay_visible}
        on_change={(is_visible) => update_settings({ is_debug_overlay_visible: is_visible })}
      />
    </Section>
  );
}

function HotkeysTab() {
  const translate = useTranslate();
  const app_hotkeys = useSettingsStore((state) => state.app_hotkeys);
  const hotkey_errors = useSettingsStore((state) => state.hotkey_errors);
  const set_app_hotkey = useSettingsStore((state) => state.set_app_hotkey);

  return (
    <Section>
      {HOTKEY_ACTIONS.map((action) => {
        const binding = effective_app_hotkey(action, app_hotkeys);
        return (
          <HotkeyBindingEditor
            key={action}
            label={translate(`settings.hotkey.${action}`)}
            binding={binding}
            has_default
            is_custom={app_hotkeys[action] !== undefined}
            error_message={binding.is_global ? hotkey_errors[binding.hotkey_text] : undefined}
            on_change={(next_binding) => set_app_hotkey(action, next_binding)}
          />
        );
      })}
      <p className="vta-field__hint">{translate(is_mac_platform ? "settings.hotkeys_hint_mac" : "settings.hotkeys_hint")}</p>
    </Section>
  );
}

function AboutTab() {
  const translate = useTranslate();
  const reset_settings = useSettingsStore((state) => state.reset_settings);
  const [models_folder, set_models_folder] = useState<string | null>(null);

  useEffect(() => {
    if (is_desktop_runtime) void invoke<string>("get_models_folder").then(set_models_folder);
  }, []);

  return (
    <>
      {models_folder && (
        <Section title={translate("settings.storage")}>
          <Field label={translate("settings.models_folder")} is_stacked control={<code className="path-text">{models_folder}</code>} />
          <p className="vta-field__hint">{translate("settings.storage_hint")}</p>
        </Section>
      )}
      <Section title={translate("settings.about")}>
        <div className="about-card">
          <img className="about-card__logo" src="/logo.png" alt="" draggable={false} />
          <div>
            <div className="about-card__name">vTubeArea</div>
            <div className="about-card__version">
              {translate("settings.version", { version: app_config.app.version })} · {translate("settings.stage_beta")}
            </div>
          </div>
        </div>
        <Field label={translate("settings.authors")} value_label={app_config.app.authors.join(" & ")} control={null} />
        <p className="vta-field__hint">{translate("settings.about_text")}</p>
        <Button variant="danger" icon={<RotateCcw size={16} />} onClick={reset_settings}>
          {translate("settings.reset_all")}
        </Button>
      </Section>
    </>
  );
}
