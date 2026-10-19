import type { RenderedHand } from "@vtubearea/engine-2d";
import type { ModelDefinition } from "@vtubearea/model-format";
import { ExpressionMixer, type ExpressionPlayback } from "../domain/expression_mixer";
import { solve_arm } from "../domain/arm_solver";
import { hand_scale_pivots, place_hand_on_canvas, type FramePoint, type UserFaceAnchor } from "../domain/hand_placement";
import { AutoBlink, breathing_value } from "../domain/idle_motion";
import { ParameterPhysics } from "../domain/parameter_physics";
import { map_input_value, smooth_toward, type ParameterMapping } from "../domain/parameter_mapping";
import type { AvatarControlPort, AvatarModelDescription } from "./avatar_control_port";

export interface IdleMotionConfig {
  auto_blink_min_interval_ms: number;
  auto_blink_max_interval_ms: number;
  breathing_period_ms: number;
}

export interface IdleMotionSettings {
  is_auto_blink_enabled: boolean;
  is_breathing_enabled: boolean;
}

export interface TrackingFrameInput {
  is_face_found: boolean;
  input_values: Readonly<Record<string, number>>;
}

/** Hand skeleton as the tracking hub provides it (camera-frame units). */
export interface TrackedHandInput {
  points: FramePoint[];
  is_present: boolean;
  is_behind_head: boolean;
}

/** Wrist to middle finger base; 0 for a hand without points. */
function palm_length(points: readonly FramePoint[]): number {
  const wrist = points[0];
  const middle_finger_base = points[9];
  return wrist && middle_finger_base ? Math.hypot(middle_finger_base[0] - wrist[0], middle_finger_base[1] - wrist[1]) : 0;
}

interface ParameterOverride {
  value: number;
  expires_at_seconds: number;
}

const BREATH_PARAMETER_ID = "ParamBreath";
const EYE_OPEN_INPUT_NAMES = new Set(["EyeOpenLeft", "EyeOpenRight"]);
/** Seconds to blend between tracked face and neutral pose when the face appears or disappears. */
const TRACKING_FADE_SECONDS = 0.5;
const HAND_FADE_SECONDS = 0.15;

/**
 * Builds the final parameter values for each rendered frame, in this order:
 * tracking -> idle motion -> expression -> overrides -> physics -> clamp.
 */
export class AvatarFrameComposer implements AvatarControlPort {
  private model_definition: ModelDefinition | null = null;
  private mappings: ParameterMapping[] = [];
  private default_values: Record<string, number> = {};
  private smoothed_mapping_values = new Map<string, number>();
  private parameter_values: Record<string, number> = {};
  private overrides = new Map<string, ParameterOverride>();
  private expression_mixer = new ExpressionMixer();
  private parameter_physics = new ParameterPhysics([]);
  private readonly auto_blink: AutoBlink;
  private tracking_weight = 0;
  private hand_opacities: number[] = [0, 0];
  private elapsed_seconds = 0;
  private idle_motion_settings: IdleMotionSettings = { is_auto_blink_enabled: true, is_breathing_enabled: true };

  constructor(private readonly idle_motion_config: IdleMotionConfig) {
    this.auto_blink = new AutoBlink(
      idle_motion_config.auto_blink_min_interval_ms / 1000,
      idle_motion_config.auto_blink_max_interval_ms / 1000,
    );
  }

  load_model(model_definition: ModelDefinition | null, mappings: ParameterMapping[]): void {
    this.model_definition = model_definition;
    this.mappings = mappings;
    this.default_values = Object.fromEntries(
      (model_definition?.parameters ?? []).map((parameter) => [parameter.id, parameter.default_value]),
    );
    this.parameter_values = { ...this.default_values };
    this.smoothed_mapping_values.clear();
    this.overrides.clear();
    this.expression_mixer = new ExpressionMixer();
    this.parameter_physics = new ParameterPhysics(model_definition?.physics ?? []);
  }

  set_mappings(mappings: ParameterMapping[]): void {
    this.mappings = mappings;
  }

