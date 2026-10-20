/** A parameter that only takes a few values (e.g. squint steps), with a dead band against flicker. */
export interface ParameterSnap {
  values: readonly number[];
  hysteresis: number;
}

/**
 * Snaps values to the nearest allowed value, but leaves the current one only after the input has
 * moved past the halfway point by `hysteresis`: noise around a boundary keeps the same step
 * instead of flickering between two drawings. A fast change (a blink) still jumps in one frame.
 */
export class ParameterSnapper {
  private readonly current_values = new Map<string, number>();

  snap(parameter_id: string, value: number, parameter_snap: ParameterSnap): number {
    const nearest = parameter_snap.values.reduce((best, candidate) => (Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best));
    const current = this.current_values.get(parameter_id);
    if (current === undefined || nearest === current) {
      this.current_values.set(parameter_id, nearest);
      return nearest;
    }
    const boundary = (current + nearest) / 2;
    const has_cleared_boundary = nearest > current ? value > boundary + parameter_snap.hysteresis : value < boundary - parameter_snap.hysteresis;
    if (has_cleared_boundary) this.current_values.set(parameter_id, nearest);
    return this.current_values.get(parameter_id)!;
  }

  reset(): void {
    this.current_values.clear();
  }
}
