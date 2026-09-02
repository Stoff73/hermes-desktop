---
type: handover
mode: session-end
date: 2026-09-02
session: 2
repo: hermes-desktop
branch: main
---

# Session Handover — 2026-09-02, Session 2

## Where things stand

Design work is finished and approved; implementation has not started. The spec (`docs/superpowers/specs/2026-09-02-memory-screen-design.md`) was reviewed against the code, broadened on CSJ's answers to cover Agent Settings as a whole — per-agent LLM model/provider pin, the Obsidian vault as a fifth memory system, edit-level write protection — and the plan (`docs/superpowers/plans/2026-09-02-memory-per-agent.md`) was rewritten as 14 tasks / 107 checkbox steps with an execution protocol for inline execution. **No implementation code exists. Task 0 has not been started.** CSJ's instruction for the next session, verbatim: "make sure the next inference uses the plan to implement the code changes."

## Priorities for the next session

1. **Execute the plan, starting at Task 0.** Open `docs/superpowers/plans/2026-09-02-memory-per-agent.md`, read **Execution protocol** and **Global Constraints**, invoke `superpowers:executing-plans`, and work the tasks in order. Every step has the code and the command; tick each `- [ ]` in the plan file as you go and commit the plan file with each task's commit so progress is visible in git. Update the **Progress** table and use the **Execution log** for the baseline (Task 0) and any blocker. Branch name is fixed by the plan: `feat/agent-settings-memory`. Do not implement on `main`. CSJ chose inline execution; do not switch to subagent-driven without asking. Not blocked on anything.
2. **`package-lock.json` — ask once, do not block.** It has been modified since before session 1 (npm shuffling `peer: true` flags and dropping `@emotion/memoize`; the churn of a different npm version running install). Deliberately left uncommitted twice. Ask CSJ whether to commit, revert, or leave, then move on with priority 1 regardless.
3. **SSH mode is an open product question, not a task.** CSJ asked "what do we need SSH for again?" The answer given: the app already ships an "SSH Tunnel" connection mode that points the desktop at a remote Hermes install, and all memory readers/writers already have SSH twins that `register.ts` selects automatically. The plan keeps the twins in step (a few lines per task) so SSH mode does not regress. Whether SSH belongs in a macOS product for local agents is a separate, app-wide decision CSJ has not made. Do not remove SSH support inside this plan.
4. **After the plan lands: presets and onboarding spec.** CSJ's product vision (see *Decisions*) needs preset agents and a first-run flow. The spec's last section records the hook: `createProfile` already supports `--clone-from`. That is a fresh brainstorm → spec → plan cycle, not part of this plan.

## Context to load

- `docs/superpowers/plans/2026-09-02-memory-per-agent.md` — the thing you execute. Read the Execution protocol, Progress table, File map and Global Constraints before Task 0. Every task is self-contained with verbatim code.
- `docs/superpowers/specs/2026-09-02-memory-screen-design.md` — the approved design the plan argues from. Read it once before starting; consult it when a task's intent is unclear.
- `CLAUDE.md` — mandatory repo workflow: `lat.md/` must be updated and `npx --yes lat.md check` must pass. The plan's Task 12 does this, but the rule applies to any deviation too.
- `src/main/memory.ts` — Tasks 2 and 5 rewrite most of it. Current shape: two markdown files plus a `stats` session count.
- `src/renderer/src/components/profile/ProfileModal.tsx` — the Agent Settings modal; Tasks 9 and 11 extend it (Memory tab, model picker, labels). Already has `persona` and `agentMemory` sections.

## Completed this session

- **Plan reviewed against the code before execution** (CSJ asked for this explicitly). Six plan defects found and fixed: duplicated `providerBuiltIn` i18n key across two tasks (TS error), `CapacityCards` deleted in two tasks, tests omitting a required `providers` prop (`tsconfig.web.json` includes tests so typecheck fails), Task 9 dropping the modal pane wrapper, `SshProfileInfo` having no `id` field, and SSH session stats always reporting `available: true`.
- **Seven design questions asked and answered by CSJ** — see *Decisions*.
- **Spec revised** (`e8d45a3`): retitled "Agent Settings: memory, model and vault per agent"; five systems; model/provider pin in the Profile tab reusing the chat's `useModelConfig(profile)` + `ModelPicker` in persist mode; inline missing-key field driven by the existing per-profile config health check (`MODEL_KEY_MISSING`); Obsidian vault row backed by `OBSIDIAN_VAULT_PATH` in the profile `.env`; two-level write protection (compare-and-swap at write time + expected-content at edit time); `provider.installed` and last activity rendered; presets/onboarding recorded as later work.
- **Plan rewritten** (`e8d45a3`): 14 tasks, execution protocol naming which skill to invoke at which step, Progress table, File map, Execution log; every step with verbatim code and expected output.
- **Vault unlink corrected** (`d387b26`): CSJ rejected leaving a blank `OBSIDIAN_VAULT_PATH=` line. Plan now adds `removeEnvValue` in `config.ts`, `sshRemoveEnvValue`, IPC `remove-env`, preload `removeEnv`, and the vault pane calls it. Task 7 grew to 16 steps.
- **Memory notes saved** (outside the repo, in the Claude memory dir): CSJ's product vision; CSJ's preference for batched questions and for plans written for Opus 5 inline execution with tick-boxes.

## Verification state

