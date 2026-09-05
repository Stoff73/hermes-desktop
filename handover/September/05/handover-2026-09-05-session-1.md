---
type: handover
mode: session-end
date: 2026-09-05
session: 1
repo: hermes-desktop
branch: main
---

# Session Handover — 2026-09-05, Session 1

(Work happened during the 2026-09-04 working day; the handover is written the
morning after. There is no `handover/September/04` folder — this file covers it.)

## Where things stand

The memory/Agent Settings branch is **finished and merged**. PR #2 landed on
`main` as `3823c9f`, the feature branch is deleted locally and remotely, `main`
is pushed, and the tree is clean. The 14-task plan is complete including Task 13.

The session then went well past the plan. CSJ drove the app by hand and found a
chain of config bugs — each fix exposing the next — that ran from "the app
dropped into onboarding" all the way to "picking a model never told the Chat
tab". All seven are fixed, tested and merged.

The last hour produced **a new spec, not code**:
`docs/superpowers/specs/2026-09-04-memory-provider-config-surface.md`. CSJ asked
for a spec to integrate Honcho; the finding was that Honcho is already a
first-class hermes-agent plugin *and* the agent already declares a config schema
explicitly designed for "a single generic renderer in the desktop UI" that we
never built. The spec is that renderer. **It is a draft awaiting CSJ's approval
— no code has been written against it.**

## Priorities for the next session

1. **Approve, revise or reject the provider-config spec — BLOCKED ON CSJ.** Ask
   first thing. It is a draft (`docs/superpowers/specs/2026-09-04-memory-provider-config-surface.md`).
   CSJ already answered its three shaping questions on 2026-09-04: Honcho stays
   opt-in and onboarding never mentions it; expose the curated `inline` fields
   plus read surfaces, not all forty keys; self-hosting gets a `baseUrl` field
   and nothing more. Those are settled — do not re-ask. What is *not* settled is
   whether the spec should become a plan at all, versus presets/onboarding
   coming first.
2. **Open question inside that spec, worth resolving before planning it:** the
   most valuable part — showing what Honcho actually *knows* (peer
   representation, conclusions) — has **no HTTP endpoint**. It is reachable from
   the agent's five tools but not over `/api`. Confirm this by reading
   `web_server.py` before scoping; the spec deliberately puts it last and says to
   ship the config panel without it rather than block on agent-side work.
3. **App check item 6 is still unexercised.** The vault row's Choose folder
   writing `OBSIDIAN_VAULT_PATH` into an agent's `.env` was never run — the pane
   renders and the dialog opens, but no folder was ever chosen. Items 1–5 pass.
   It is called out unticked in PR #2's body. A ten-second check in Agent
   Settings → Memory → External memory providers.
4. **Presets and onboarding.** Still the next real feature, still not started.
   `createProfile` already supports `--clone-from`. The vision memory says
   presets were deferred until "the framework is in place" — that framework is
   now merged, so this is unblocked for the first time.
5. **Tell plastic-labs their docs are wrong, or make them right.** Honcho's
   plugin README claims "the desktop app offers the browser flow as a Connect
   link next to the memory-provider dropdown". hermes-desktop has no such link —
   `MemoryProviders.tsx` renders only a password field and Activate. Either an
   upstream doc fix or a small desktop feature.

## Context to load

- `docs/superpowers/specs/2026-09-04-memory-provider-config-surface.md` — the
  draft awaiting approval, and priority 1. Read the "Is Honcho better than the
  built-in memory?" table and the Non-goals before discussing it with CSJ; both
  encode decisions already made.
- `docs/superpowers/plans/2026-09-02-memory-per-agent.md` — the completed plan.
  The **Execution log** at the bottom is the useful part: the baseline, the app
  check results with 5 passing and 6 open, and the Task 13 entry explaining why
  the PR body was rewritten.
- `~/.hermes/hermes-agent/plugins/memory/config_schema.py` — **outside the repo.**
  The declarative contract the whole spec rests on. Its module docstring is the
  single most important thing to read before touching provider config.
- `~/.hermes/hermes-agent/plugins/memory/honcho/README.md` — what Honcho's plugin
  actually does (two-layer context injection, five tools, ~40 keys). Consult
  before claiming anything about Honcho's capabilities.
- `lat.md/memory.md` and `lat.md/provider-setup.md` — the shipped architecture.
  `provider-setup.md` gained the "Getting from a broken config back to a working
  one" section, which is the map of this session's bug chain.
