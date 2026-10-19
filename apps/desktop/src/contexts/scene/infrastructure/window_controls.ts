import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { is_desktop_runtime } from "../../../shared/platform";

const CLICK_THROUGH_CHANGED_EVENT = "click-through-changed";

export async function set_always_on_top(is_enabled: boolean): Promise<void> {
  if (is_desktop_runtime) await getCurrentWindow().setAlwaysOnTop(is_enabled);
}

/** While enabled the window ignores the mouse; the tray menu turns it back off. */
export async function set_click_through(is_enabled: boolean): Promise<void> {
  if (is_desktop_runtime) await invoke("set_click_through", { isEnabled: is_enabled });
}

export function listen_click_through_changes(on_change: (is_enabled: boolean) => void): () => void {
  if (!is_desktop_runtime) return () => undefined;
  const unlisten_promise = listen<boolean>(CLICK_THROUGH_CHANGED_EVENT, (tauri_event) => on_change(tauri_event.payload));
  return () => void unlisten_promise.then((unlisten) => unlisten());
}

export function start_window_drag(): void {
  if (is_desktop_runtime) void getCurrentWindow().startDragging();
}
