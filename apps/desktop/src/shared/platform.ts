/** True inside the Tauri desktop shell, false in a plain browser (UI development). */
export const is_desktop_runtime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** macOS uses Cmd/Option where Windows and Linux use Ctrl/Alt. */
export const is_mac_platform = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
