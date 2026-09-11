---
type: handover
mode: session-end
date: 2026-09-11
session: 1
repo: hermes-desktop
branch: main
---

# Session Handover — 2026-09-11, Session 1

## Where things stand

This session added repo-local `session-start` and `session-end` skills under `.claude/skills/` plus a root `techDebt.md` ledger, so handovers no longer depend on the global skills that mirror to an Obsidian vault. Nothing in the app changed. The gap of 19 commits and releases 0.8.2 → 0.8.9 since the 07 September handover is still uncovered by any handover; the priorities below carry that handover's items forward, re-scoped where the drift makes them stale.

## Priorities for the next session

1. **Windows code signing — BLOCKED ON CSJ.** Do you want to buy an OV cert (days to issue) or an EV cert (hardware token)? Builds ship unsigned and SmartScreen warns until one exists. Purchase decision, no code.
2. **Make `/session-start` and `/session-end` invoke the repo-local skills.** Running `/session-end` this session loaded `~/.claude/skills/session-end`, not `.claude/skills/session-end`. Either rename the global pair (e.g. `fynla-session-*`) or delete them for this machine. Until fixed, follow `.claude/skills/<name>/SKILL.md` by hand.
3. **Install `lat` on PATH** (`npm i -g lat.md`). The hooks in `.claude/settings.json` and the CLAUDE.md gate both call it and currently fail silently.
4. **Re-scope the auto-update check.** The 07 September priority was 0.8.0 → 0.8.1; `79cc58f` changed the updater since and 0.8.9 is current. Pick a meaningful old/new pair, install the old `.dmg`, confirm it offers the new one.
5. **Walk onboarding on the packaged build.** Still only exercised in dev mode as of the 07 September handover; unknown whether any of the eight point releases since did this.

## Context to load

- `.claude/skills/session-start/SKILL.md` — the resume procedure this handover was written for; read it instead of the global one.
- `.claude/skills/session-end/SKILL.md` — the wrap procedure; its handover template is the one above.
- `techDebt.md` — the two entries added today (`lat` on PATH, global skill shadowing) are priorities 2 and 3.
- `docs/RELEASING.md` — read before touching the release pipeline for priority 1 or 4.
- `handover/September/07/handover-2026-09-07-session-1.md` — the last handover with app-level context; its Decisions and dead ends still apply.

## Completed this session

- `.claude/skills/session-start/SKILL.md` and `.claude/skills/session-end/SKILL.md` written, stripped of vault, CSJTODO, legacy `*Updates` layout and the `tech-debt-session` skill. `session-end` writes `handover/<Month>/<DD>/` and maintains `techDebt.md`.
- `techDebt.md` seeded with the three deferred items from 07 September plus two found today.
- Dry run: a fresh Sonnet agent given only the local `session-start` skill produced a correct briefing from the 07 September handover and flagged the drift. Its four wording ambiguities were fixed in the skill.
- All three committed alongside this handover (SHA in the commit log after this file).

## Verification state

- `lat check`: pass at 7ec7022 plus the untracked files (run via `npx -y lat.md check`).
- `npm test` / `npm run typecheck`: not run. No source changed.
- Not verified: that `/session-start` picks up the local skill in a fresh session. Evidence from this session says it does not (see priority 2).

## Decisions and dead ends

- CSJ decided handovers live in `handover/{Month}/{DD}/` and tech debt in a root `techDebt.md` the handover points at. Do not reintroduce vault mirroring or CSJTODO.md in this repo.
- Skills were not added to `lat.md/`. They document developer process, not app behaviour, which is what `lat.md/` is for.
- A claude-code-guide lookup said project skills override user skills on a name clash. Observed behaviour contradicts that for slash commands. Trust the observation.

## Things that will bite you

- The global skill listing still shows the Obsidian descriptions for `session-start` and `session-end`. If a briefing mentions a vault or `fynlaBrain`, the wrong skill ran.
- `lat` is only reachable via `npx -y lat.md`, which downloads on first use.

## Tech debt

See `techDebt.md` at the repo root. Two entries added today: `lat` missing from PATH and global skills shadowing local ones. Act on those first; the three older entries are unchanged.

## Branch and deploy state

- Branch: main
- Unpushed commits: none before this handover
- Release: v0.8.9 tagged upstream; HEAD `7ec7022` is the 0.8.9 release commit
