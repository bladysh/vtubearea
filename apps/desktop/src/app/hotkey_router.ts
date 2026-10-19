import { useEffect } from "react";
import { useAvatarStore } from "../contexts/avatar/application/avatar_store";
import { effective_app_hotkey, useSettingsStore } from "../contexts/settings/application/settings_store";
import { HOTKEY_ACTIONS, type HotkeyAction } from "../contexts/settings/domain/app_settings";
import { useTrackingStore } from "../contexts/tracking/application/tracking_store";
import { are_global_shortcuts_supported, sync_global_shortcuts } from "../shared/global_shortcuts";
import { hotkey_recording_state, is_typing_target, matches_hotkey, parse_hotkey, type HotkeyBinding } from "../shared/hotkey";

interface HotkeyCommand {
  binding: HotkeyBinding;
  run: () => void;
}

const APP_ACTION_RUNNERS: Record<HotkeyAction, () => void> = {
  toggle_interface: () => useSettingsStore.getState().toggle_interface(),
  toggle_debug: () => useSettingsStore.getState().toggle_debug_overlay(),
  calibrate: () => void useTrackingStore.getState().calibrate(),
};

/** Every hotkey currently in effect: app actions plus the active model's expressions. */
function collect_hotkey_commands(): HotkeyCommand[] {
  const { app_hotkeys } = useSettingsStore.getState();
  const avatar_state = useAvatarStore.getState();
  const app_commands = HOTKEY_ACTIONS.map((action) => ({
    binding: effective_app_hotkey(action, app_hotkeys),
    run: APP_ACTION_RUNNERS[action],
  }));
  const expression_bindings = avatar_state.active_model_id ? avatar_state.expression_hotkeys_by_model[avatar_state.active_model_id] ?? {} : {};
  const model_expression_ids = new Set(avatar_state.loaded_model?.model_definition.expressions.map((expression) => expression.id) ?? []);
  const expression_commands = Object.entries(expression_bindings)
    .filter(([expression_id]) => model_expression_ids.has(expression_id))
    .map(([expression_id, binding]) => ({ binding, run: () => useAvatarStore.getState().toggle_expression(expression_id) }));
  return [...app_commands, ...expression_commands];
}

/** A global binding falls back to window-only where the system cannot register it (browser preview). */
function is_handled_globally(binding: HotkeyBinding): boolean {
  return binding.is_global && are_global_shortcuts_supported;
}

/**
 * Routes key presses to actions. Window hotkeys come from keydown; global hotkeys are
 * registered with the system and fire even while the app is minimized.
 */
export function useHotkeyRouter(): void {
  useEffect(() => {
    const handle_key_down = (keyboard_event: KeyboardEvent) => {
      if (hotkey_recording_state.is_active || is_typing_target(keyboard_event.target)) return;
      const matching_command = collect_hotkey_commands().find(
        (command) => !is_handled_globally(command.binding) && matches_hotkey(keyboard_event, parse_hotkey(command.binding.hotkey_text)),
      );
      if (!matching_command) return;
      keyboard_event.preventDefault();
      matching_command.run();
    };
    window.addEventListener("keydown", handle_key_down);
    return () => window.removeEventListener("keydown", handle_key_down);
  }, []);

  useEffect(() => {
    let last_registered_key = "";
    const run_global_hotkey = (hotkey_text: string) => {
      if (hotkey_recording_state.is_active) return;
      collect_hotkey_commands()
        .find((command) => is_handled_globally(command.binding) && command.binding.hotkey_text === hotkey_text)
        ?.run();
    };
    const resync_global_hotkeys = () => {
      const global_hotkeys = new Set(
        collect_hotkey_commands()
          .filter((command) => is_handled_globally(command.binding))
          .map((command) => command.binding.hotkey_text),
      );
      const registration_key = [...global_hotkeys].sort().join("|");
      if (registration_key === last_registered_key) return;
      last_registered_key = registration_key;
      void sync_global_shortcuts(global_hotkeys, run_global_hotkey).then((failures) =>
        useSettingsStore.getState().set_hotkey_errors(Object.fromEntries(failures)),
      );
    };
    resync_global_hotkeys();
    const unsubscribe_settings = useSettingsStore.subscribe(resync_global_hotkeys);
    const unsubscribe_avatar = useAvatarStore.subscribe(resync_global_hotkeys);
    return () => {
      unsubscribe_settings();
      unsubscribe_avatar();
      void sync_global_shortcuts(new Set(), run_global_hotkey);
    };
  }, []);
}
