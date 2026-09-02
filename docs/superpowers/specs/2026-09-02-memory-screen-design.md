# Memory: a cross-agent overview and per-agent settings

Status: proposed
Date: 2026-09-02
Supersedes the first draft of this file (single Memory screen with an agent
switcher), revised after review.

The Memory screen presents itself as "what Hermes remembers", but it reads two
markdown files and shows nothing else. Two of the agent's four memory systems
are invisible, the summary cards measure the wrong things, and memory, persona
and providers are presented as global when the data behind them is per-agent.

This spec covers that rework (P1). Adding new knowledge sources — an Obsidian
vault, arbitrary folders — is separate work (P2), scoped at the end.

## Problem

**Two of four memory systems are absent.** Per the
[memory docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)
and the
[provider docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers),
the agent draws on four systems. The screen surfaces the two writable files and
a provider _config_ tab; Session Search does not appear at all, and the
provider's actual state is never shown.

**The summary cards misrepresent.** Observed with the default profile:

```
Agent Memory   512 / 2,200 chars (23%)    green   footer "2 Memories"
User Profile   1,363 / 1,375 chars (99%)  RED     footer "22 Sessions"
```

- The `22 Sessions` footer under _User Profile_ is `data.stats.totalSessions`,
  a `COUNT(*)` over `sessions` in `state.db`. It has no relationship to
  `USER.md`. It is there because the card needed a second line.
- The red 99% bar signals a fault. For a bounded, self-consolidating store,
  at-capacity is the normal steady state — the memory tool rejects an
  over-limit write and the agent consolidates on the next turn.
- `stats.totalMessages` is queried and never rendered.
- `2 Memories` restates the bar and the tab header (`2 entries`) below it.

**Per-agent data is presented as global.** This is the structural defect. The
storage layer is already per-profile throughout:

```
readMemory(profile)                 memories/ under that profile
discoverMemoryProviders(profile)    per-profile
getActiveMemoryProvider(profile)    reads profileHome(profile)/config.yaml
setEnv(envKey, value, profile)      writes that profile's .env
```

Agents can already run different memory providers. The Memory screen renders
whichever profile is active and offers no way to reach another, so named
profiles' stores are unreachable:

```
~/.hermes/memories/MEMORY.md                    513 B
~/.hermes/profiles/myrtle/memories/MEMORY.md    309 B   invisible
~/.hermes/profiles/myrtle/memories/USER.md     1347 B   invisible
```

This already misleads in practice: the default profile's memory holds an entry
describing _Myrtle's_ working scope, while the `myrtle` profile holds a
different memory the user cannot see.

## Goals

- Show all four memory systems, including the two the user cannot edit.
- Make each system's editability explicit rather than implied by absent controls.
- Put per-agent things in a per-agent place; make differing providers visible.
- Answer "what does each agent remember" without opening agents one by one.
- Replace the summary cards with metrics that describe what they label.
- Leave room for a fifth system (P2) without redesigning anything.

## Non-goals

- Reading _inside_ external provider stores. Eight backends, eight clients; the
  provider view reports state, not contents.
- Cross-agent comparison grids.
- Any new memory or knowledge source. That is P2.
- Stopping or restarting an agent to save memory. See _Concurrency_.

## The four systems

| Key        | Label             | Editable       | Backing store        | Scale metric          |
| ---------- | ----------------- | -------------- | -------------------- | --------------------- |
| `memory`   | Agent Memory      | user + agent   | `memories/MEMORY.md` | chars / limit         |
| `user`     | User Profile      | user + agent   | `memories/USER.md`   | chars / limit         |
| `sessions` | Session Search    | read-only      | `state.db` (FTS5)    | sessions + messages   |
| `provider` | External Provider | read-only here | 8 pluggable backends | active + reachability |

Providers are **additive**: the docs state the built-in memory "continues to
work exactly as before" alongside an external provider. The current Providers
tab implies an either/or choice; the UI must show both as concurrently live.

## Design

Two surfaces with distinct jobs: a cross-agent overview that answers "what does
each agent remember", and per-agent settings where that agent's memory is read
and edited.

### Per-agent settings is the home

`ProfileModal` already has the right shape, and two of the needed sections:

```
PROFILE_SECTIONS = [ profile, persona, agentMemory, wallet, sync, advanced ]
```

