import type { ModelViewTransform } from "@vtubearea/engine-2d";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { avatar_control, avatar_frame_composer } from "../../../app/app_runtime";
import type { HotkeyBinding } from "../../../shared/hotkey";
import { DEFAULT_EXPRESSION_PLAYBACK, type ExpressionPlayback } from "../domain/expression_mixer";
import type { FaceGesture, GestureThresholds, GestureTrigger, GestureTriggerMode } from "../domain/face_gesture";
import { create_default_parameter_mappings, mappings_with_defaults } from "../domain/default_parameter_mappings";
import type { ParameterMapping } from "../domain/parameter_mapping";
import { model_library_gateway, type LoadedModel, type ModelSummary } from "../infrastructure/model_library_gateway";

export type ModelLoadStatus = "idle" | "loading" | "ready" | "error";

// Shifted left so the model is not hidden behind the side panel.
export const DEFAULT_VIEW_TRANSFORM: ModelViewTransform = { offset_x: -190, offset_y: 40, zoom: 0.9 };

interface AvatarState {
  models: ModelSummary[];
  active_model_id: string | null;
  loaded_model: LoadedModel | null;
  load_status: ModelLoadStatus;
  load_error: string | null;
  active_expression_id: string | null;
  view_transform_by_model: Record<string, ModelViewTransform>;
  mappings_by_model: Record<string, ParameterMapping[]>;
  /** Per model: expression id -> hotkey. */
  expression_hotkeys_by_model: Record<string, Record<string, HotkeyBinding>>;
  /** Per model: expression id -> how it plays (once by default). */
  expression_playback_by_model: Record<string, Record<string, ExpressionPlayback>>;
  /** Per model: expression id -> face gesture that starts it, next to (or instead of) its hotkey. */
  expression_gestures_by_model: Record<string, Record<string, GestureTrigger>>;
  /** How strongly each face gesture must be shown; the same for every model. */
  gesture_thresholds: GestureThresholds;
  set_gesture_threshold: (gesture: FaceGesture, threshold: number | null) => void;
  refresh_models: () => Promise<void>;
  select_model: (model_id: string) => Promise<void>;
  import_model: (source_path?: string) => Promise<void>;
  open_models_folder: () => Promise<void>;
  update_view_transform: (view_transform: ModelViewTransform) => void;
  reset_view_transform: () => void;
  update_mapping: (mapping_id: string, mapping_patch: Partial<ParameterMapping>) => void;
  reset_mappings: () => void;
  /** playback replaces the expression's own (a gesture held keeps it on, whatever its mode). */
  set_expression: (expression_id: string | null, playback?: ExpressionPlayback) => void;
  /** Turns the expression on, or off again if it is the active one (what a hotkey does). */
  toggle_expression: (expression_id: string) => void;
  set_expression_hotkey: (expression_id: string, binding: HotkeyBinding | null) => void;
  set_expression_playback: (expression_id: string, playback: ExpressionPlayback) => void;
  set_expression_gesture: (expression_id: string, gesture: FaceGesture | null) => void;
  set_expression_gesture_mode: (expression_id: string, mode: GestureTriggerMode) => void;
}

/** How an expression of the active model plays: the user's choice, else once. */
export function expression_playback_for(state: Pick<AvatarState, "active_model_id" | "expression_playback_by_model">, expression_id: string): ExpressionPlayback {
  const model_playback = state.active_model_id ? state.expression_playback_by_model[state.active_model_id] : undefined;
  // Saved playbacks from before repeat_count existed get the defaults for new fields.
  return { ...DEFAULT_EXPRESSION_PLAYBACK, ...model_playback?.[expression_id] };
}

function error_text(caught_error: unknown): string {
  return caught_error instanceof Error ? caught_error.message : String(caught_error);
}

