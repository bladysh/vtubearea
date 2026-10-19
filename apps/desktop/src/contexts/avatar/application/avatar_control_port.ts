import type { ExpressionPlayback } from "../domain/expression_mixer";

export interface AvatarParameterDescription {
  id: string;
  display_name: string;
  minimum: number;
  maximum: number;
  default_value: number;
}

export interface AvatarModelDescription {
  name: string;
  parameters: AvatarParameterDescription[];
  expressions: { id: string; display_name: string }[];
}

/**
 * Everything an outside controller may do with the avatar: the debug panel today,
 * an MCP server or plugin WebSocket API later. Adapters call this port and never
 * touch renderer or tracking internals.
 */
export interface AvatarControlPort {
  describe_model(): AvatarModelDescription | null;
  get_parameter_values(): Readonly<Record<string, number>>;
  /** Overrides win over tracking. With hold_seconds they expire on their own. */
  set_parameter_overrides(parameter_values: Record<string, number>, hold_seconds?: number): void;
  /** Clears the given overrides, or all when no ids are passed. */
  clear_parameter_overrides(parameter_ids?: readonly string[]): void;
  get_parameter_overrides(): Readonly<Record<string, number>>;
  /** null returns to the plain tracked face. Playback defaults to once. */
  set_expression(expression_id: string | null, playback?: ExpressionPlayback): void;
  get_active_expression_id(): string | null;
}
