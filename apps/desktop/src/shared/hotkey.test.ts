import { describe, expect, it } from "vitest";
import { format_hotkey, hotkey_text_from_event, matches_hotkey, parse_hotkey, to_global_shortcut_text } from "./hotkey";

function key_event(code: string, modifiers: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) {
  return { code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers } as KeyboardEvent;
}

describe("hotkeys", () => {
  it("maps Mod to Cmd on macOS and Ctrl on Windows", () => {
    expect(matches_hotkey(key_event("KeyH", { metaKey: true, shiftKey: true }), parse_hotkey("Mod+Shift+KeyH", true))).toBe(true);
    expect(matches_hotkey(key_event("KeyH", { ctrlKey: true, shiftKey: true }), parse_hotkey("Mod+Shift+KeyH", false))).toBe(true);
    expect(matches_hotkey(key_event("KeyH", { ctrlKey: true, shiftKey: true }), parse_hotkey("Mod+Shift+KeyH", true))).toBe(false);
  });

  it("formats with symbols on macOS and words elsewhere", () => {
    expect(format_hotkey("Mod+Shift+KeyH", true)).toBe("⇧⌘H");
    expect(format_hotkey("Mod+Shift+KeyH", false)).toBe("Ctrl + Shift + H");
    expect(format_hotkey("Alt+Digit1", false)).toBe("Alt + 1");
  });

  it("records presses as portable text and ignores bare letters", () => {
    expect(hotkey_text_from_event(key_event("KeyK", { metaKey: true, altKey: true }), true)).toBe("Mod+Alt+KeyK");
    expect(hotkey_text_from_event(key_event("KeyK", { ctrlKey: true }), false)).toBe("Mod+KeyK");
    expect(hotkey_text_from_event(key_event("KeyK"), true)).toBeNull();
    expect(hotkey_text_from_event(key_event("F5"), true)).toBe("F5");
    expect(hotkey_text_from_event(key_event("MetaLeft", { metaKey: true }), true)).toBeNull();
    expect(hotkey_text_from_event(key_event("Digit1"), true, true)).toBe("Digit1");
  });

  it("converts to the global shortcut format", () => {
    expect(to_global_shortcut_text("Mod+Shift+KeyH")).toBe("CommandOrControl+Shift+KeyH");
    expect(to_global_shortcut_text("Ctrl+Alt+Digit2")).toBe("Control+Alt+Digit2");
    expect(to_global_shortcut_text("Digit1")).toBe("Digit1");
  });
});
