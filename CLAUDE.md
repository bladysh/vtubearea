# vTubeArea

Always work in ponytail mode (`.claude/skills/ponytail`, level full) for every coding task.
Use the matching ponytail skill when the task fits: `ponytail-review` for reviewing a change,
`ponytail-audit` for the whole repo, `ponytail-debt` for `shortcut:` comments,
`ponytail-gain` and `ponytail-help` on request.

## Project rules (from the owner)

- Read `docs/architecture/overview.md` first; the plan is in `docs/` (local only, git-ignored).
- Names: snake_case for variables, functions, files; PascalCase for types and React components;
  camelCase only for React hooks (`useSomething`, React tooling requires it). Long names are fine,
  single letters are not (except x/y/z/w).
- DDD layout per context: `domain/ application/ infrastructure/ presentation/`. No dumping files in one folder.
- No file over 700 lines.
- Anything tunable goes to `.env` (`.env.example` + `src/config/app_config.ts`, `VTUBEAREA_*` for Rust)
  or to persisted user settings. No magic numbers hidden in components.
- Every user-visible string in RU and EN (`packages/ui/src/i18n/locales`).
- License: PolyForm Noncommercial 1.0.0 (free, no commercial use; owner may relicense). Only MIT/Apache/BSD/ISC/Zlib/MPL deps; record in `THIRD_PARTY.md`.
  No Live2D Cubism, no VTube Studio assets.
- Outside control of the avatar goes through `AvatarControlPort` only.
- `pnpm check` must pass before calling work done.
