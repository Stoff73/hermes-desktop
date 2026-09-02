---
type: handover
mode: session-end
date: 2026-09-02
session: 1
repo: hermes-desktop
branch: main
---

# Session Handover — 2026-09-02, Session 1

## Where things stand

Two separate pieces of work. **Shipped:** a gateway/copy fix and a chat composer fix, merged to `main` via PR #1 — verified by tests and by looking at the running app. **Designed but not written:** a rework of the Memory screen. Its spec and an 11-task implementation plan are committed and have survived an external review pass, but **no implementation code exists yet** — task 1 has not been started.

Five commits are unpushed. One question is blocking the memory work and needs asking before task 1.

## Priorities for the next session

1. **BLOCKED ON CSJ — what does "provider" mean in the per-agent settings requirement?** CSJ asked for per-agent "memory, persona, provider", saying it "allows agents using different providers". The spec and plan interpret this as the **memory** provider (mem0/honcho/etc., what the Memory screen's Providers tab configures). If CSJ meant the **LLM** provider — Myrtle on xai while Hermes One is on openai-codex — that is *not covered anywhere* in the plan and is extra scope. `ProfileModal.tsx:277-289` shows model/provider as read-only chips today. Ask this first; it may change the plan.
2. **Push the 5 unpushed commits** (`git push`). They are all docs; nothing risky.
3. **Execute the memory plan**, `docs/superpowers/plans/2026-09-02-memory-per-agent.md`, starting at Task 1. CSJ was offered subagent-driven vs inline execution and had not chosen when the session ended — ask. Tasks are TDD and ordered; Task 5 deliberately leaves typecheck red until Task 6 lands.
4. **Decide on `package-lock.json`.** It has been modified since before this session started and is *not* from this session's work. Left uncommitted deliberately. Confirm with CSJ whether to commit, revert, or leave.
5. **P2 (deferred, not started):** point the agent at an Obsidian vault. Nearly free — see *Decisions*.

## Context to load

- `docs/superpowers/specs/2026-09-02-memory-screen-design.md` — the approved design. Read first; the plan argues from it. Covers the four memory systems, the two surfaces, and why the concurrency approach is what it is.
- `docs/superpowers/plans/2026-09-02-memory-per-agent.md` — 11 TDD tasks with real code. This is what you execute. Read the **Global Constraints** block before any task; it encodes facts that broke the first draft.
- `CLAUDE.md` — mandatory repo workflow. `lat.md/` docs must be updated and `lat check` must pass after *every* task. Non-negotiable and easy to forget.
- `src/main/memory.ts` — the file Tasks 2 and 5 rewrite most heavily. Current shape is two markdown files plus a session-count query.
- `src/renderer/src/components/profile/ProfileModal.tsx` — already has `persona` and `agentMemory` sections; Task 9 extends it. This is why the rework is smaller than it looks.

## Completed this session

- **PR #1 merged** to `main` (`6d70d9a`), branch deleted:
  - `afcce7d` — chat composer had a doubled focus ring. Cause was the global `:focus-visible` rule in `main.css:547` painting an `inset 0 0 0 1px` ring on the textarea *inside* the composer's own border. Suppressed for `.chat-input` only.
  - `74a14f0` — local mode never generated `API_SERVER_KEY` (SSH always did), so users were shown a banner asking them to invent a machine-local secret, in copy that called it an "API key" and pointed at Providers. Added `ensureLocalApiServerKey`, moved `isUsableApiServerKey` into `config.ts` as the single definition, rewrote the copy, and fixed `hasOAuthCredentials` to read the nested `tokens.{access,refresh}_token` shape.
- **Memory spec** — `d6bd6e0`, revised `50ad8fb`, `800d7bc`.
- **Memory plan** — `252d789`, corrected `a5bf6d6` after review.

## Verification state

- `npm run typecheck` (node + web): clean at `74a14f0`.
- `npx eslint`: clean at `74a14f0`.
- `npx --yes lat.md check`: **All checks passed** at `a5bf6d6`.
- `npx vitest run`: 1903 passed / 3 failed at `74a14f0`. The 3 are in `tests/gateway-restart.test.ts` and `tests/terminal-launcher.test.ts`, which **also fail on a stashed clean tree** (5 failures there) — pre-existing and flaky, not from this session's changes. Measured, not assumed.
- End-to-end check that a fresh profile self-provisions its key and the config-health warning clears: passed.
- Composer fix confirmed **visually in the running app**, not just by test.
- **Not verified:** none of the memory work — it is unimplemented. Also no tech-debt pass ran (see below).

## Decisions and dead ends

- **fcntl locking for desktop memory writes — rejected, do not retry.** The spec originally said the desktop should take the agent's `MEMORY.md.lock`. It cannot: Node 22 has no `flock` (`fs.flock` and `fs.flockSync` are both `undefined`), and the only lockfile library in the tree (`proper-lockfile`, transitive via electron-builder) locks with `mkdir`, which does not interoperate with an fcntl advisory lock and would try to create the lock file as a *directory*. True interop needs a native addon rebuilt for Electron on three platforms. Replaced with optimistic compare-and-swap.
- **Stopping/restarting the agent to save memory — rejected.** CSJ proposed it. Memory is injected as a frozen snapshot at session start, so a mid-session edit is invisible to the running agent whether or not it restarts; a restart would end the conversation for nothing. UI says "Takes effect in this agent's next session" instead.
- **Approach A (systems inventory) chosen** over "keep the tabs and fix the cards" and an agent×system grid.
- **The top-level Memory screen becomes read-only**, drilling into per-agent settings. This was CSJ's restructure and is better than the first draft: with exactly one place that writes memory, the two-surfaces duplication problem disappears rather than being managed.
- **Obsidian: filesystem access, not semantic RAG** — CSJ's choice. The agent already ships `skills/note-taking/obsidian/SKILL.md` and it is already active in the 84 skills; it resolves the vault from `OBSIDIAN_VAULT_PATH` in the profile `.env`, which is **unset**, with a fallback of `~/Documents/Obsidian Vault`, which **does not exist**. So it is loaded and pointed at nothing. P2 is essentially a settings field.
- **Persona/`SOUL.md` is a context file, not a memory system** — it leaves the systems list but stays reachable. Do not re-add it as a memory system.
- **Provider badge is "Configurable", not "Read-only"** — its detail pane hosts Activate/Deactivate, so read-only would be a fresh lie of exactly the kind this work removes.
- **An external review (Fable 5.1) found the first plan not executable.** Every finding was verified against the code before acting. Do not undo these: `listProfiles` is async; `sshRemoveMemoryEntry` returns `boolean` and must become `WriteResult`; `ProfileModal` must fetch `discoverMemoryProviders` or every agent shows "no providers found"; `CapacityBar` hard-codes `var(--error)` above 90%; `getYamlPath` is not imported in `ssh-remote.ts`.

## Things that will bite you

- **The Electron window opens on a second display at negative X** (`-1275, 0`, size `1100x850`). `screencapture` of the primary display shows Chrome, not the app. Get bounds first: `osascript -e "tell application \"System Events\" to tell (first process whose unix id is $PID) to return position of window 1 & size of window 1"`, then `screencapture -x -R-1275,0,1100,850 out.png`. Also confirm the PID is the *current* Electron — a stale PID silently captures the wrong thing.
- **Renderer tests mock `useI18n` so `t()` returns the key** (see `ConfigHealthBanner.test.tsx:8-13`). Asserting English copy fails. Main-process tests do not mock it.
- **`lat` is not installed globally.** Use `npx --yes lat.md check` / `npx --yes lat.md locate "<Section>"`. Short-form section ids often do not resolve — use `locate` to get the full path.
- **Prettier reformats markdown code blocks**, so string-patching the spec/plan files is fragile — anchors move. Replace whole blocks, or re-read the file after each prettier run.
- **`getActiveMemoryProvider` currently returns `"xai"`** for both profiles — an LLM provider reported as the memory provider. Task 3 fixes it. Anything you read from the Providers UI before then is wrong.
- **`npm run dev` piped through `tail` swallows all output** (buffering) and makes a working launch look hung. Redirect to a file instead.
- Profile `web-wizard-agent` has no `config.yaml`, no `.env` and no `memories/` — the useful empty-state fixture.

## Tech debt deferred

The `tech-debt-session` skill this workflow calls for is **not installed**, so no automated pass ran. Manually noted:

- `src/renderer/src/assets/main.css:547` — the global `:focus-visible` inset ring still applies to every other focusable element. Only `.chat-input` was exempted. If the doubled-box look appears elsewhere, that rule is why.
- 11 non-English locales still carry the old "API Server Key" wording; only `en` was updated. `t()` falls back to English for *missing* keys, but these keys exist with stale text, so they will not fall back.
- `provider.installed` is computed in the planned contract but only rendered if the implementer follows Task 8; if it ends up unrendered, cut it.

## Branch and deploy state

- Branch: `main` (PR #1 merged and its branch deleted, local and remote)
- Unpushed commits: **5** (`d6bd6e0`, `50ad8fb`, `800d7bc`, `252d789`, `a5bf6d6` — all docs)
- Working tree: `package-lock.json` modified, pre-existing, deliberately not committed
- Deploy status: not deployed; local dev only. Local Hermes One backend (`localhost:3100` / `:3002`) is **not running**, so account/credits UI degrades — expected, not a bug to chase.
