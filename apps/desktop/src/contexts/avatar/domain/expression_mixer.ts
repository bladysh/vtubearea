import type { ModelExpression } from "@vtubearea/model-format";

/**
 * once: fade in, hold, fade out by itself (default, like a reaction).
 * hold: stays until switched off.
 * loop: once, again and again until switched off.
 */
export type ExpressionPlaybackMode = "once" | "hold" | "loop";

export interface ExpressionPlayback {
  mode: ExpressionPlaybackMode;
  /** Time at full strength for once and loop. */
  hold_seconds: number;
  /** Loop only: how many times to play; 0 = until switched off. */
  repeat_count: number;
}

export const DEFAULT_EXPRESSION_PLAYBACK: ExpressionPlayback = { mode: "once", hold_seconds: 1.5, repeat_count: 0 };

// Pause between repeats in loop mode, relative to the hold time.
const LOOP_PAUSE_RATIO = 0.5;

interface ActiveExpression {
  expression: ModelExpression;
  playback: ExpressionPlayback;
  weight: number;
  /** Time spent at full strength (or paused, between loop repeats). */
  phase_seconds: number;
  phase: "fade_in" | "hold" | "fade_out" | "loop_pause";
  completed_cycles: number;
  /** Switched off or replaced: fades out and is removed, never restarts. */
  is_stopping: boolean;
}

/** Blends expressions (sets of parameter values) on top of tracking with fades. */
export class ExpressionMixer {
  private active_expressions: ActiveExpression[] = [];

  /** The expression currently playing (not one that is only fading away). */
  get active_expression_id(): string | null {
    const playing_expression = this.active_expressions.find(
      (active_expression) => !active_expression.is_stopping && !this.is_on_last_fade_out(active_expression),
    );
    return playing_expression?.expression.id ?? null;
  }

  /** Starts the expression, fading out whatever played before. null stops everything. */
  activate(expression: ModelExpression | null, playback: ExpressionPlayback = DEFAULT_EXPRESSION_PLAYBACK): void {
    for (const active_expression of this.active_expressions) active_expression.is_stopping = true;
    if (expression) {
      this.active_expressions.push({ expression, playback, weight: 0, phase_seconds: 0, phase: "fade_in", completed_cycles: 0, is_stopping: false });
    }
  }

  apply(parameter_values: Record<string, number>, delta_seconds: number): void {
    for (const active_expression of this.active_expressions) {
      this.advance(active_expression, delta_seconds);
      for (const [parameter_id, expression_value] of Object.entries(active_expression.expression.parameter_values)) {
        const current_value = parameter_values[parameter_id] ?? 0;
        parameter_values[parameter_id] = current_value + (expression_value - current_value) * active_expression.weight;
      }
    }
    this.active_expressions = this.active_expressions.filter((active_expression) => !this.is_finished(active_expression));
  }

  private advance(active_expression: ActiveExpression, delta_seconds: number): void {
    const fade_step = delta_seconds / Math.max(active_expression.expression.fade_seconds, 1e-3);
    if (active_expression.is_stopping) {
      active_expression.weight = Math.max(0, active_expression.weight - fade_step);
      return;
    }
    const { mode, hold_seconds } = active_expression.playback;
    switch (active_expression.phase) {
      case "fade_in":
        active_expression.weight = Math.min(1, active_expression.weight + fade_step);
        if (active_expression.weight === 1) this.enter_phase(active_expression, "hold");
        break;
      case "hold":
        active_expression.phase_seconds += delta_seconds;
        if (mode !== "hold" && active_expression.phase_seconds >= hold_seconds) this.enter_phase(active_expression, "fade_out");
        break;
      case "fade_out":
        active_expression.weight = Math.max(0, active_expression.weight - fade_step);
        if (active_expression.weight === 0) {
          active_expression.completed_cycles += 1;
          if (mode === "loop" && !this.is_on_last_fade_out(active_expression)) this.enter_phase(active_expression, "loop_pause");
        }
        break;
      case "loop_pause":
        active_expression.phase_seconds += delta_seconds;
        if (active_expression.phase_seconds >= hold_seconds * LOOP_PAUSE_RATIO) this.enter_phase(active_expression, "fade_in");
        break;
    }
  }

  private enter_phase(active_expression: ActiveExpression, phase: ActiveExpression["phase"]): void {
    active_expression.phase = phase;
    active_expression.phase_seconds = 0;
  }

  private is_finished(active_expression: ActiveExpression): boolean {
    if (active_expression.weight > 0) return false;
    return active_expression.is_stopping || this.is_on_last_fade_out(active_expression);
  }

  /** Fading out for the last time: once always, loop after its repeat count. */
  private is_on_last_fade_out(active_expression: ActiveExpression): boolean {
    if (active_expression.phase !== "fade_out") return false;
    const { mode, repeat_count } = active_expression.playback;
    if (mode === "once") return true;
    // completed_cycles counts finished fade-outs; during the current one it is one less.
    const cycles_including_current = active_expression.completed_cycles + (active_expression.weight > 0 ? 1 : 0);
    return mode === "loop" && repeat_count > 0 && cycles_including_current >= repeat_count;
  }
}
