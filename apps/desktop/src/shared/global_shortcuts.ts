import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { to_global_shortcut_text } from "./hotkey";
import { is_desktop_runtime } from "./platform";

export const are_global_shortcuts_supported = is_desktop_runtime;

const registered_hotkeys = new Set<string>();

/**
 * Keeps the system-wide shortcuts equal to the wanted set: unregisters what is gone,
 * registers what is new. Presses go to on_pressed with the hotkey text, so the caller
 * can change what a hotkey does without re-registering it. Returns a message per hotkey
 * that could not be registered (usually because another app already owns it).
 */
export async function sync_global_shortcuts(
  wanted_hotkeys: ReadonlySet<string>,
  on_pressed: (hotkey_text: string) => void,
): Promise<Map<string, string>> {
  const failures = new Map<string, string>();
  if (!are_global_shortcuts_supported) return failures;

  for (const hotkey_text of [...registered_hotkeys]) {
    if (wanted_hotkeys.has(hotkey_text)) continue;
    await unregister(to_global_shortcut_text(hotkey_text)).catch(() => undefined);
    registered_hotkeys.delete(hotkey_text);
  }
  for (const hotkey_text of wanted_hotkeys) {
    if (registered_hotkeys.has(hotkey_text)) continue;
    try {
      await register(to_global_shortcut_text(hotkey_text), (shortcut_event) => {
        if (shortcut_event.state === "Pressed") on_pressed(hotkey_text);
      });
      registered_hotkeys.add(hotkey_text);
    } catch (register_error) {
      failures.set(hotkey_text, register_error instanceof Error ? register_error.message : String(register_error));
    }
  }
  return failures;
}
