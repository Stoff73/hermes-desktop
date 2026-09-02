---
type: handover
mode: session-end
date: 2026-09-02
session: 3
repo: hermes-desktop
branch: feat/agent-settings-memory
---

# Session Handover — 2026-09-02, Session 3

## Where things stand

The memory plan was executed, not just planned. Tasks 0–12 of the 14-task plan are done in 14 commits on `feat/agent-settings-memory`: five-system memory contract, two-level write protection, per-agent model picker, vault link, the read-only cross-agent overview, and the `lat.md` docs. Typecheck, `lat.md check` and the whole test suite are green — the only failures are the two baseline files plus one known load-flake, none in code this branch touched.

**One thing is unfinished and it needs CSJ, not the next model:** the six-point visual check in the running app (Task 12 Step 7). Automated GUI clicking was abandoned because `System Events … click at {x,y}` does not raise the Electron window first, so clicks landed in whatever app had focus. Task 13 (push + PR) is deliberately not started, because the PR's test plan cites those six items.

## Priorities for the next session

1. **The six-point app check — BLOCKED ON CSJ.** Ask first thing. Start the app (`npm run dev > /tmp/hermes-dev.log 2>&1 &`; do not pipe through `tail`, it buffers and looks hung) and have CSJ confirm: (1) Memory screen lists every agent, `web-wizard-agent` as an empty not failed row; (2) selecting an agent opens Agent Settings at the Memory tab with five rows; (3) User Profile shows no session count, Session Search does; (4) a near-full store reads "At capacity…" in neutral not red; (5) the Profile tab's model picker changes a *non-active* agent's own `config.yaml` (`grep -A3 '^model:' ~/.hermes/profiles/myrtle/config.yaml`); (6) the vault row's Choose folder writes `OBSIDIAN_VAULT_PATH` into that agent's `.env`. Record each result under **Execution log → App check** in the plan and tick Task 12 Step 7. If CSJ would rather skip it, that is their call — open the PR with those items unticked and say so in the PR body.
2. **Task 13: finish the branch.** Invoke `superpowers:finishing-a-development-branch`, then `git push -u origin feat/agent-settings-memory` and `gh pr create` — the plan's Task 13 carries the full PR body verbatim. The branch has no upstream yet, so nothing is pushed. Set Task 13 to `done` with the PR URL and commit the plan.
3. **Presets and onboarding — a fresh brainstorm → spec → plan cycle.** CSJ's product vision needs preset agents and a first-run flow. The hook is recorded at the end of the spec: `createProfile` already supports `--clone-from`. Not part of this plan; do not bolt it on.
4. **SSH mode remains an open product question, not a task.** The app ships an SSH Tunnel connection mode and every memory reader/writer has an SSH twin, kept in step by this work. Whether SSH belongs in a macOS product for local agents is an app-wide decision CSJ has not made. Do not remove SSH support opportunistically.

## Context to load

- `docs/superpowers/plans/2026-09-02-memory-per-agent.md` — the plan just executed. Read the **Progress** table (0–12 done with SHAs, 12 blocked on the app check, 13 not started), then **Execution log**, which holds the baseline, the app-check blocker and two adaptations made during execution. Task 13 carries the PR command and body.
- `docs/superpowers/specs/2026-09-02-memory-screen-design.md` — the approved design. Consult when a reviewer or CSJ questions *why* something was built this way; every task argued from it.
- `lat.md/memory.md` — the docs written this session: five systems, editability boundary, two surfaces, write protection and why it is not an fcntl lock. The fastest way to understand the shipped architecture.
- `lat.md/agent-settings.md` — the profile modal as the per-agent home, the model pin and its credential check.
- `src/main/memory-write.ts` — the whole concurrency story in 70 lines. Read it before touching any memory writer.
- `src/renderer/src/screens/Memory/MemorySystems.tsx` — the five-row inventory; the largest new renderer component and where most UI follow-ups will land.

## Completed this session