  set_idle_motion_settings(idle_motion_settings: IdleMotionSettings): void {
    this.idle_motion_settings = idle_motion_settings;
  }

  compose(tracking_frame: TrackingFrameInput, delta_seconds: number): Readonly<Record<string, number>> {
    this.elapsed_seconds += delta_seconds;
    const weight_change = delta_seconds / TRACKING_FADE_SECONDS;
    this.tracking_weight = Math.min(1, Math.max(0, this.tracking_weight + (tracking_frame.is_face_found ? weight_change : -weight_change)));

    const next_values: Record<string, number> = { ...this.default_values };
    this.apply_tracking(next_values, tracking_frame, delta_seconds);
    this.apply_idle_motion(next_values, delta_seconds);
    this.expression_mixer.apply(next_values, delta_seconds);
    this.apply_overrides(next_values);
    this.parameter_physics.step(next_values, delta_seconds);
    this.clamp_to_model_ranges(next_values);
    this.parameter_values = next_values;
    return next_values;
  }

  /**
   * Drawn hands for models with a hands block: placed on the canvas, faded in and out.
   * Returned back to front: the hand that looks bigger is nearer the camera and drawn last,
   * so touching hands overlap the right way round.
   */
  compose_hands(
    tracked_hands: readonly (TrackedHandInput | null)[],
    user_face: UserFaceAnchor | null,
    /** Moves the model's face anchor with its group (the head); identity without a renderer. */
    move_with_group: (group_id: string | undefined, point: FramePoint) => FramePoint,
    delta_seconds: number,
  ): RenderedHand[] {
    const model_hands = this.model_definition?.hands;
    if (!model_hands) return [];
    const model_face_center = move_with_group(model_hands.face_anchor.group_id, model_hands.face_anchor.center);
    const arms = model_hands.arms;
    // tracked_hands is [model's left, model's right]; left shoulder sits on the viewer's right.
    const shoulders = arms
      ? [move_with_group(arms.group_id, arms.left_shoulder), move_with_group(arms.group_id, arms.right_shoulder)]
      : [];
    // Only hands seen right now count; a lost hand keeps its last pose but must not pull the other.
    const visible_points = (tracked_hand: TrackedHandInput | null | undefined) => (tracked_hand?.is_present ? tracked_hand.points : null);
    const scale_pivots = hand_scale_pivots(visible_points(tracked_hands[0]), visible_points(tracked_hands[1]), user_face);
    const rendered_hands = tracked_hands.map((tracked_hand, hand_index) => {
      const target_opacity = tracked_hand?.is_present ? 1 : 0;
      const opacity_step = delta_seconds / HAND_FADE_SECONDS;
      const previous_opacity = this.hand_opacities[hand_index] ?? 0;
      const opacity = target_opacity > previous_opacity
        ? Math.min(target_opacity, previous_opacity + opacity_step)
        : Math.max(target_opacity, previous_opacity - opacity_step);
      this.hand_opacities[hand_index] = opacity;
      const points = tracked_hand
        ? place_hand_on_canvas(tracked_hand.points, model_hands, user_face, model_face_center, scale_pivots[hand_index])
        : [];
      const shoulder = shoulders[hand_index];
      const wrist = points[0];
      const arm_pose =
        arms && shoulder && wrist ? solve_arm(shoulder, wrist, arms.upper_arm_length, arms.forearm_length, hand_index === 0 ? 1 : -1) : null;
      return {
        points,
        opacity,
        is_behind_head: tracked_hand?.is_behind_head ?? false,
        ...(arm_pose && arms && { arm: { ...arm_pose, width: arms.width, color: arms.color, outline_color: arms.outline_color } }),
      };
    });
    return rendered_hands.sort((first_hand, second_hand) => palm_length(first_hand.points) - palm_length(second_hand.points));
  }

  describe_model(): AvatarModelDescription | null {
    if (!this.model_definition) return null;
    return {
      name: this.model_definition.metadata.name,
      parameters: this.model_definition.parameters.map((parameter) => ({
        id: parameter.id,
        display_name: parameter.display_name ?? parameter.id,
        minimum: parameter.minimum,
        maximum: parameter.maximum,
        default_value: parameter.default_value,
      })),
      expressions: this.model_definition.expressions.map((expression) => ({
        id: expression.id,
        display_name: expression.display_name,
      })),
    };
  }

