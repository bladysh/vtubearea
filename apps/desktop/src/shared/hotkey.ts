import { is_mac_platform } from "./platform";

/**
 * Hotkeys are stored as text like "Mod+Shift+KeyH" (KeyboardEvent.code for the key).
 * "Mod" is Cmd on macOS and Ctrl elsewhere, so one config works on both systems.
 */
/** A user-assigned shortcut. Global ones also fire while the app is minimized or in the background. */
export interface HotkeyBinding {
  hotkey_text: string;
  is_global: boolean;
}

export interface Hotkey {
  code: string;
  alt_key: boolean;
  control_key: boolean;
  shift_key: boolean;
  meta_key: boolean;
}

export function parse_hotkey(hotkey_text: string, is_mac = is_mac_platform): Hotkey {
  const key_parts = hotkey_text.split("+").map((key_part) => key_part.trim());
  const modifiers = new Set(key_parts.slice(0, -1).map((modifier) => modifier.toLowerCase()));
  const has_mod = modifiers.has("mod");
  return {
    code: key_parts[key_parts.length - 1] ?? "",
    alt_key: modifiers.has("alt") || modifiers.has("option"),
    control_key: modifiers.has("ctrl") || modifiers.has("control") || (has_mod && !is_mac),
    shift_key: modifiers.has("shift"),
    meta_key: modifiers.has("meta") || modifiers.has("cmd") || (has_mod && is_mac),
  };
}

export function matches_hotkey(keyboard_event: KeyboardEvent, hotkey: Hotkey): boolean {
  return (
    keyboard_event.code === hotkey.code &&
    keyboard_event.altKey === hotkey.alt_key &&
    keyboard_event.ctrlKey === hotkey.control_key &&
    keyboard_event.shiftKey === hotkey.shift_key &&
    keyboard_event.metaKey === hotkey.meta_key
  );
}

const MODIFIER_CODES = new Set(["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"]);

/**
 * Turns a key press into hotkey text, or null while only modifiers are held.
 * Plain keys without a modifier are rejected unless allowed (expression keys like 1, 2, 3).
 */
export function hotkey_text_from_event(keyboard_event: KeyboardEvent, is_mac = is_mac_platform, allow_plain_keys = false): string | null {
  if (MODIFIER_CODES.has(keyboard_event.code)) return null;
  const is_function_key = /^F\d{1,2}$/.test(keyboard_event.code) || allow_plain_keys;
  const primary_modifier = is_mac ? keyboard_event.metaKey : keyboard_event.ctrlKey;
  const secondary_control = is_mac && keyboard_event.ctrlKey;
  const has_modifier = primary_modifier || secondary_control || keyboard_event.altKey;
  if (!has_modifier && !is_function_key) return null;
  const key_parts = [
    primary_modifier && "Mod",
    secondary_control && "Ctrl",
    keyboard_event.altKey && "Alt",
    keyboard_event.shiftKey && "Shift",
    keyboard_event.code,
  ];
  return key_parts.filter(Boolean).join("+");
}

/** Converts to the system shortcut format used for global registration ("CommandOrControl+Shift+KeyH"). */
export function to_global_shortcut_text(hotkey_text: string): string {
  return hotkey_text
    .split("+")
    .map((key_part) => {
      const lowercase_part = key_part.trim().toLowerCase();
      if (lowercase_part === "mod") return "CommandOrControl";
      if (lowercase_part === "ctrl" || lowercase_part === "control") return "Control";
      if (lowercase_part === "cmd" || lowercase_part === "meta") return "Super";
      return key_part.trim();
    })
    .join("+");
}

/** While a hotkey is being recorded, no hotkey may fire. */
export const hotkey_recording_state = { is_active: false };

/** Typing in a text field must never trigger hotkeys. */
export function is_typing_target(event_target: EventTarget | null): boolean {
  if (!(event_target instanceof HTMLElement)) return false;
  return event_target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event_target.tagName) || Boolean(event_target.dataset.hotkeyRecorder);
}

/** Human-readable label: "⌘⇧H" on macOS, "Ctrl + Shift + H" elsewhere. */
export function format_hotkey(hotkey_text: string, is_mac = is_mac_platform): string {
  const hotkey = parse_hotkey(hotkey_text, is_mac);
  const key_label = hotkey.code.replace(/^Key/, "").replace(/^Digit/, "");
  if (is_mac) {
    return [hotkey.control_key && "⌃", hotkey.alt_key && "⌥", hotkey.shift_key && "⇧", hotkey.meta_key && "⌘", key_label]
      .filter(Boolean)
      .join("");
  }
  return [hotkey.control_key && "Ctrl", hotkey.alt_key && "Alt", hotkey.shift_key && "Shift", hotkey.meta_key && "Win", key_label]
    .filter(Boolean)
    .join(" + ");
}
