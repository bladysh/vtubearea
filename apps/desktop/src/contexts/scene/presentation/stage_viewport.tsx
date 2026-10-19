import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { AvatarRenderer, type ModelViewTransform } from "@vtubearea/engine-2d";
import { useTranslate } from "@vtubearea/ui";
import { avatar_frame_composer, metric_history, render_statistics, tracking_hub, webcam_tracking_session } from "../../../app/app_runtime";
import { app_config } from "../../../config/app_config";
import { DEFAULT_VIEW_TRANSFORM, useAvatarStore } from "../../avatar/application/avatar_store";
import { useSettingsStore } from "../../settings/application/settings_store";
import { useSceneStore } from "../application/scene_store";
import { BackgroundLayer } from "./background_layer";
import { SceneItemsLayer } from "./scene_items_layer";
import "./scene.css";

const MINIMUM_ZOOM = 0.2;
const MAXIMUM_ZOOM = 4;

interface DragStart {
  pointer_x: number;
  pointer_y: number;
  view_transform: ModelViewTransform;
}

/** The stage: background, avatar canvas and mouse move/zoom of the model. */
export function StageViewport() {
  const translate = useTranslate();
  const canvas_host_ref = useRef<HTMLDivElement>(null);
  const [avatar_renderer, set_avatar_renderer] = useState<AvatarRenderer | null>(null);
  const [render_error, set_render_error] = useState<string | null>(null);
  const loaded_model = useAvatarStore((state) => state.loaded_model);
  const active_model_id = useAvatarStore((state) => state.active_model_id);
  const saved_view_transform = useAvatarStore((state) =>
    state.active_model_id ? state.view_transform_by_model[state.active_model_id] : undefined,
  );
  const update_view_transform = useAvatarStore((state) => state.update_view_transform);
  const max_frames_per_second = useSettingsStore((state) => state.max_frames_per_second);
  const is_editing_items = useSceneStore((state) => state.is_editing_items);
  const view_transform_ref = useRef<ModelViewTransform>(DEFAULT_VIEW_TRANSFORM);
  const drag_start_ref = useRef<DragStart | null>(null);

  useEffect(() => {
    const canvas_host = canvas_host_ref.current;
    if (!canvas_host) return;
    let created_renderer: AvatarRenderer | null = null;
    let is_disposed = false;
    AvatarRenderer.create({
      host_element: canvas_host,
      max_frames_per_second: app_config.render.max_frames_per_second,
      antialias: app_config.render.antialias,
    })
      .then((avatar_renderer_instance) => {
        if (is_disposed) return avatar_renderer_instance.destroy();
        created_renderer = avatar_renderer_instance;
        avatar_renderer_instance.on_before_render((delta_seconds) => {
          const compose_started_ms = performance.now();
          const tracking_snapshot = tracking_hub.snapshot();
          const parameter_values = avatar_frame_composer.compose(tracking_snapshot, delta_seconds);
          avatar_renderer_instance.apply_parameter_values(parameter_values);
          const { Left: left_hand, Right: right_hand } = tracking_snapshot.hand_skeletons;
          avatar_renderer_instance.apply_hands(
            avatar_frame_composer.compose_hands(
              [left_hand, right_hand],
              tracking_snapshot.face_anchor,
              (group_id, point) => avatar_renderer_instance.transform_point_by_group(group_id, point),
              delta_seconds,
            ),
          );
          render_statistics.compose_milliseconds = performance.now() - compose_started_ms;
          render_statistics.frames_per_second = avatar_renderer_instance.frames_per_second;
          metric_history.record(performance.now(), {
            ...tracking_snapshot.input_values,
            RenderFramesPerSecond: render_statistics.frames_per_second,
            TrackingFramesPerSecond: tracking_snapshot.frames_per_second,
            InferenceMilliseconds: webcam_tracking_session.diagnostics.inference_ms,
          });
        });
        set_avatar_renderer(avatar_renderer_instance);
      })
      .catch((create_error: unknown) => {
        console.error("Renderer failed to start", create_error);
        set_render_error(String(create_error));
      });
    return () => {
      is_disposed = true;
      created_renderer?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!avatar_renderer) return;
    if (!loaded_model) return avatar_renderer.unload_model();
    avatar_renderer
      .load_model(loaded_model.model_definition, loaded_model.resolve_texture_url)
      .then(() => {
        console.info(`Model rendered: ${loaded_model.model_definition.metadata.name}`);
        set_render_error(null);
      })
      .catch((load_error: unknown) => {
        console.error("Model failed to render", load_error);
        set_render_error(String(load_error));
      });
  }, [avatar_renderer, loaded_model]);

  useEffect(() => {
    view_transform_ref.current = saved_view_transform ?? DEFAULT_VIEW_TRANSFORM;
    avatar_renderer?.set_view_transform(view_transform_ref.current);
  }, [avatar_renderer, saved_view_transform, active_model_id, loaded_model]);

  useEffect(() => {
    avatar_renderer?.set_max_frames_per_second(max_frames_per_second);
  }, [avatar_renderer, max_frames_per_second]);

  // While dragging, the renderer moves directly; the store is written once on release.
  const handle_pointer_down = (pointer_event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer_event.button !== 0) return;
    pointer_event.currentTarget.setPointerCapture(pointer_event.pointerId);
    drag_start_ref.current = {
      pointer_x: pointer_event.clientX,
      pointer_y: pointer_event.clientY,
      view_transform: view_transform_ref.current,
    };
  };

  const handle_pointer_move = (pointer_event: ReactPointerEvent<HTMLDivElement>) => {
    const drag_start = drag_start_ref.current;
    if (!drag_start) return;
    view_transform_ref.current = {
      ...drag_start.view_transform,
      offset_x: drag_start.view_transform.offset_x + pointer_event.clientX - drag_start.pointer_x,
      offset_y: drag_start.view_transform.offset_y + pointer_event.clientY - drag_start.pointer_y,
    };
    avatar_renderer?.set_view_transform(view_transform_ref.current);
  };

  const handle_pointer_up = () => {
    if (!drag_start_ref.current) return;
    drag_start_ref.current = null;
    update_view_transform(view_transform_ref.current);
  };

  const handle_wheel = (wheel_event: ReactWheelEvent<HTMLDivElement>) => {
    const zoom_factor = Math.exp(-wheel_event.deltaY * 0.0015);
    const next_zoom = Math.min(MAXIMUM_ZOOM, Math.max(MINIMUM_ZOOM, view_transform_ref.current.zoom * zoom_factor));
    view_transform_ref.current = { ...view_transform_ref.current, zoom: next_zoom };
    avatar_renderer?.set_view_transform(view_transform_ref.current);
    update_view_transform(view_transform_ref.current);
  };

  return (
    <div className="stage" data-editing-items={is_editing_items}>
      <BackgroundLayer />
      <SceneItemsLayer layer="behind_avatar" />
      <div
        ref={canvas_host_ref}
        className="stage__canvas"
        onPointerDown={handle_pointer_down}
        onPointerMove={handle_pointer_move}
        onPointerUp={handle_pointer_up}
        onPointerCancel={handle_pointer_up}
        onWheel={handle_wheel}
      />
      <SceneItemsLayer layer="in_front_of_avatar" />
      {render_error && <div className="stage__message">{translate("stage.render_error", { message: render_error })}</div>}
    </div>
  );
}