- **Task 0** — branched `feat/agent-settings-memory` off `main` (CSJ chose a branch in place over a worktree, to avoid a fresh `npm install` with an Electron rebuild). Committed the long-outstanding `package-lock.json` churn first (`8e939c0`) on CSJ's instruction. Baseline recorded: typecheck clean, 2 files / 7 tests failing (`tests/gateway-restart.test.ts`, `tests/terminal-launcher.test.ts`).
- **Task 1** (`b04741d`) — `src/main/memory-write.ts`: `mutateMemoryFile` compare-and-swap with a one-shot retry, `Mutation`/`WriteResult` types, `MEMORY_CONFLICT_ERROR`. 7 tests.
- **Task 2** (`75c32bc`) — every writer in `memory.ts` routed through it; `removeMemoryEntry` returns `WriteResult` instead of `boolean` (which fixes SSH deletes always reporting failure); `expected` threaded through the SSH twins, IPC and preload. 11 tests.
- **Task 3** (`0aad884`) — `getActiveMemoryProvider` reads the `memory.provider` YAML path instead of regex-scanning for any `provider:` line. The old code returned `"xai"` (the *model* provider) on both real profiles, which also meant no provider card was ever badged Active. 4 tests.
- **Task 4** (`10621c7`) — `src/main/memory-session.ts`: per-profile session counts through a short-lived read-only handle, bypassing the cached active-profile connection. 4 tests.
- **Task 5** (`b29f77a`) — `MemoryInfo` grew from two files plus `stats` to five systems (`memory`, `user`, `sessions`, `provider`, `vault`); `stats` removed; `CapacityCards` deleted with its CSS; `/memory` prints all five; SSH reader mirrors the shape. 5 tests.
- **Task 6** (`b92939e`) — `src/main/agents-memory.ts` + `read-all-agents-memory` IPC, SSH-aware, one summary row per agent, isolating per-agent failures. 3 tests.
- **Task 7** (`bd6e660`) — the five-row inventory (`MemorySystems.tsx`), the vault pane (`MemoryVault.tsx`), `CapacityBar` `tone` + zero-limit guard, `removeEnvValue` / `sshRemoveEnvValue` / `remove-env` IPC / `removeEnv` preload, and every new class styled in `main.css`. 15 tests.
- **Task 8** (`29292db`) — both editors send what the user was looking at and reload on conflict; the profile editor keeps the draft and re-baselines so a second save is an informed overwrite. 6 tests.
- **Task 9** (`0a51d38`) — Agent Settings names itself: openers say "Agent settings", the modal carries a kicker, the `agentMemory` tab is "Memory" and mounts the inventory with the providers list fetched alongside.
- **Task 10** (`7b8f693`) — the top-level Memory screen is now a read-only cross-agent overview; `MemoryTabs.tsx` deleted; `Layout` opens Agent Settings at the Memory tab on row selection. 4 tests.
- **Task 11** (`09befc4`) — `ProfileModelPicker.tsx`: the chat's `useModelConfig` + `ModelPicker` in persist mode, with an inline key field driven by the existing per-profile health check. The read-only provider/model chips are gone. 4 tests.
- **Task 12** (`68957d0`, `8caf305`) — `lat.md/memory.md` and `lat.md/agent-settings.md` written, indexed and cross-linked; `/memory` documented in `chat-commands.md`; 13 test files tagged with `@lat:`; full verification run and recorded; app check logged as needing CSJ.

## Verification state

All at `8caf305` unless noted.

- `npm run typecheck` (node + web): **clean**.
- `npx --yes lat.md check`: **All checks passed**.
- `npx vitest run`: **1964 passed, 3 skipped, 6 failed** — 4 in `tests/gateway-restart.test.ts`, 1 in `tests/terminal-launcher.test.ts` (both in the recorded baseline), 1 in `src/renderer/src/components/AgentMarkdown.test.tsx` (5s timeout under load; passes in isolation, did not recur). **No failure is in code this branch touched.**
- This branch's own suites re-run after the lint autofix: **16 files, 69 tests, all passing**.
- `npx eslint --cache .`: 1 error, 38 warnings. The error is `.remember/tmp/last-ndc.ts:1` — a Remember-plugin scratch file, pre-existing and unrelated. Every file this branch touches lints clean (prettier warnings were auto-fixed).
- **Not verified: the app itself.** No screen was confirmed by eye. Priority 1 exists for exactly this.
- **Not verified: SSH mode.** Every SSH twin was updated and typechecks, but nothing was exercised against a real remote. Same for the `read-all-agents-memory` SSH branch.
- No tech-debt pass ran: the `tech-debt-session` skill is not installed on this machine.

## Decisions and dead ends

