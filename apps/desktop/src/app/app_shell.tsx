import { Eye, Upload } from "lucide-react";
import { I18nProvider, IconButton, create_translator } from "@vtubearea/ui";
import { GesturesTab } from "../contexts/avatar/presentation/gestures_tab";
import { IdleMotionSection } from "../contexts/avatar/presentation/idle_motion_section";
import { ModelsPanel } from "../contexts/avatar/presentation/models_panel";
import { ParameterMappingEditor } from "../contexts/avatar/presentation/parameter_mapping_editor";
import { DebugOverlay } from "../contexts/debug/presentation/debug_overlay";
import { ScenePanel } from "../contexts/scene/presentation/scene_panel";
import { StageViewport } from "../contexts/scene/presentation/stage_viewport";
import { useEffectiveHotkey, useSettingsStore } from "../contexts/settings/application/settings_store";
import { SettingsPanel } from "../contexts/settings/presentation/settings_panel";
import { TrackingPanel } from "../contexts/tracking/presentation/tracking_panel";
import { format_hotkey } from "../shared/hotkey";
import { TopBar } from "./top_bar";
import { useAppBootstrap } from "./use_app_bootstrap";
import { useFileDropImport } from "./use_file_drop_import";
import "./app_shell.css";

function ActivePanel() {
  const active_panel = useSettingsStore((state) => state.active_panel);
  switch (active_panel) {
    case "models":
      return <ModelsPanel />;
    case "tracking":
      return <TrackingPanel gestures_tab={<GesturesTab />} motion_tab={<IdleMotionSection />} mapping_tab={<ParameterMappingEditor />} />;
    case "scene":
      return <ScenePanel />;
    case "settings":
      return <SettingsPanel />;
  }
}

export function AppShell() {
  useAppBootstrap();
  const is_dragging_file = useFileDropImport();
  const locale = useSettingsStore((state) => state.locale);
  const is_interface_hidden = useSettingsStore((state) => state.is_interface_hidden);
  const is_debug_overlay_visible = useSettingsStore((state) => state.is_debug_overlay_visible);
  const toggle_interface = useSettingsStore((state) => state.toggle_interface);
  const toggle_interface_hotkey = useEffectiveHotkey("toggle_interface");
  const translate = create_translator(locale);

  return (
    <I18nProvider locale={locale}>
      <div className="app-shell" data-interface-hidden={is_interface_hidden}>
        <StageViewport />
        {is_interface_hidden ? (
          <div className="app-shell__reveal" data-tauri-drag-region>
            <IconButton
              label={`${translate("topbar.show_interface")} (${format_hotkey(toggle_interface_hotkey)})`}
              icon={<Eye size={16} />}
              onClick={toggle_interface}
            />
          </div>
        ) : (
          <>
            <TopBar />
            <div className="app-shell__side-panel">
              <ActivePanel />
            </div>
            {is_debug_overlay_visible && <DebugOverlay />}
          </>
        )}
        {is_dragging_file && (
          <div className="app-shell__drop-overlay">
            <Upload size={32} />
            <span>{translate("app.drop_files")}</span>
          </div>
        )}
      </div>
    </I18nProvider>
  );
}
