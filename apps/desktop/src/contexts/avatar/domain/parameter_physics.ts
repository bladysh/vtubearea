import type { PhysicsSpring } from "@vtubearea/model-format";

interface SpringState {
  position: number;
  velocity: number;
}

// Steps longer than this (a stalled tab) would make the spring explode.
const MAXIMUM_STEP_SECONDS = 1 / 30;

/**
 * Each spring chases its input parameter; the output parameter receives how far
 * the spring lags behind, which looks like hair swinging after a head turn.
 */
export class ParameterPhysics {
  private readonly spring_states = new Map<string, SpringState>();

  constructor(private readonly springs: readonly PhysicsSpring[]) {}

  step(parameter_values: Record<string, number>, delta_seconds: number): void {
    let remaining_seconds = Math.min(delta_seconds, 0.25);
    while (remaining_seconds > 0) {
      const step_seconds = Math.min(remaining_seconds, MAXIMUM_STEP_SECONDS);
      for (const spring of this.springs) this.step_spring(spring, parameter_values, step_seconds);
      remaining_seconds -= step_seconds;
    }
  }

  private step_spring(spring: PhysicsSpring, parameter_values: Record<string, number>, step_seconds: number): void {
    const target_position = parameter_values[spring.input_parameter_id] ?? 0;
    let spring_state = this.spring_states.get(spring.id);
    if (!spring_state) {
      spring_state = { position: target_position, velocity: 0 };
      this.spring_states.set(spring.id, spring_state);
    }
    const acceleration = spring.stiffness * (target_position - spring_state.position) - spring.damping * spring_state.velocity;
    spring_state.velocity += acceleration * step_seconds;
    spring_state.position += spring_state.velocity * step_seconds;
    parameter_values[spring.output_parameter_id] = (target_position - spring_state.position) * spring.output_scale;
  }
}