- **Branch in place, not a worktree.** CSJ chose this when asked: a worktree would need a fresh `npm install` with a `better-sqlite3`/Electron rebuild — minutes and gigabytes — for no isolation this work needed.
- **The lockfile was committed** (`8e939c0`), on CSJ's instruction, after being deliberately left dirty for two sessions.
- **The plan's Task 4 test could not use a real SQLite database.** `postinstall` runs `electron-builder install-app-deps`, so `better-sqlite3` is built for Electron's ABI (NODE_MODULE_VERSION 140) and vitest, on plain Node (127), refuses to load it. Every other db-touching test in the repo mocks the module for the same reason (`tests/db.test.ts`). The test now mocks it with a constructible fake and keeps all three original assertions plus one that the handle is opened `{ readonly: true }` and closed. **Do not try to make real SQLite work under vitest here.**
- **GUI automation of the Electron app was abandoned.** `osascript … "System Events to click at {x,y}"` clicks wherever the pointer lands without raising the target window; two clicks went into an unrelated application. Driving CSJ's desktop blind risks clicking something destructive. If this is worth automating later, the window must be activated first (`tell application "Electron" to activate`) and the result verified by screenshot between every click — or use the app's own test hooks instead.
- **`--amend` after recording a commit SHA in the plan is a trap** — it invalidates the SHA you just wrote. Two Progress rows had to be corrected. Record the SHA and let it land with the *next* task's commit.
- Carried forward and still settled: fcntl locking rejected (Node has no `flock`; `proper-lockfile` uses `mkdir`); stop/restart-on-save rejected (memory is a frozen snapshot at session start); the systems-inventory approach; the top-level Memory screen is read-only; provider means the LLM provider in per-agent settings; the vault label is "Obsidian vault"; unlink removes the env line rather than blanking it; write protection is two-level.

## Things that will bite you

- **A vitest 4 mock must use the `function` keyword to be constructible.** `vi.fn().mockImplementation((a, b) => ({...}))` throws "is not a constructor" when the code under test calls `new`. Arrow functions silently fail this way; vitest prints a hint about it in stderr.
- **`tsconfig.web.json` includes test files**, so a renderer test that omits a required prop fails `npm run typecheck:web`, not just the test run.
- **Renderer tests mock `useI18n` so `t()` returns the key.** Never assert English copy. Where interpolation matters, the mocks append values as `key:a,b`.
- **The first `npx eslint --cache .` over this repo takes several minutes.** Run it in the background; subsequent cached runs are fast.
- **The Electron window opens on a second display at 730,239 (1100×850).** Get bounds with `osascript -e 'tell application "System Events" to tell (first process whose unix id is <PID>) to return position of window 1 & size of window 1'` before `screencapture -x -R<x>,<y>,<w>,<h>`. **Two Electron PIDs may be alive** — a stale one from an earlier session and the current one; check `ps -o lstart=` to pick the right one.
- **The app shows a "Follow Us on X" modal on launch** which covers the centre of the window; it must be dismissed before any screen is legible.
- **`memory.ts` now imports from `installer.ts` and `config.ts`.** Neither imports back, so there is no cycle today — keep it that way.
- **`lat` is not installed globally.** Use `npx --yes lat.md check` / `locate`. Section ids **do** include the H1: `memory#Memory#Tests#<leaf>`, not `memory#Tests#<leaf>`.
- `MemorySystems.tsx` exports `relativeTime`, which `Memory.tsx` imports — one definition, deliberately. Do not duplicate it.

## Tech debt deferred

No pass ran (the `tech-debt-session` skill is not installed). Noted by eye, all pre-existing except where marked:

- `src/renderer/src/screens/Memory/MemoryEntries.tsx:127,134` — hardcoded "Cancel"/"Save" in the add-entry form, untranslated. Line numbers shifted this session; the strings were not touched.
- `src/renderer/src/assets/main.css:547` — global `:focus-visible` inset ring still applies to every focusable element except `.chat-input`.
- 11 non-English locales carry stale "API Server Key" wording, and every string added this session is English-only by design (`t()` falls back to English).
- `provider.installed` is always reported `true` over SSH — a recorded, deliberate simplification: the remote plugin directory is not cheaply reachable, so the row never shows a false "not installed" warning remotely.
- `.remember/tmp/last-ndc.ts:1` — the repo's only eslint error, from the Remember plugin's scratch directory. Probably belongs in `.eslintignore`.

## Branch and deploy state

- Branch: `feat/agent-settings-memory` (14 commits ahead of `main`, working tree clean)
- Unpushed commits: **all 14 — the branch has no upstream yet.** `git push -u origin feat/agent-settings-memory` is part of Task 13.
- Deploy status: not deployed; local dev only. The dev server started for the app check has exited.
