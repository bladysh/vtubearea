import type { BackgroundMedia } from "./background_settings";

/** Which side of the avatar an item is drawn on; the background is always below both. */
export type SceneItemLayer = "behind_avatar" | "in_front_of_avatar";

/** An image placed on the stage. Position and size are relative to the stage, so they survive window resizes. */
export interface SceneItem {
  id: string;
  media: BackgroundMedia;
  layer: SceneItemLayer;
  /** Item center, 0..1 of stage width / height. */
  center_x: number;
  center_y: number;
  /** Item height as a share of the stage height. */
  height: number;
  rotation_degrees: number;
  opacity: number;
  is_visible: boolean;
}

export function create_scene_item(media: BackgroundMedia, id: string): SceneItem {
  return {
    id,
    media,
    layer: "in_front_of_avatar",
    center_x: 0.5,
    center_y: 0.5,
    height: 0.25,
    rotation_degrees: 0,
    opacity: 1,
    is_visible: true,
  };
}

/** Moves an item one step up or down within its own layer (later in the list = drawn on top). */
export function move_item_in_layer(items: readonly SceneItem[], item_id: string, direction: "up" | "down"): SceneItem[] {
  const item_index = items.findIndex((item) => item.id === item_id);
  const item = items[item_index];
  if (!item) return [...items];
  const step = direction === "up" ? 1 : -1;
  let neighbor_index = item_index + step;
  while (items[neighbor_index] && items[neighbor_index]!.layer !== item.layer) neighbor_index += step;
  if (!items[neighbor_index]) return [...items];
  const reordered_items = [...items];
  reordered_items[item_index] = items[neighbor_index]!;
  reordered_items[neighbor_index] = item;
  return reordered_items;
}