- `src/renderer/src/screens/Memory/MemoryProviders.tsx` — the file the spec
  replaces the `envVars` loop in. Where the work starts if the spec is approved.

## Completed this session

**Merged as PR #2** (`3823c9f`), 22 commits. Beyond the 14 already in the
2026-09-02 handover:

- **`9254afb`** — CSJ's review of the Memory tab. "Providers" → "External memory
  providers" with the Obsidian vault folded into that card (five rows became
  four); "User Profile" → "*Agent*'s memory of you" using the display name;
  "Session Search" → "Session memory"; every card starts collapsed; "Built-in
  only"/"Not linked" → "None connected"/"No vault linked". Plus the Profile
  tab's clipped model dropdown, a working-folder picker for the pre-existing
  `terminal.cwd` key, and per-agent green/red run-state dots backed by a new
  `src/main/agent-status.ts`.
- **`d20a917`** — app check results recorded in the plan's Execution log.
- **`88f635e`** — `openai-codex` given its canonical `base_url`. It was the one
  built-in provider with no registry entry, so `setModelConfig`'s empty-baseUrl
  fallback left the *previous* provider's URL in place. Verified red-then-green.
- **`5ab9564`** — two dead calls to action. The composer's fix hint was a plain
  `<span>`; the config-health banner passed its handler straight to `onClick`, so
  React handed the click event to `resolveSection`, which called `.trim()` on a
  `MouseEvent` and threw.
- **`de9b5b4`** — Setup can no longer finish without a model, and the model list
  is scoped to the chosen provider (`SetupModelField.tsx`). The picker also now
  opens filtered to the configured provider instead of All.
- **`a588748`** — readiness honours the chat picker's session override, and
  "Show details" opens the About pane where the Diagnose report actually renders.
- **`8324f8b`** — `set-model-config` announces every write from a single exit
  point, so persisting from Agent Settings or Providers refreshes the Chat tab.
- **`02b7832`** — Task 13 marked done with the PR URL.

**After the merge:** `8f1cb79`, the provider-config spec.

**Housekeeping:** `main` pushed (it had been one commit ahead since 2026-09-02);
branch deleted local and remote; `profilemodel.png` deleted from the repo root at
CSJ's instruction.

## Verification state

All at `8f1cb79` unless noted. The spec commit is docs-only.

- `npm run typecheck` (node + web): **clean**.
- `npx --yes lat.md check`: **All checks passed**.
- `npx vitest run` at `8324f8b`: **1989 passed, 3 skipped, 8 failed.** Every
  failure was verified as pre-existing rather than assumed —
  `tests/gateway-restart.test.ts` (6) and `tests/terminal-launcher.test.ts` (1)
  were run **on `main`** and fail identically there.
  `AgentMarkdown.test.tsx` (1) is the load-sensitive 5s timeout; it failed one
  isolated run while the Electron dev server was up (14.6s vs the usual 5.4s)
  then passed 3/3. **It is not a regression** — an earlier claim in-session that
  it was got corrected.
- `npx eslint --cache`: clean on every file touched. The repo's only error stays
  `.remember/tmp/last-ndc.ts:1`, a Remember-plugin scratch file.
- **App check: 5 of 6 pass.** Item 6 (vault folder write) never exercised.
- **Not verified: SSH mode.** Every SSH twin typechecks; nothing ran against a
  real remote. Same for `read-all-agents-memory`'s SSH branch and the run-state
  reader, which reports `unknown` remotely by design.
- **No tech-debt pass ran** — `tech-debt-session` is still not installed on this
  machine, as recorded on 2026-09-02.

## Decisions and dead ends

- **Honcho is not a candidate for integration and will not become the default.**
  It is already a first-class plugin. It beats the built-in on capability by a
  wide margin, but a cloud account or a Docker/Postgres/pgvector/Redis stack is
  incompatible with a macOS app a non-expert installs and runs. It stays opt-in.
  The comparison table is in the spec so this is not re-litigated.
- **No Honcho-specific settings UI.** The agent publishes a declarative schema
  for a generic renderer; building a bespoke Honcho screen would repeat the
  double-coding mistake in a new place.
- **The desktop will not manage infrastructure.** No Docker, no Postgres, no
  starting a local Honcho. A `baseUrl` field is the whole of self-hosting support.
- **AGPL-3.0** is fine while the desktop only talks to Honcho over a network API.
  It would matter if hermes-desktop ever bundled it. The spec's non-goals rule
  that out deliberately rather than by accident.