- `npx --yes lat.md check`: **All checks passed** at `d387b26` (docs unchanged in `lat.md/`; the plan's Task 12 adds `lat.md/memory.md` and `lat.md/agent-settings.md`).
- `npm run typecheck`, `eslint`, `vitest`: **not run this session** — no code changed. Session 1 measured 1903 passed / 3 failed at `74a14f0`, the 3 in `tests/gateway-restart.test.ts` and `tests/terminal-launcher.test.ts`, also failing on a stashed clean tree. Task 0 Step 3 tells the executor to re-measure the baseline itself and record it in the Execution log; trust that, not this.
- No tech-debt pass: the `tech-debt-session` skill is not installed, and only two markdown files changed.

## Decisions and dead ends

CSJ's answers this session — settled, do not re-ask:

- **"Provider" in per-agent settings means the LLM provider.** Each agent gets a model/provider pick in its own settings (Profile tab), saved to that agent's `config.yaml`. The memory-provider row stays as well. Implemented by reusing the chat's hook and picker; nothing new below the renderer.
- **Missing key → inline key field** on the Profile tab, writing to that agent's `.env`. OAuth providers get a hint to sign in from Providers with that agent active.
- **Vault label is "Obsidian vault."** It is a skill folder, not a memory provider; it joins the inventory as a Configurable row because the env var is profile-scoped.
- **Openers say "Agent settings."** The `agentMemory` tab is labelled "Memory" (it now contains a row called "Agent Memory"). A kicker "Agent settings" sits above the agent name in the modal sidebar.
- **Persona stays as a tab in Agent Settings.** CSJ briefly thought it was being removed; it only leaves the top-level Memory overview. Do not re-add it as a memory system.
- **Write protection is two-level.** CSJ wants nothing overwritten. The plan's original compare-and-swap only closed a microsecond window; the plan now also sends what the user saw (`expected`) so a stale edit fails with `conflict` instead of overwriting, and index shifts after the agent reorders entries are caught. Database and vault need nothing: the desktop reads `state.db` read-only, keeps its own tables separate, and writes only the vault path. Config/env writes are already atomic.
- **Unlink removes the env line.** Blanking it was wrong; a remover was added.
- **Order:** memory tasks first, model picker (Task 11) and vault (inside Task 7) appended. Inline execution by Opus 5 with checkbox tracking.
- **Session Search detail** stays thin: counts, last activity, hint to use the Sessions screen. No navigation button.
- **`provider.installed` is rendered, not cut. Last activity is rendered.** Over SSH `installed` is reported `true` (remote plugin dir not cheaply reachable) — a recorded simplification.

Carried forward from session 1, still settled: fcntl locking rejected (Node has no `flock`; `proper-lockfile` uses `mkdir`); stop/restart-on-save rejected (memory is a frozen snapshot at session start); systems-inventory approach chosen; top-level Memory screen is read-only; `getActiveMemoryProvider` regex bug is real (returns `"xai"` on both real profiles) and Task 3 fixes it.

## Things that will bite you

- **Execute on a branch.** The plan says `feat/agent-settings-memory`. Git hooks only run on `release*` branches, so commits are not gated there.
- **`SshProfileInfo` has no `id`;** its `name` is the directory slug. The plan's SSH branch maps `id: p.name`.
- **`tsconfig.web.json` includes test files**, so a renderer test that omits a required prop fails `npm run typecheck:web`, not just the test.
- **Renderer tests mock `useI18n` so `t()` returns the key** (`ConfigHealthBanner.test.tsx:8-13`). Never assert English copy. The plan's mocks append interpolation values as `key:a,b`.
- **`t()` falls back to English** for missing keys (`src/shared/i18n/index.ts:624`), so English-only string additions are safe.
- **`lat` is not installed globally.** Use `npx --yes lat.md check` / `locate`. Section ids include the H1: `memory#Memory#Tests#<leaf>`.
- **The Electron window opens on a second display at negative X.** Get bounds via `osascript` (command in plan Task 12 Step 7) before `screencapture`; confirm the PID is the current Electron.
- **`npm run dev` piped through `tail` looks hung** (buffering). Redirect to a file.
- **Profile `web-wizard-agent`** has no `config.yaml`, `.env` or `memories/` — the empty-state fixture.
- **`getActiveMemoryProvider` returns `"xai"`** until Task 3 lands; anything read from the Providers UI before then is wrong.
- **`date-fns` and `lucide-react` are already dependencies**; the plan uses `formatDistanceToNowStrict` and `BookOpen`/`Search`/`Cloud` icons. Do not add packages.
- **Memory screen is hidden only in HTTP "remote" mode** (`isRemoteOnlyMode()` is `mode === "remote"`); SSH mode renders it, so Task 6's SSH branch is reachable.

## Tech debt deferred

No pass ran (skill not installed; docs-only session). Noted by eye, not fixed:

- `src/renderer/src/screens/Memory/MemoryEntries.tsx:104,112` — hardcoded "Cancel"/"Save" strings in the add-entry form, untranslated. Out of the plan's scope; leave unless touching those lines anyway.
- `src/renderer/src/assets/main.css:547` — global `:focus-visible` inset ring still applies to every focusable element except `.chat-input` (session 1 item).
- 11 non-English locales carry stale "API Server Key" wording; only `en` was updated in session 1. Task 9's label changes are also English-only by design.
- `provider.installed` is always `true` over SSH (deliberate, recorded in the plan's self-review).

## Branch and deploy state

- Branch: `main` (docs only; implementation goes on `feat/agent-settings-memory`)
- Unpushed commits: 2 before this handover (`e8d45a3`, `d387b26`); Phase 7 pushes them with the handover
- Working tree: `package-lock.json` modified, pre-existing, deliberately not committed (see priority 2)
- Deploy status: not deployed; local dev only. Local Hermes One backend not running — account/credits UI degrades, expected.
