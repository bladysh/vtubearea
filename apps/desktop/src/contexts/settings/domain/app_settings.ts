import type { Locale } from "@vtubearea/ui";
import type { HotkeyBinding } from "../../../shared/hotkey";

export type PanelId = "models" | "tracking" | "scene" | "settings";
export type HotkeyAction = "toggle_interface" | "toggle_debug" | "calibrate";
export const HOTKEY_ACTIONS: readonly HotkeyAction[] = ["toggle_interface", "toggle_debug", "calibrate"];

export interface AppSettings {
  locale: Locale;
  max_frames_per_second: number;
  is_debug_overlay_visible: boolean;
  is_auto_blink_enabled: boolean;
  is_breathing_enabled: boolean;
  active_panel: PanelId;
  /** Last opened tab per panel. */
  active_tabs: Partial<Record<PanelId, string>>;
  /** User rebinds; actions without an entry use the default from config (local, not global). */
  app_hotkeys: Partial<Record<HotkeyAction, HotkeyBinding>>;
}
