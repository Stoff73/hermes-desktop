# Tech debt

Rolling ledger of known shortcuts and deferred fixes in hermes-desktop. Maintained by the repo-local `session-end` skill; read by `session-start` only when a handover points at it.

Rules: one line per item, delete when fixed, never append dated blocks.

Format: `- [ ] **<file:line>** — <what> — <why deferred> (added YYYY-MM-DD)`

## Open

- [ ] **`hermes_cli/main_web_build.py` (upstream `NousResearch/hermes-agent`)** — first npm install runs `--silent`, so a failure reports zero output — lives in the upstream repo, not here (added 2026-09-07)
- [ ] **Release pipeline** — Windows builds ship unsigned; SmartScreen warns users — needs a paid OV/EV cert, CSJ's purchase decision (added 2026-09-07)
- [ ] **Release pipeline** — notarisation ticket is stapled to the app but not the `.dmg`, so first open needs a network round-trip — cosmetic, low priority (added 2026-09-07)
- [ ] **`.claude/settings.json`** — `UserPromptSubmit`/`Stop` hooks call `lat`, which is not installed on PATH, so they fail silently every turn — fix is `npm i -g lat.md`; until then run `npx -y lat.md check` (added 2026-09-11)
- [ ] **`~/.claude/skills/session-start`, `~/.claude/skills/session-end`** — global skills shadow the repo-local ones in `.claude/skills/` when invoked as `/session-start` or `/session-end`; global versions write to an Obsidian vault this repo does not use — rename or delete the global pair, or invoke the local skill by reading `.claude/skills/<name>/SKILL.md` (added 2026-09-11)
