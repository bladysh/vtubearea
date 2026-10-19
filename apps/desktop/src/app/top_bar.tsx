import { Bug, EyeOff } from "lucide-react";
import { Badge, IconButton, useTranslate } from "@vtubearea/ui";
import { useTrackingStore } from "../contexts/tracking/application/tracking_store";
import { useEffectiveHotkey, useSettingsStore } from "../contexts/settings/application/settings_store";
import type { PanelId } from "../contexts/settings/domain/app_settings";
import { format_hotkey } from "../shared/hotkey";
import { usePolledValue } from "../shared/use_polled_value";
import { tracking_hub } from "./app_runtime";

const PANEL_IDS: readonly PanelId[] = ["models", "tracking", "scene", "settings"];
const read_face_found = () => tracking_hub.snapshot().is_face_found;

export function TopBar() {
  const translate = useTranslate();
  const active_panel = useSettingsStore((state) => state.active_panel);
  const is_debug_overlay_visible = useSettingsStore((state) => state.is_debug_overlay_visible);
  const open_panel = useSettingsStore((state) => state.open_panel);
  const toggle_debug_overlay = useSettingsStore((state) => state.toggle_debug_overlay);
  const toggle_interface = useSettingsStore((state) => state.toggle_interface);
  const session_status = useTrackingStore((state) => state.session_status);
  const is_face_found = usePolledValue(read_face_found, 250);
  const toggle_debug_hotkey = useEffectiveHotkey("toggle_debug");
  const toggle_interface_hotkey = useEffectiveHotkey("toggle_interface");

  const tracking_badge =
    session_status !== "running"
      ? { tone: "neutral" as const, text: translate("topbar.tracking_off") }
      : is_face_found
        ? { tone: "success" as const, text: translate("tracking.face_found") }
        : { tone: "danger" as const, text: translate("tracking.face_lost") };

  return (
    <header className="top-bar" data-tauri-drag-region>
      <div className="top-bar__brand" data-tauri-drag-region>
        <img className="top-bar__logo" src="/logo.png" alt="" draggable={false} />
        <span className="top-bar__name">vTubeArea</span>
      </div>
      <nav className="top-bar__nav" aria-label={translate("topbar.navigation")}>
        {PANEL_IDS.map((panel_id) => (
          <button
            key={panel_id}
            type="button"
            className="top-bar__tab"
            aria-current={panel_id === active_panel ? "page" : undefined}
            onClick={() => open_panel(panel_id)}
          >
            {translate(`topbar.${panel_id}`)}
          </button>
        ))}
      </nav>
      <div className="top-bar__actions">
        <Badge tone={tracking_badge.tone}>{tracking_badge.text}</Badge>
        <IconButton
          label={`${translate("topbar.debug")} (${format_hotkey(toggle_debug_hotkey)})`}
          icon={<Bug size={16} />}
          is_active={is_debug_overlay_visible}
          onClick={toggle_debug_overlay}
        />
        <IconButton
          label={`${translate("topbar.hide_interface")} (${format_hotkey(toggle_interface_hotkey)})`}
          icon={<EyeOff size={16} />}
          onClick={toggle_interface}
        />
      </div>
    </header>
  );
}
