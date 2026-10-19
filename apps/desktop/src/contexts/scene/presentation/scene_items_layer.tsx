import { useRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { useSceneStore } from "../application/scene_store";
import type { SceneItem, SceneItemLayer } from "../domain/scene_item";

const MINIMUM_ITEM_HEIGHT = 0.03;
const MAXIMUM_ITEM_HEIGHT = 2;

interface DragStart {
  item_id: string;
  pointer_x: number;
  pointer_y: number;
  center_x: number;
  center_y: number;
}

/** Items of one layer. While editing, drag moves, wheel resizes, Shift + wheel rotates. */
export function SceneItemsLayer({ layer }: { layer: SceneItemLayer }) {
  const scene_items = useSceneStore((state) => state.scene_items);
  const selected_item_id = useSceneStore((state) => state.selected_item_id);
  const is_editing_items = useSceneStore((state) => state.is_editing_items);
  const update_item = useSceneStore((state) => state.update_item);
  const select_item = useSceneStore((state) => state.select_item);
  const layer_ref = useRef<HTMLDivElement>(null);
  const drag_start_ref = useRef<DragStart | null>(null);

  const handle_pointer_down = (scene_item: SceneItem, pointer_event: ReactPointerEvent<HTMLImageElement>) => {
    if (!is_editing_items || pointer_event.button !== 0) return;
    pointer_event.currentTarget.setPointerCapture(pointer_event.pointerId);
    select_item(scene_item.id);
    drag_start_ref.current = {
      item_id: scene_item.id,
      pointer_x: pointer_event.clientX,
      pointer_y: pointer_event.clientY,
      center_x: scene_item.center_x,
      center_y: scene_item.center_y,
    };
  };

  const handle_pointer_move = (pointer_event: ReactPointerEvent<HTMLImageElement>) => {
    const drag_start = drag_start_ref.current;
    const layer_rect = layer_ref.current?.getBoundingClientRect();
    if (!drag_start || !layer_rect) return;
    update_item(drag_start.item_id, {
      center_x: drag_start.center_x + (pointer_event.clientX - drag_start.pointer_x) / layer_rect.width,
      center_y: drag_start.center_y + (pointer_event.clientY - drag_start.pointer_y) / layer_rect.height,
    });
  };

  const handle_wheel = (scene_item: SceneItem, wheel_event: ReactWheelEvent<HTMLImageElement>) => {
    if (!is_editing_items) return;
    if (wheel_event.shiftKey) {
      update_item(scene_item.id, { rotation_degrees: scene_item.rotation_degrees + Math.sign(wheel_event.deltaY) * 5 });
    } else {
      const next_height = scene_item.height * Math.exp(-wheel_event.deltaY * 0.0015);
      update_item(scene_item.id, { height: Math.min(MAXIMUM_ITEM_HEIGHT, Math.max(MINIMUM_ITEM_HEIGHT, next_height)) });
    }
  };

  return (
    <div ref={layer_ref} className="stage__items" data-layer={layer} data-editing={is_editing_items}>
      {scene_items
        .filter((scene_item) => scene_item.layer === layer && scene_item.is_visible)
        .map((scene_item) => (
          <img
            key={scene_item.id}
            className="stage__item"
            data-selected={is_editing_items && scene_item.id === selected_item_id}
            src={scene_item.media.url}
            alt=""
            draggable={false}
            style={{
              left: `${scene_item.center_x * 100}%`,
              top: `${scene_item.center_y * 100}%`,
              height: `${scene_item.height * 100}%`,
              opacity: scene_item.opacity,
              transform: `translate(-50%, -50%) rotate(${scene_item.rotation_degrees}deg)`,
            }}
            onPointerDown={(pointer_event) => handle_pointer_down(scene_item, pointer_event)}
            onPointerMove={handle_pointer_move}
            onPointerUp={() => (drag_start_ref.current = null)}
            onPointerCancel={() => (drag_start_ref.current = null)}
            onWheel={(wheel_event) => handle_wheel(scene_item, wheel_event)}
          />
        ))}
    </div>
  );
}
