import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_BACKGROUND_SETTINGS, type BackgroundMedia, type BackgroundSettings } from "../domain/background_settings";
import { create_scene_item, move_item_in_layer, type SceneItem } from "../domain/scene_item";
import { background_media_gateway, item_media_gateway } from "../infrastructure/media_gateway";
import { set_always_on_top, set_click_through } from "../infrastructure/window_controls";

interface SceneState {
  background: BackgroundSettings;
  is_always_on_top: boolean;
  /** Mirrors the Rust side; changed from the UI or the tray menu. Not saved. */
  is_click_through: boolean;
  media_library: BackgroundMedia[];
  update_background: (background_patch: Partial<BackgroundSettings>) => void;
  refresh_media_library: () => Promise<void>;
  import_media: (source_path?: string) => Promise<void>;
  delete_media: (file_name: string) => Promise<void>;
  change_always_on_top: (is_enabled: boolean) => Promise<void>;
  change_click_through: (is_enabled: boolean) => Promise<void>;
  sync_click_through: (is_enabled: boolean) => void;

  /** Images placed on the stage, in draw order within each layer. */
  scene_items: SceneItem[];
  /** Uploaded images that can be placed. */
  item_library: BackgroundMedia[];
  selected_item_id: string | null;
  /** While the Items tab is open, items take the mouse instead of the avatar. Not saved. */
  is_editing_items: boolean;
  refresh_item_library: () => Promise<void>;
  /** Without a path a file picker opens. */
  import_item_media: (source_path?: string) => Promise<void>;
  delete_item_media: (file_name: string) => Promise<void>;
  place_item: (media: BackgroundMedia) => void;
  update_item: (item_id: string, item_patch: Partial<SceneItem>) => void;
  remove_item: (item_id: string) => void;
  move_item: (item_id: string, direction: "up" | "down") => void;
  select_item: (item_id: string | null) => void;
  set_editing_items: (is_editing: boolean) => void;
}

export const useSceneStore = create<SceneState>()(
  persist(
    (set, get) => ({
      background: DEFAULT_BACKGROUND_SETTINGS,
      is_always_on_top: false,
      is_click_through: false,
      media_library: [],
      update_background: (background_patch) => set((state) => ({ background: { ...state.background, ...background_patch } })),
      refresh_media_library: async () => {
        set({ media_library: await background_media_gateway.list_media() });
      },
      import_media: async (source_path) => {
        const imported_media = source_path
          ? await background_media_gateway.import_media_from_path(source_path)
          : await background_media_gateway.pick_and_import_media();
        if (!imported_media) return;
        await get().refresh_media_library();
        get().update_background({ mode: "media", media: imported_media });
      },
      delete_media: async (file_name) => {
        await background_media_gateway.delete_media(file_name);
        if (get().background.media?.file_name === file_name) get().update_background({ media: null, mode: "color" });
        await get().refresh_media_library();
      },
      change_always_on_top: async (is_enabled) => {
        await set_always_on_top(is_enabled);
        set({ is_always_on_top: is_enabled });
      },
      change_click_through: async (is_enabled) => {
        await set_click_through(is_enabled);
        set({ is_click_through: is_enabled });
      },
      sync_click_through: (is_enabled) => set({ is_click_through: is_enabled }),

      scene_items: [],
      item_library: [],
      selected_item_id: null,
      is_editing_items: false,
      refresh_item_library: async () => {
        set({ item_library: await item_media_gateway.list_media() });
      },
      import_item_media: async (source_path) => {
        const imported_media = source_path
          ? await item_media_gateway.import_media_from_path(source_path)
          : await item_media_gateway.pick_and_import_media();
        if (!imported_media) return;
        await get().refresh_item_library();
        get().place_item(imported_media);
      },
      delete_item_media: async (file_name) => {
        await item_media_gateway.delete_media(file_name);
        set({ scene_items: get().scene_items.filter((scene_item) => scene_item.media.file_name !== file_name) });
        await get().refresh_item_library();
      },
      place_item: (media) => {
        const scene_item = create_scene_item(media, crypto.randomUUID());
        set({ scene_items: [...get().scene_items, scene_item], selected_item_id: scene_item.id });
      },
      update_item: (item_id, item_patch) =>
        set({ scene_items: get().scene_items.map((scene_item) => (scene_item.id === item_id ? { ...scene_item, ...item_patch } : scene_item)) }),
      remove_item: (item_id) =>
        set({
          scene_items: get().scene_items.filter((scene_item) => scene_item.id !== item_id),
          selected_item_id: get().selected_item_id === item_id ? null : get().selected_item_id,
        }),
      move_item: (item_id, direction) => set({ scene_items: move_item_in_layer(get().scene_items, item_id, direction) }),
      select_item: (item_id) => set({ selected_item_id: item_id }),
      set_editing_items: (is_editing) => set({ is_editing_items: is_editing }),
    }),
    {
      name: "vtubearea.scene",
      version: 2,
      partialize: (state) => ({ background: state.background, is_always_on_top: state.is_always_on_top, scene_items: state.scene_items }),
      // Fields added later get their defaults when older saved state loads.
      merge: (persisted_state, current_state) => ({ ...current_state, ...(persisted_state as Partial<SceneState>) }),
      migrate: (persisted_state) => persisted_state as SceneState,
    },
  ),
);