- **One PR, not two.** CSJ chose a single PR with a rewritten body over
  cherry-picking the config fixes onto a second branch — the commits were already
  interleaved. The PR body was rewritten rather than used verbatim from the plan.
- **Merge commit, not squash**, to preserve 22 commit messages.
- **`OPEN_MODEL_PICKER_EVENT` reuses the existing `model-picker:open` channel.**
  A second event was written and then removed on discovering `/model` already
  dispatched one. Do not add another.
- Carried forward and still settled: fcntl locking rejected; the top-level Memory
  screen is read-only; write protection is two-level; `provider.installed` is
  always `true` over SSH by deliberate simplification.

## Things that will bite you

- **Only the renderer hot-reloads.** `electron-vite dev` did **not** rebuild the
  main process on changes to `src/main/**` this session — a fix to
  `provider-registry.ts` sat inert while CSJ tested against it, and the wrong
  conclusion was drawn twice. **Kill and restart the dev server after any
  main-process or preload edit**, and verify by behaviour, not by assuming.
- **The chat model picker persists nothing** (`persist: false` — it is a session
  override by design). Agent Settings and Providers persist. Anything reading
  `config.yaml` to decide UI state must account for the override, or it will
  contradict what the user can see in the toolbar.
- **`~/.hermes/**` is outside the Bash sandbox for writes.** Reads work; an
  attempt to `sed` `~/.hermes/config.yaml` was denied by the auto-mode
  classifier. Ask CSJ to run it with the `!` prefix instead.
- **Changing a provider in Agent Settings can lock the user out of the app.**
  `checkInstall().hasApiKey` gates the whole boot: pick a keyless provider with
  no key and the next launch routes to the Setup screen with no explanation and
  no way back. `App.tsx:74-82`. The Setup screen still never says why it appeared
  — a real gap, deliberately not fixed.
- **`lat check` section ids include the H1**, and inserting a new `##` mid-file
  **re-parents every `###` below it**, silently breaking existing `@lat:` refs.
  Append new sections at the end of the file. This broke nine refs once today.
- **A `vi.mock("fs")` factory can silently not apply** when combined with other
  mocks in the same file — four tests all returned the un-mocked result with no
  error. Real temp files via `mkdtempSync` were simpler and more honest; see
  `src/main/agent-status.test.ts`.
- The 2026-09-02 gotchas all still hold: vitest 4 mocks need `function` to be
  constructible; `tsconfig.web.json` includes test files; renderer tests mock
  `useI18n` so `t()` returns the key; the first `eslint --cache` run takes
  minutes; `lat` is not installed globally (`npx --yes lat.md`).

## Tech debt deferred

No pass ran (`tech-debt-session` not installed). Noted by eye:

- **11 non-English locales carry stale wording** for every key renamed today —
  `providersTitle`, `userProfile`, `sessionSearch`, `providerBuiltIn`,
  `vaultNotLinked`. They fall back to English only for the *new* keys; the
  renamed ones show old translations. Pre-existing pattern, now larger.
- `src/renderer/src/screens/Memory/MemoryEntries.tsx:127,134` — hardcoded
  "Cancel"/"Save", untranslated.
- `src/renderer/src/assets/main.css:547` — global `:focus-visible` inset ring
  applies to every focusable element except `.chat-input`.
- `src/main/agent-status.ts` — the stale-gateway reason is English, matching
  `exit_reason` which is raw untranslated gateway text. Marked with a
  `ponytail:` comment naming the upgrade path.
- `.remember/tmp/last-ndc.ts:1` — the repo's only eslint error. Probably belongs
  in `.eslintignore`.
- **The Setup screen never explains why it appeared.** A working install that
  switches to a keyless provider lands in full onboarding with no message and no
  exit. Identified, deliberately not fixed, no owner.

## Branch and deploy state

- Branch: `main`, clean, in sync with `origin/main` at `8f1cb79`
- Unpushed commits: **none**
- Feature branch `feat/agent-settings-memory`: merged and deleted, local and remote
- PR #2: merged
- Deploy status: not deployed; local dev only
- **The Electron dev server is still running** (`electron-vite dev`, pid 15908 as
  of writing) against the merged `main` build. Kill it or leave it; it is not
  holding any state.
- `~/.hermes/config.yaml` is healthy: `gpt-5.6-luna` / `openai-codex` /
  `https://chatgpt.com/backend-api/codex`. It was broken for most of the session
  and was repaired through Agent Settings, which is what finally proved app
  check item 5.