  get_parameter_values(): Readonly<Record<string, number>> {
    return this.parameter_values;
  }

  set_parameter_overrides(parameter_values: Record<string, number>, hold_seconds?: number): void {
    const expires_at_seconds = hold_seconds === undefined ? Number.POSITIVE_INFINITY : this.elapsed_seconds + hold_seconds;
    for (const [parameter_id, value] of Object.entries(parameter_values)) {
      if (parameter_id in this.default_values && Number.isFinite(value)) {
        this.overrides.set(parameter_id, { value, expires_at_seconds });
      }
    }
  }

  clear_parameter_overrides(parameter_ids?: readonly string[]): void {
    if (!parameter_ids) return this.overrides.clear();
    for (const parameter_id of parameter_ids) this.overrides.delete(parameter_id);
  }

  get_parameter_overrides(): Readonly<Record<string, number>> {
    return Object.fromEntries([...this.overrides].map(([parameter_id, parameter_override]) => [parameter_id, parameter_override.value]));
  }

  set_expression(expression_id: string | null, playback?: ExpressionPlayback): void {
    const expression = this.model_definition?.expressions.find((model_expression) => model_expression.id === expression_id) ?? null;
    this.expression_mixer.activate(expression, playback);
  }

  get_active_expression_id(): string | null {
    return this.expression_mixer.active_expression_id;
  }

  private apply_tracking(next_values: Record<string, number>, tracking_frame: TrackingFrameInput, delta_seconds: number): void {
    for (const mapping of this.mappings) {
      if (!mapping.is_enabled || !(mapping.output_parameter_id in next_values)) continue;
      const input_value = tracking_frame.input_values[mapping.input_name];
      const default_value = this.default_values[mapping.output_parameter_id] ?? 0;
      const previous_value = this.smoothed_mapping_values.get(mapping.id) ?? default_value;
      const target_value = input_value === undefined ? previous_value : map_input_value(mapping, input_value);
      const smoothed_value = smooth_toward(previous_value, target_value, mapping.smoothing, delta_seconds);
      this.smoothed_mapping_values.set(mapping.id, smoothed_value);
      next_values[mapping.output_parameter_id] = default_value + (smoothed_value - default_value) * this.tracking_weight;
    }
  }

  private apply_idle_motion(next_values: Record<string, number>, delta_seconds: number): void {
    if (this.idle_motion_settings.is_breathing_enabled && BREATH_PARAMETER_ID in next_values) {
      next_values[BREATH_PARAMETER_ID] = breathing_value(this.elapsed_seconds, this.idle_motion_config.breathing_period_ms / 1000);
    }
    const blink_closure = this.auto_blink.step(delta_seconds);
    // Auto blink only replaces real blinking while the face is not tracked.
    const blink_strength = this.idle_motion_settings.is_auto_blink_enabled ? blink_closure * (1 - this.tracking_weight) : 0;
    if (blink_strength === 0) return;
    for (const mapping of this.mappings) {
      if (!EYE_OPEN_INPUT_NAMES.has(mapping.input_name)) continue;
      const eye_value = next_values[mapping.output_parameter_id];
      if (eye_value !== undefined) next_values[mapping.output_parameter_id] = eye_value * (1 - blink_strength);
    }
  }

  private apply_overrides(next_values: Record<string, number>): void {
    for (const [parameter_id, parameter_override] of this.overrides) {
      if (parameter_override.expires_at_seconds <= this.elapsed_seconds) {
        this.overrides.delete(parameter_id);
      } else {
        next_values[parameter_id] = parameter_override.value;
      }
    }
  }

  private clamp_to_model_ranges(next_values: Record<string, number>): void {
    for (const parameter of this.model_definition?.parameters ?? []) {
      const value = next_values[parameter.id];
      if (value !== undefined) next_values[parameter.id] = Math.min(parameter.maximum, Math.max(parameter.minimum, value));
    }
  }
}
