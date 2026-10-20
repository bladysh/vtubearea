import type { FaceFrame, TrackingSource } from "@vtubearea/protocol";
import { apply_expression_ranges, ExpressionRangeRecorder, type ExpressionRanges } from "../domain/expression_calibration";
import { apply_neutral_face, NeutralFaceRecorder, type NeutralFace } from "../domain/face_calibration";
import { AdaptiveRange } from "../domain/adaptive_range";
import { bend_eye_closing } from "../domain/eye_openness";
import type { FaceAnchor } from "../domain/face_anchor";
import type { AvatarSide } from "../domain/hand_inputs";
import type { TrackedHandSkeleton } from "../domain/hand_skeleton";
import { filter_settings_for_smoothness, OneEuroFilter } from "../domain/one_euro_filter";
import { derive_tracking_inputs, tracking_input_behavior, type TrackingInputValues } from "../domain/tracking_inputs";
import { DEFAULT_TRACKING_SETTINGS, type TrackingSettings } from "../domain/tracking_settings";
import { HandTrackingState } from "./hand_tracking_state";

export interface TrackingSnapshot {
  is_face_found: boolean;
  source: TrackingSource | null;
  input_values: TrackingInputValues;
  /** Latest raw frame, for the debug view. */
  latest_frame: FaceFrame | null;
  frames_per_second: number;
  /** Capture to hub, in milliseconds. */
  latency_ms: number;
  /** Smoothed hand skeletons per avatar side, null if that hand was never seen. */
  hand_skeletons: Record<AvatarSide, TrackedHandSkeleton | null>;
  /** Where the user's face is in the picture (same units as the skeletons). */
  face_anchor: FaceAnchor | null;
}

const FRAME_RATE_WINDOW_SIZE = 30;

/**
 * Single entry point for every tracking source. Turns raw frames into calibrated,
 * filtered inputs. The renderer side reads snapshots and never sees a source directly.
 */
export class TrackingHub {
  private settings: TrackingSettings = DEFAULT_TRACKING_SETTINGS;
  private neutral_face: NeutralFace | null = null;
  private calibration_recorder: NeutralFaceRecorder | null = null;
  private expression_ranges: ExpressionRanges | null = null;
  private expression_recorder: ExpressionRangeRecorder | null = null;
  private readonly filters = new Map<string, OneEuroFilter>();
  private readonly frame_arrival_times_ms: number[] = [];
  private input_values: TrackingInputValues = {};
  private latest_frame: FaceFrame | null = null;
  private last_face_seen_ms = Number.NEGATIVE_INFINITY;
  private latency_ms = 0;
  private readonly hand_tracking_state: HandTrackingState;
  // Per-eye learned open/closed range; see AdaptiveRange.
  private readonly eye_ranges = { EyeOpenLeft: new AdaptiveRange(0.25, 0.04), EyeOpenRight: new AdaptiveRange(0.25, 0.04) };
  private last_face_frame_ms: number | null = null;

  constructor(
    private readonly face_lost_timeout_ms: number,
    private readonly now_ms: () => number = () => performance.now(),
    hand_lost_timeout_ms = 300,
  ) {
    this.hand_tracking_state = new HandTrackingState(hand_lost_timeout_ms);
    this.hand_tracking_state.update_smoothness(this.settings.smoothness);
  }

  update_settings(settings: TrackingSettings): void {
    this.settings = settings;
    for (const [input_name, filter] of this.filters) this.apply_filter_settings(input_name, filter);
    this.hand_tracking_state.update_smoothness(settings.hand_smoothness);
  }

  set_neutral_face(neutral_face: NeutralFace | null): void {
    this.neutral_face = neutral_face;
  }

  set_expression_ranges(expression_ranges: ExpressionRanges | null): void {
    this.expression_ranges = expression_ranges;
  }

  /**
   * Records how far the user really moves brows and mouth (relative to the relaxed face) while
   * they pull faces for the given time. Resolves to null if no face was seen.
   */
  async calibrate_expressions(duration_ms: number): Promise<ExpressionRanges | null> {
    this.expression_recorder = new ExpressionRangeRecorder();
    await new Promise((resolve) => setTimeout(resolve, duration_ms));
    const expression_ranges = this.expression_recorder.finish();
    this.expression_recorder = null;
    if (expression_ranges) this.expression_ranges = expression_ranges;
    return expression_ranges;
  }

  /** Records the relaxed face for the given time. Resolves to null if no face was seen. */
  async calibrate(duration_ms: number): Promise<NeutralFace | null> {
    this.calibration_recorder = new NeutralFaceRecorder();
    await new Promise((resolve) => setTimeout(resolve, duration_ms));
    const neutral_face = this.calibration_recorder.finish();
    this.calibration_recorder = null;
    if (neutral_face) this.neutral_face = neutral_face;
    return neutral_face;
  }

