import { describe, expect, it } from "vitest";
import { create_scene_item, move_item_in_layer, type SceneItem } from "./scene_item";

function item(id: string, layer: SceneItem["layer"]): SceneItem {
  return { ...create_scene_item({ file_name: `${id}.png`, url: id, kind: "image" }, id), layer };
}

describe("move_item_in_layer", () => {
  const items = [item("a", "in_front_of_avatar"), item("b", "behind_avatar"), item("c", "in_front_of_avatar")];

  it("swaps with the next item of the same layer, skipping the other layer", () => {
    expect(move_item_in_layer(items, "a", "up").map((scene_item) => scene_item.id)).toEqual(["c", "b", "a"]);
  });

  it("does nothing at the top of its layer", () => {
    expect(move_item_in_layer(items, "c", "up").map((scene_item) => scene_item.id)).toEqual(["a", "b", "c"]);
  });
});
