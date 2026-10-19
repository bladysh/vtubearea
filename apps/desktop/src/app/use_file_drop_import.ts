import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useAvatarStore } from "../contexts/avatar/application/avatar_store";
import { useSceneStore } from "../contexts/scene/application/scene_store";
import { is_background_media_path } from "../contexts/scene/infrastructure/media_gateway";
import { is_desktop_runtime } from "../shared/platform";

/** Files dropped on the window: folders become models; images become scene items while the Items tab is open, else backgrounds. */
export function useFileDropImport(): boolean {
  const [is_dragging_over, set_is_dragging_over] = useState(false);

  useEffect(() => {
    if (!is_desktop_runtime) return;
    const unlisten_promise = getCurrentWebview().onDragDropEvent((drag_drop_event) => {
      const drag_drop_payload = drag_drop_event.payload;
      if (drag_drop_payload.type === "enter" || drag_drop_payload.type === "over") return set_is_dragging_over(true);
      set_is_dragging_over(false);
      if (drag_drop_payload.type !== "drop") return;
      for (const dropped_path of drag_drop_payload.paths) {
        const scene_state = useSceneStore.getState();
        if (is_background_media_path(dropped_path) && scene_state.is_editing_items) void scene_state.import_item_media(dropped_path);
        else if (is_background_media_path(dropped_path)) void scene_state.import_media(dropped_path);
        else void useAvatarStore.getState().import_model(dropped_path);
      }
    });
    return () => void unlisten_promise.then((unlisten) => unlisten());
  }, []);

  return is_dragging_over;
}
