import { useEffect, useRef, useState, type ReactNode } from "react";
import { Globe, RotateCcw, X } from "lucide-react";
import { IconButton, useTranslate } from "@vtubearea/ui";
import { are_global_shortcuts_supported } from "./global_shortcuts";
import { format_hotkey, hotkey_recording_state, hotkey_text_from_event, type HotkeyBinding } from "./hotkey";
import "./hotkey_binding_editor.css";

interface HotkeyBindingEditorProps {
  label: string;
  /** Replaces the plain label, e.g. with a button that triggers the action. */
  leading?: ReactNode;
  binding: HotkeyBinding | null;
  /** Expression keys may be plain (1, 2, 3); app actions need a modifier. */
  allow_plain_keys?: boolean;
  /** Shown when the system refused the global registration. */
  error_message?: string;
  /** Reset returns to a default; without it the button clears the hotkey. */
  has_default?: boolean;
  is_custom?: boolean;
  on_change: (binding: HotkeyBinding | null) => void;
}

/** Click and press a combination; the globe toggles "works while the app is in the background". */
export function HotkeyBindingEditor({
  label,
  leading,
  binding,
  allow_plain_keys = false,
  error_message,
  has_default = false,
  is_custom = true,
  on_change,
}: HotkeyBindingEditorProps) {
  const translate = useTranslate();
  const [is_recording, set_is_recording] = useState(false);
  const recorder_ref = useRef<HTMLButtonElement>(null);
  const is_global = binding?.is_global ?? false;

  // Keys are caught on the window: WebKit (the macOS app) does not focus a clicked
  // button, so a keydown handler on the button itself never fires there.
  useEffect(() => {
    if (!is_recording) return;
    hotkey_recording_state.is_active = true;
    const handle_key_down = (keyboard_event: KeyboardEvent) => {
      keyboard_event.preventDefault();
      keyboard_event.stopPropagation();
      if (keyboard_event.code === "Escape") return set_is_recording(false);
      const recorded_hotkey = hotkey_text_from_event(keyboard_event, undefined, allow_plain_keys);
      if (!recorded_hotkey) return;
      on_change({ hotkey_text: recorded_hotkey, is_global });
      set_is_recording(false);
    };
    const cancel_on_outside_click = (pointer_event: PointerEvent) => {
      if (!recorder_ref.current?.contains(pointer_event.target as Node)) set_is_recording(false);
    };
    window.addEventListener("keydown", handle_key_down, { capture: true });
    window.addEventListener("pointerdown", cancel_on_outside_click, { capture: true });
    return () => {
      hotkey_recording_state.is_active = false;
      window.removeEventListener("keydown", handle_key_down, { capture: true });
      window.removeEventListener("pointerdown", cancel_on_outside_click, { capture: true });
    };
  }, [is_recording, allow_plain_keys, is_global, on_change]);

  return (
    <div className="hotkey-binding">
      {leading ?? <span className="hotkey-binding__label">{label}</span>}
      <button
        ref={recorder_ref}
        type="button"
        className="hotkey-binding__recorder"
        data-hotkey-recorder="true"
        data-recording={is_recording}
        aria-label={`${label}: ${binding ? format_hotkey(binding.hotkey_text) : translate("hotkeys.not_set")}`}
        onClick={() => set_is_recording((was_recording) => !was_recording)}
      >
        {is_recording ? translate("settings.hotkey_press") : binding ? format_hotkey(binding.hotkey_text) : translate("hotkeys.assign")}
      </button>
      {are_global_shortcuts_supported && (
        <IconButton
          label={translate(is_global ? "hotkeys.global_on" : "hotkeys.global_off")}
          icon={<Globe size={14} />}
          is_active={is_global}
          disabled={!binding}
          onClick={() => binding && on_change({ ...binding, is_global: !is_global })}
        />
      )}
      <IconButton
        label={translate(has_default ? "settings.hotkey_reset" : "hotkeys.clear")}
        icon={has_default ? <RotateCcw size={14} /> : <X size={14} />}
        disabled={has_default ? !is_custom : !binding}
        onClick={() => on_change(null)}
      />
      {error_message && <span className="hotkey-binding__error">{translate("hotkeys.global_failed", { message: error_message })}</span>}
    </div>
  );
}
