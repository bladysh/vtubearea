import { useEffect } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2, Upload } from "lucide-react";
import { Button, IconButton, Section, SegmentedControl, SliderField, Tooltip, useTranslate } from "@vtubearea/ui";
import { useSceneStore } from "../application/scene_store";
import type { SceneItemLayer } from "../domain/scene_item";

export function ItemsTab() {
  const translate = useTranslate();
  const scene_items = useSceneStore((state) => state.scene_items);
  const item_library = useSceneStore((state) => state.item_library);
  const selected_item_id = useSceneStore((state) => state.selected_item_id);
  const refresh_item_library = useSceneStore((state) => state.refresh_item_library);
  const import_item_media = useSceneStore((state) => state.import_item_media);
  const delete_item_media = useSceneStore((state) => state.delete_item_media);
  const place_item = useSceneStore((state) => state.place_item);
  const update_item = useSceneStore((state) => state.update_item);
  const remove_item = useSceneStore((state) => state.remove_item);
  const move_item = useSceneStore((state) => state.move_item);
  const select_item = useSceneStore((state) => state.select_item);
  const selected_item = scene_items.find((scene_item) => scene_item.id === selected_item_id) ?? null;

  useEffect(() => {
    void refresh_item_library();
  }, [refresh_item_library]);

  const layer_options: { value: SceneItemLayer; label: string }[] = [
    { value: "behind_avatar", label: translate("items.layer.behind") },
    { value: "in_front_of_avatar", label: translate("items.layer.front") },
  ];

  return (
    <>
      <Section title={translate("items.library")}>
        <Button icon={<Upload size={16} />} onClick={() => void import_item_media()}>
          {translate("items.upload")}
        </Button>
        {item_library.length === 0 ? (
          <p className="vta-field__hint">{translate("items.no_library")}</p>
        ) : (
          <div className="media-grid">
            {item_library.map((media) => (
              <div key={media.file_name} className="media-tile media-tile--contain" aria-label={media.file_name}>
                <img src={media.url} alt="" />
                <Tooltip text={translate("items.place")}>
                  <button type="button" className="media-tile__place" aria-label={translate("items.place")} onClick={() => place_item(media)}>
                    <Plus size={14} />
                  </button>
                </Tooltip>
                <button
                  type="button"
                  className="media-tile__delete"
                  aria-label={translate("scene.delete_media")}
                  onClick={() => void delete_item_media(media.file_name)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={translate("items.on_stage")}>
        {scene_items.length === 0 ? (
          <p className="vta-field__hint">{translate("items.none_on_stage")}</p>
        ) : (
          <div className="item-list">
            {[...scene_items].reverse().map((scene_item) => (
              <div
                key={scene_item.id}
                role="button"
                tabIndex={0}
                className="item-row"
                aria-pressed={scene_item.id === selected_item_id}
                onClick={() => select_item(scene_item.id)}
                onKeyDown={(key_event) => key_event.key === "Enter" && select_item(scene_item.id)}
              >
                <img className="item-row__thumbnail" src={scene_item.media.url} alt="" />
                <span className="item-row__name">{scene_item.media.file_name}</span>
                <span className="item-row__layer">{translate(scene_item.layer === "behind_avatar" ? "items.layer.behind" : "items.layer.front")}</span>
                <IconButton
                  label={translate(scene_item.is_visible ? "items.hide" : "items.show")}
                  icon={scene_item.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  onClick={(click_event) => {
                    click_event.stopPropagation();
                    update_item(scene_item.id, { is_visible: !scene_item.is_visible });
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <p className="vta-field__hint">{translate("items.hint")}</p>
      </Section>

      {selected_item && (
        <Section
          title={translate("items.selected")}
          actions={
            <div className="item-actions">
              <IconButton label={translate("items.move_up")} icon={<ArrowUp size={14} />} onClick={() => move_item(selected_item.id, "up")} />
              <IconButton label={translate("items.move_down")} icon={<ArrowDown size={14} />} onClick={() => move_item(selected_item.id, "down")} />
              <IconButton label={translate("items.remove")} icon={<Trash2 size={14} />} onClick={() => remove_item(selected_item.id)} />
            </div>
          }
        >
          <SegmentedControl
            label={translate("items.layer")}
            value={selected_item.layer}
            options={layer_options}
            on_change={(layer) => update_item(selected_item.id, { layer })}
          />
          <SliderField
            label={translate("items.size")}
            value={selected_item.height}
            minimum={0.03}
            maximum={2}
            format_value={(value) => `${Math.round(value * 100)}%`}
            on_change={(height) => update_item(selected_item.id, { height })}
          />
          <SliderField
            label={translate("items.rotation")}
            value={selected_item.rotation_degrees}
            minimum={-180}
            maximum={180}
            step={1}
            format_value={(value) => `${Math.round(value)}°`}
            on_change={(rotation_degrees) => update_item(selected_item.id, { rotation_degrees })}
          />
          <SliderField
            label={translate("items.opacity")}
            value={selected_item.opacity}
            minimum={0.05}
            maximum={1}
            format_value={(value) => `${Math.round(value * 100)}%`}
            on_change={(opacity) => update_item(selected_item.id, { opacity })}
          />
        </Section>
      )}
    </>
  );
}