export const useAvatarStore = create<AvatarState>()(
  persist(
    (set, get) => ({
      models: [],
      active_model_id: null,
      loaded_model: null,
      load_status: "idle",
      load_error: null,
      active_expression_id: null,
      view_transform_by_model: {},
      mappings_by_model: {},
      expression_hotkeys_by_model: {},
      expression_playback_by_model: {},
      expression_gestures_by_model: {},
      gesture_thresholds: {},

      set_gesture_threshold: (gesture, threshold) => {
        const { [gesture]: _previous_threshold, ...other_thresholds } = get().gesture_thresholds;
        set({ gesture_thresholds: threshold === null ? other_thresholds : { ...other_thresholds, [gesture]: threshold } });
      },

      refresh_models: async () => {
        try {
          const models = await model_library_gateway.list_models();
          set({ models });
          const active_model_id = get().active_model_id;
          const has_active_model = models.some((model_summary) => model_summary.id === active_model_id);
          const model_to_load = has_active_model ? active_model_id : models[0]?.id;
          if (model_to_load && get().loaded_model === null) await get().select_model(model_to_load);
        } catch (refresh_error) {
          set({ load_status: "error", load_error: error_text(refresh_error) });
        }
      },

      select_model: async (model_id) => {
        const model_summary = get().models.find((candidate) => candidate.id === model_id);
        if (!model_summary) return;
        set({ active_model_id: model_id, load_status: "loading", load_error: null });
        try {
          const loaded_model = await model_library_gateway.load_model(model_summary);
          const mappings = mappings_with_defaults(get().mappings_by_model[model_id], loaded_model.model_definition.parameters);
          avatar_frame_composer.load_model(loaded_model.model_definition, mappings);
          set({ loaded_model, load_status: "ready", active_expression_id: null });
        } catch (load_error) {
          console.error("Model failed to load", load_error);
          set({ loaded_model: null, load_status: "error", load_error: error_text(load_error) });
        }
      },

      import_model: async (source_path) => {
        try {
          const imported_model = source_path
            ? await model_library_gateway.import_model_from_path(source_path)
            : await model_library_gateway.pick_and_import_model();
          if (!imported_model) return;
          await get().refresh_models();
          await get().select_model(imported_model.id);
        } catch (import_error) {
          set({ load_error: error_text(import_error) });
        }
      },

      open_models_folder: () => model_library_gateway.open_models_folder(),

      update_view_transform: (view_transform) => {
        const model_id = get().active_model_id;
        if (!model_id) return;
        set({ view_transform_by_model: { ...get().view_transform_by_model, [model_id]: view_transform } });
      },

      reset_view_transform: () => get().update_view_transform(DEFAULT_VIEW_TRANSFORM),

      update_mapping: (mapping_id, mapping_patch) => {
        const model_id = get().active_model_id;
        const model_definition = get().loaded_model?.model_definition;
        if (!model_id || !model_definition) return;
        const current_mappings = mappings_with_defaults(get().mappings_by_model[model_id], model_definition.parameters);
        const next_mappings = current_mappings.map((mapping) => (mapping.id === mapping_id ? { ...mapping, ...mapping_patch } : mapping));
        avatar_frame_composer.set_mappings(next_mappings);
        set({ mappings_by_model: { ...get().mappings_by_model, [model_id]: next_mappings } });
      },

      reset_mappings: () => {
        const model_id = get().active_model_id;
        const model_definition = get().loaded_model?.model_definition;
        if (!model_id || !model_definition) return;
        const { [model_id]: _removed_mappings, ...remaining_mappings } = get().mappings_by_model;
        avatar_frame_composer.set_mappings(create_default_parameter_mappings(model_definition.parameters));
        set({ mappings_by_model: remaining_mappings });
      },

      set_expression: (expression_id, playback) => {
        avatar_control.set_expression(expression_id, expression_id ? (playback ?? expression_playback_for(get(), expression_id)) : undefined);
        set({ active_expression_id: avatar_control.get_active_expression_id() });
      },

      // Reads the live state: a "once" expression may already have ended on its own.
      toggle_expression: (expression_id) => {
        const is_playing = avatar_control.get_active_expression_id() === expression_id;
        const is_restartable = expression_playback_for(get(), expression_id).mode === "once";
        get().set_expression(is_playing && !is_restartable ? null : expression_id);
      },

      set_expression_playback: (expression_id, playback) => {
        const model_id = get().active_model_id;
        if (!model_id) return;
        const model_playback = { ...get().expression_playback_by_model[model_id], [expression_id]: playback };
        set({ expression_playback_by_model: { ...get().expression_playback_by_model, [model_id]: model_playback } });
      },

      set_expression_hotkey: (expression_id, binding) => {
        const model_id = get().active_model_id;
        if (!model_id) return;
        const { [expression_id]: _previous_binding, ...other_bindings } = get().expression_hotkeys_by_model[model_id] ?? {};
        const model_bindings = binding ? { ...other_bindings, [expression_id]: binding } : other_bindings;
        set({ expression_hotkeys_by_model: { ...get().expression_hotkeys_by_model, [model_id]: model_bindings } });
      },

      set_expression_gesture: (expression_id, gesture) => {
        const model_id = get().active_model_id;
        if (!model_id) return;
        const current_triggers = get().expression_gestures_by_model[model_id] ?? {};
        // One gesture starts one expression: picking it here takes it away from any other.
        const other_triggers = Object.fromEntries(
          Object.entries(current_triggers).filter(([other_id, other_trigger]) => other_id !== expression_id && other_trigger.gesture !== gesture),
        );
        const mode = current_triggers[expression_id]?.mode ?? "while_held";
        const model_triggers = gesture ? { ...other_triggers, [expression_id]: { gesture, mode } } : other_triggers;
        set({ expression_gestures_by_model: { ...get().expression_gestures_by_model, [model_id]: model_triggers } });
      },

      set_expression_gesture_mode: (expression_id, mode) => {
        const model_id = get().active_model_id;
        const trigger = model_id ? get().expression_gestures_by_model[model_id]?.[expression_id] : undefined;
        if (!model_id || !trigger) return;
        const model_triggers = { ...get().expression_gestures_by_model[model_id], [expression_id]: { ...trigger, mode } };
        set({ expression_gestures_by_model: { ...get().expression_gestures_by_model, [model_id]: model_triggers } });
      },
    }),
    {
      name: "vtubearea.avatar",
      version: 1,
      partialize: (state) => ({
        active_model_id: state.active_model_id,
        view_transform_by_model: state.view_transform_by_model,
        mappings_by_model: state.mappings_by_model,
        expression_hotkeys_by_model: state.expression_hotkeys_by_model,
        expression_playback_by_model: state.expression_playback_by_model,
        expression_gestures_by_model: state.expression_gestures_by_model,
        gesture_thresholds: state.gesture_thresholds,
      }),
      // Fields added later get their defaults when older saved state loads.
      merge: (persisted_state, current_state) => {
        const saved_state = persisted_state as Partial<AvatarState>;
        // Early saves kept just the gesture name; they become toggling triggers.
        const expression_gestures_by_model = Object.fromEntries(
          Object.entries(saved_state.expression_gestures_by_model ?? {}).map(([model_id, triggers]) => [
            model_id,
            Object.fromEntries(Object.entries(triggers).map(([expression_id, trigger]) => [expression_id, typeof trigger === "string" ? { gesture: trigger, mode: "toggle" } : trigger])),
          ]),
        ) as AvatarState["expression_gestures_by_model"];
        return { ...current_state, ...saved_state, expression_gestures_by_model };
      },
    },
  ),
);