`persona` and `agentMemory` are already per-agent. This work adds the three
missing systems to the same place, so an agent's memory is configured where
everything else about that agent is configured:

- `agentMemory` grows from "MEMORY.md entries" into the systems inventory below.
- User Profile, Session Search and Provider join it as systems of that agent.

Nothing new is invented for providers — `MemoryProviders` already takes a
`profile` and writes profile-scoped env vars. It moves, and stops claiming to be
global.

### The systems inventory

`CapacityCards` is deleted. In its place, one row per system: label, one-line
description, an editability badge (`Editable` / `Read-only`), its own scale
metric, and last activity where knowable.

Each system uses a metric appropriate to it rather than being forced into a
capacity bar. Only `memory` and `user` are bounded, so only they get a bar. At

> =90% the bar is neutral-toned with the caption _"At capacity — the agent
> consolidates on the next write"_, not a red alarm.

Selecting a row reveals that system's detail. Existing components become detail
panes unchanged: `memory` -> `MemoryEntries`, `user` -> `MemoryProfile`,
`provider` -> `MemoryProviders`. `sessions` is new: counts, recent sessions, and
an FTS query box.

Persona keeps its own section rather than joining the inventory. `SOUL.md` is a
context file, not a memory store — no capacity, and the agent does not write to
it. Listing it as a memory system is part of what makes the screen misleading.

### The Memory screen becomes a cross-agent overview

The top-level screen lists every agent with its memory summarised: the two
bounded stores' fill, session count, active provider, last activity. Selecting
an agent opens that agent's settings at the memory section.

It reads; it does not edit. That keeps exactly one place where memory is
written, which is what stops the two-surfaces problem the previous draft had to
work around.

### IPC contract

`readMemory(profile)` returns a superset of today's shape. `memory` and `user`
keep their fields, so `MemoryEntries` and `MemoryProfile` need no changes. Added:

```ts
sessions: {
  totalSessions: number;
  totalMessages: number;
  lastSessionAt: number | null;
  available: boolean; // state.db present and readable
}
provider: {
  active: string | null; // from memory.provider in config.yaml
  installed: boolean;
  reachable: boolean | null; // null when not determinable without a network call
}
```

`stats` is removed; its two fields move into `sessions`, where they describe
something. Two consumers change:

- `CapacityCards.tsx:40` — deleted by this work anyway.
- `useLocalCommands.ts:70` — the `/memory` slash command prints
  `"Stats: N sessions, M messages"`. It must read those from `sessions`, and its
  output should gain the systems it currently omits so the command and the UI
  agree on what memory is.

The overview needs every agent at once. Rather than N round trips it gets one
`readAllAgentsMemory()` returning a summary per profile, built on `listProfiles`
plus the same per-profile readers.

### Reading another profile safely

`getDbConnection()` resolves `activeStateDbPath()` and caches a single
connection, so it cannot serve another profile. `memory.ts#getSessionStats`
already demonstrates the correct pattern — open `profileHome(profile)/state.db`
read-only, query, close in a `finally`.

A new `readSessionMemory(profile)` follows that pattern for counts, recent
sessions and FTS queries. The cached active-profile connection is untouched, so
the Sessions screen is unaffected.

## Concurrency

The agent already runs a complete protocol over these files, and the desktop
must join it rather than work around it.

`tools/memory_tool.py` locks a sidecar `.lock` file (`fcntl.flock(LOCK_EX)`, or
`msvcrt` on Windows), calls `_reload_target` to re-read from disk **under the
lock** before every mutation, and on detecting drift takes a `.bak.<ts>`
snapshot and **refuses the write** rather than clobbering. Its docstring names
this case exactly: "a patch tool, a shell append, a manual edit, or a concurrent
session". The `add` action deliberately skips the drift check because appending
cannot clobber. Both `MEMORY.md.lock` and `USER.md.lock` exist on disk today.

**The gap is that the desktop never takes that lock.** `safeWriteFile` is atomic
(temp + rename, so never a torn file) but does not touch `.lock`, so a desktop
write can interleave with the agent's read-modify-write cycle and be lost when
the agent flushes its stale view.

The fix is for the desktop's memory writes to acquire the same lock around their
read-modify-write, matching the agent's protocol. Every writer in `memory.ts`
(`addMemoryEntry`, `updateMemoryEntry`, `removeMemoryEntry`, `writeUserProfile`,
`writeMemoryRaw`) goes through it.