  push_frame(face_frame: FaceFrame): void {
    const arrival_ms = this.now_ms();
    this.latest_frame = face_frame;
    this.latency_ms = Math.max(0, arrival_ms - face_frame.timestamp_ms);
    this.frame_arrival_times_ms.push(arrival_ms);
    if (this.frame_arrival_times_ms.length > FRAME_RATE_WINDOW_SIZE) this.frame_arrival_times_ms.shift();
    // Hands are handled even without a face: a hand in front of the face often hides it.
    this.hand_tracking_state.push_frame(face_frame, arrival_ms, this.settings);
    if (!face_frame.face_found) return;

    const delta_seconds = this.last_face_frame_ms === null ? 0 : (arrival_ms - this.last_face_frame_ms) / 1000;
    this.last_face_frame_ms = arrival_ms;
    this.last_face_seen_ms = arrival_ms;
    const raw_inputs = derive_tracking_inputs(face_frame, this.settings.is_mirrored, this.settings.is_eye_sync_enabled);
    for (const [input_name, eye_range] of Object.entries(this.eye_ranges)) {
      const eye_openness = raw_inputs[input_name];
      if (eye_openness !== undefined) raw_inputs[input_name] = bend_eye_closing(eye_range.normalize(eye_openness, delta_seconds), this.settings.eye_closing_lateness);
    }
    this.calibration_recorder?.add_sample(raw_inputs);
    const relaxed_relative_inputs = apply_neutral_face(raw_inputs, this.neutral_face);
    this.expression_recorder?.add_sample(relaxed_relative_inputs);
    const calibrated_inputs = apply_expression_ranges(relaxed_relative_inputs, this.expression_ranges);
    this.input_values = this.filter_inputs(this.apply_sensitivity(calibrated_inputs), arrival_ms / 1000);
  }

  snapshot(): TrackingSnapshot {
    const is_face_found = this.now_ms() - this.last_face_seen_ms <= this.face_lost_timeout_ms;
    if (!is_face_found) for (const filter of this.filters.values()) filter.reset();
    return {
      is_face_found,
      source: this.latest_frame?.source ?? null,
      input_values: { ...this.input_values, ...this.hand_tracking_state.input_values() },
      latest_frame: this.latest_frame,
      frames_per_second: this.frames_per_second(),
      latency_ms: this.latency_ms,
      hand_skeletons: this.hand_tracking_state.skeletons(),
      face_anchor: this.hand_tracking_state.current_face_anchor(),
    };
  }

  private apply_sensitivity(input_values: TrackingInputValues): TrackingInputValues {
    const adjusted_values: TrackingInputValues = {};
    for (const [input_name, value] of Object.entries(input_values)) {
      const behavior = tracking_input_behavior(input_name);
      const sensitivity = behavior.group === "other" ? 1 : this.settings.sensitivity_by_group[behavior.group];
      adjusted_values[input_name] = behavior.neutral_value + (value - behavior.neutral_value) * sensitivity;
    }
    return adjusted_values;
  }

  private filter_inputs(input_values: TrackingInputValues, time_seconds: number): TrackingInputValues {
    const filtered_values: TrackingInputValues = {};
    for (const [input_name, value] of Object.entries(input_values)) {
      const typical_range = tracking_input_behavior(input_name).typical_range;
      filtered_values[input_name] = this.filter_for(input_name).filter(value / typical_range, time_seconds) * typical_range;
    }
    return filtered_values;
  }

  private filter_for(input_name: string): OneEuroFilter {
    let filter = this.filters.get(input_name);
    if (!filter) {
      filter = new OneEuroFilter(1, 1);
      this.apply_filter_settings(input_name, filter);
      this.filters.set(input_name, filter);
    }
    return filter;
  }

  private apply_filter_settings(input_name: string, filter: OneEuroFilter): void {
    const filter_settings = filter_settings_for_smoothness(this.settings.smoothness);
    const responsiveness = tracking_input_behavior(input_name).responsiveness;
    filter.minimum_cutoff_hertz = filter_settings.minimum_cutoff_hertz * responsiveness;
    filter.speed_coefficient = filter_settings.speed_coefficient * responsiveness;
  }

  private frames_per_second(): number {
    const arrival_times = this.frame_arrival_times_ms;
    if (arrival_times.length < 2) return 0;
    const elapsed_ms = arrival_times[arrival_times.length - 1]! - arrival_times[0]!;
    if (this.now_ms() - arrival_times[arrival_times.length - 1]! > 1000) return 0;
    return elapsed_ms > 0 ? ((arrival_times.length - 1) * 1000) / elapsed_ms : 0;
  }
}
