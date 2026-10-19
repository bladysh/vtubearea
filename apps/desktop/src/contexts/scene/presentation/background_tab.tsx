import { Trash2, Upload } from "lucide-react";
import { Button, Field, Section, SegmentedControl, SliderField, Tooltip, useTranslate } from "@vtubearea/ui";
import { useSceneStore } from "../application/scene_store";
import { CHROMA_KEY_PRESETS, type BackgroundMode, type MediaFit } from "../domain/background_settings";

export function BackgroundTab() {
  const translate = useTranslate();
  const background = useSceneStore((state) => state.background);
  const media_library = useSceneStore((state) => state.media_library);
  const update_background = useSceneStore((state) => state.update_background);
  const import_media = useSceneStore((state) => state.import_media);
  const delete_media = useSceneStore((state) => state.delete_media);

  const mode_options: { value: BackgroundMode; label: string }[] = [
    { value: "transparent", label: translate("scene.mode.transparent") },
    { value: "color", label: translate("scene.mode.color") },
    { value: "chroma_key", label: translate("scene.mode.chroma_key") },
    { value: "media", label: translate("scene.mode.media") },
  ];
  const fit_options: { value: MediaFit; label: string }[] = [
    { value: "cover", label: translate("scene.fit.cover") },
    { value: "contain", label: translate("scene.fit.contain") },
  ];

  return (
    <Section>
      <SegmentedControl
        label={translate("scene.background")}
        value={background.mode}
        options={mode_options}
        on_change={(mode) => update_background({ mode })}
      />
      <p className="vta-field__hint">{translate(`scene.mode_hint.${background.mode}`)}</p>

      {background.mode === "color" && (
        <Field
          label={translate("scene.color")}
          control={
            <input
              className="color-input"
              type="color"
              aria-label={translate("scene.color")}
              value={background.color}
              onChange={(change_event) => update_background({ color: change_event.target.value })}
            />
          }
        />
      )}

      {background.mode === "chroma_key" && (
        <div className="color-row">
          {CHROMA_KEY_PRESETS.map((preset) => (
            <Tooltip key={preset.id} text={translate(`scene.chroma.${preset.id}`)}>
              <button
                type="button"
                className="color-swatch"
                aria-label={translate(`scene.chroma.${preset.id}`)}
                aria-pressed={background.chroma_key_color === preset.color}
                style={{ background: preset.color }}
                onClick={() => update_background({ chroma_key_color: preset.color })}
              />
            </Tooltip>
          ))}
          <Tooltip text={translate("scene.chroma.custom")}>
            <input
              className="color-input"
              type="color"
              aria-label={translate("scene.chroma.custom")}
              value={background.chroma_key_color}
              onChange={(change_event) => update_background({ chroma_key_color: change_event.target.value })}
            />
          </Tooltip>
        </div>
      )}

      {background.mode === "media" && (
        <>
          <Button icon={<Upload size={16} />} onClick={() => void import_media()}>
            {translate("scene.upload_media")}
          </Button>
          {media_library.length === 0 ? (
            <p className="vta-field__hint">{translate("scene.no_media")}</p>
          ) : (
            <div className="media-grid">
              {media_library.map((media) => (
                <div
                  key={media.file_name}
                  role="button"
                  tabIndex={0}
                  className="media-tile"
                  aria-label={media.file_name}
                  aria-pressed={background.media?.file_name === media.file_name}
                  onClick={() => update_background({ media })}
                  onKeyDown={(key_event) => key_event.key === "Enter" && update_background({ media })}
                >
                  {media.kind === "video" ? <video src={media.url} muted /> : <img src={media.url} alt="" />}
                  <button
                    type="button"
                    className="media-tile__delete"
                    aria-label={translate("scene.delete_media")}
                    onClick={(click_event) => {
                      click_event.stopPropagation();
                      void delete_media(media.file_name);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <SegmentedControl
            label={translate("scene.fit")}
            value={background.media_fit}
            options={fit_options}
            on_change={(media_fit) => update_background({ media_fit })}
          />
          <SliderField
            label={translate("scene.media_opacity")}
            value={background.media_opacity}
            minimum={0}
            maximum={1}
            format_value={(value) => `${Math.round(value * 100)}%`}
            on_change={(media_opacity) => update_background({ media_opacity })}
          />
        </>
      )}
    </Section>
  );
}
