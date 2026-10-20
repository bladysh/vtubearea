import { create } from "zustand";
import { persist } from "zustand/middleware";
import { app_config } from "../../../config/app_config";
import type { HotkeyBinding } from "../../../shared/hotkey";
import type { AppSettings, HotkeyAction, PanelId } from "../domain/app_settings";

interface SettingsState extends AppSettings {
  /** Stream mode: everything but the avatar and background is hidden. Not saved. */
  is_interface_hidden: boolean;
  update_settings: (settings_patch: Partial<AppSettings>) => void;
  open_panel: (panel_id: PanelId) => void;
  toggle_debug_overlay: () => void;
  toggle_interface: () => void;
  reset_settings: () => void;
  set_app_hotkey: (action: HotkeyAction, binding: HotkeyBinding | null) => void;
  /** Hotkeys the system refused to register globally, with the reason. Not saved. */
  hotkey_errors: Record<string, string>;
  set_hotkey_errors: (hotkey_errors: Record<string, string>) => void;
  set_active_tab: (panel_id: PanelId, tab_id: string) => void;
}

const default_settings: AppSettings = {
  locale: app_config.interface.default_locale,
  max_frames_per_second: app_config.render.max_frames_per_second,
  render_resolution: null,
  is_debug_overlay_visible: app_config.interface.debug_mode_default,
  is_auto_blink_enabled: true,
  is_breathing_enabled: true,
  active_panel: "models",
  app_hotkeys: {},
  active_tabs: {},
};

/** Binding in effect for an action: the user's rebind, else the config default. */
export function effective_app_hotkey(action: HotkeyAction, app_hotkeys: AppSettings["app_hotkeys"]): HotkeyBinding {
  return app_hotkeys[action] ?? { hotkey_text: app_config.hotkeys[action], is_global: false };
}

/** Remembered tab of a panel; falls back to the first tab when the saved one no longer exists. */
export function useActiveTab<TabId extends string>(panel_id: PanelId, tab_ids: readonly TabId[]): [TabId, (tab_id: TabId) => void] {
  const saved_tab = useSettingsStore((state) => state.active_tabs[panel_id]);
  const set_active_tab = useSettingsStore((state) => state.set_active_tab);
  const active_tab = tab_ids.find((tab_id) => tab_id === saved_tab) ?? tab_ids[0]!;
  return [active_tab, (tab_id) => set_active_tab(panel_id, tab_id)];
}

export function useEffectiveHotkey(action: HotkeyAction): string {
  return useSettingsStore((state) => effective_app_hotkey(action, state.app_hotkeys).hotkey_text);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...default_settings,
      is_interface_hidden: false,
      update_settings: (settings_patch) => set(settings_patch),
      open_panel: (panel_id) => set({ active_panel: panel_id }),
      toggle_debug_overlay: () => set((state) => ({ is_debug_overlay_visible: !state.is_debug_overlay_visible })),
      toggle_interface: () => set((state) => ({ is_interface_hidden: !state.is_interface_hidden })),
      reset_settings: () => set(default_settings),
      set_active_tab: (panel_id, tab_id) => set((state) => ({ active_tabs: { ...state.active_tabs, [panel_id]: tab_id } })),
      set_app_hotkey: (action, binding) =>
        set((state) => {
          const { [action]: _previous_binding, ...other_bindings } = state.app_hotkeys;
          return { app_hotkeys: binding ? { ...other_bindings, [action]: binding } : other_bindings };
        }),
      hotkey_errors: {},
      set_hotkey_errors: (hotkey_errors) => set({ hotkey_errors }),
    }),
    {
      name: "vtubearea.settings",
      version: 3,
      // Fields added later get their defaults when older saved settings load.
      merge: (persisted_state, current_state) => ({ ...current_state, ...(persisted_state as Partial<SettingsState>) }),
      migrate: (persisted_state) => persisted_state as SettingsState,
      partialize: ({ is_interface_hidden: _is_interface_hidden, hotkey_errors: _hotkey_errors, ...persisted_state }) => persisted_state,
    },
  ),
);