Stopping and restarting the agent on save is explicitly rejected. Memory is
injected as a **frozen snapshot at session start** — writes "appear in the
system prompt only at next session" — so a mid-session edit is invisible to the
running agent whether or not it restarts. Restarting would end the in-flight
session for no gain. The affordance is instead a quiet line under the editor:
_"Takes effect in this agent's next session."_

## Bugs fixed en route

**`getActiveMemoryProvider` returns an LLM provider.** `installer.ts:1426`
matches `^\s*provider:\s*["']?(\w+)["']?\s*$` against the whole of `config.yaml`.
It skips `model.provider: "openai-codex"` only because `\w+` cannot match a
hyphen, then matches an unrelated `provider: xai` further down. Verified against
both real profiles:

```
default: getActiveMemoryProvider() -> "xai"
myrtle:  getActiveMemoryProvider() -> "xai"
```

`xai` is a model provider, not a memory provider. The fix reads the
`memory.provider` path specifically via `getYamlPath`, matching what `Memory.tsx`
already does through `getConfig("memory.provider", profile)` — the two disagree
today. This matters more under this design, because per-agent providers are now
displayed rather than hidden.

## Error handling

Every system reads independently and degrades alone. A missing `state.db` yields
`available: false` and a row reading _"No sessions recorded yet"_; it must not
blank the surface or prevent `MEMORY.md` from rendering. This mirrors the
per-check isolation in `config-health.ts`.

A profile whose `memories/` directory does not exist is a legitimate empty
state, not an error — `web-wizard-agent` is exactly this case. On the overview,
one unreadable agent must not blank the list; it renders with an unavailable
marker.

Provider reachability is best-effort. When it cannot be determined without a
network call it stays `null`, and the row shows the configured provider without
a health claim rather than guessing.

Lock acquisition has a bounded timeout. If the lock cannot be taken the write
fails with a message saying the agent is mid-write and to retry — it must never
fall back to an unlocked write, which is the data loss the lock exists to
prevent.

## Testing

Unit tests follow the existing `src/main/*.test.ts` pattern of pointing
`HERMES_HOME` at a scratch directory:

- `readMemory` returns all four systems for a profile with only `MEMORY.md`.
- A profile with no `memories/` directory reads as empty, not failed.
- A profile with no `state.db` yields `available: false` while the file-backed
  systems still populate.
- `readSessionMemory` reads a _named_ profile's database, not the active one —
  the regression the current `getDbConnection` design would otherwise cause.
- `getActiveMemoryProvider` returns `null` for a config.yaml carrying only
  `model.provider`, and the correct value when `memory.provider` is set. This
  test fails against today's implementation.
- A memory write takes `<file>.lock` and releases it on both success and throw;
  a write that cannot acquire the lock fails rather than writing unlocked.
- `readAllAgentsMemory` returns one entry per profile and survives a profile
  whose stores are unreadable.

Renderer tests: read-only systems render no edit affordance; a >=90% bar carries
the consolidation caption and not an error style; the overview links each agent
to its own settings.

`ProfileModal.test.tsx:87` mocks `readMemory` as `{ entries: [] }` — a shape
matching neither today's contract nor the new one. It needs updating to the real
shape, or it will keep passing while the component it guards diverges.

## Documentation

There is no `lat.md` file for memory. P1 adds `lat.md/memory.md` covering the
four systems, the editability boundary, the two surfaces and their split of
responsibility, per-agent reading, why the active-profile connection cache is
bypassed, and the locking protocol shared with the agent. `lat check` must pass.

## Out of scope: P2

Linking an Obsidian vault and exposing folders as agent context. Retrieval is
**filesystem access**, not semantic RAG — decided during design.

The agent already ships an Obsidian skill
(`skills/note-taking/obsidian/SKILL.md`) that reads, searches, creates and edits
vault notes, resolving the vault from `OBSIDIAN_VAULT_PATH` in the profile
`.env`, falling back to `~/Documents/Obsidian Vault`. The skill is already active
in this install; `OBSIDIAN_VAULT_PATH` is unset and the fallback path does not
exist, so it is loaded and pointed at nothing.

P2 is therefore small: a way to set that path per agent, surfaced as a fifth
system in the inventory this spec builds. Because the env var is profile-scoped,
agents can point at different vaults for free. No ingestion pipeline, no
embeddings, no index.
