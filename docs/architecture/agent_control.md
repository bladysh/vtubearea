# Agent control (MCP / AI) — groundwork

Goal: an AI agent or plugin can drive the avatar (set expressions, move
parameters, read state) without touching renderer or tracking code.

## What exists now

`AvatarControlPort` (`apps/desktop/src/contexts/avatar/application/avatar_control_port.ts`):

| Method | Effect |
| --- | --- |
| `describe_model()` | Name, parameters (id, range, default), expressions |
| `get_parameter_values()` | Current final values |
| `set_parameter_overrides(values, hold_seconds?)` | Pin values over tracking, optionally for a limited time |
| `clear_parameter_overrides(ids?)` | Back to tracking |
| `set_expression(id \| null)` | Fade an expression in or out |
| `get_active_expression_id()` | Current expression |

The debug panel's pin buttons already use this port, so it is exercised today.
`app_runtime.ts` exports the single instance as `avatar_control`.

## Next step (when we build it)

1. Rust: a local WebSocket server (bound to 127.0.0.1, port from env, off by default).
2. Each request is forwarded to the WebView as a Tauri event; a small adapter in
   `contexts/agent_control/infrastructure` calls `avatar_control` and replies.
3. An MCP server (stdio) is a thin client of that WebSocket, exposing the methods
   above as tools: `describe_avatar`, `set_expression`, `set_parameters`, `reset`.
4. Security: first connection of a new client asks for confirmation in the UI,
   like VTube Studio plugin auth. Overrides from agents always use `hold_seconds`
   so a crashed agent cannot freeze the face.
