# Memory screen: surface every memory system, per agent

Status: proposed
Date: 2026-09-02

The Memory screen presents itself as "what Hermes remembers", but it reads two
markdown files and shows nothing else. Two of the agent's four memory systems
are invisible, the summary cards measure the wrong things, and there is no way
to inspect any agent but the active one.

This spec covers that rework (P1). Adding new knowledge sources — an Obsidian
vault, arbitrary folders — is a separate piece of work (P2), scoped at the end.

## Problem

Three defects, all observable in the running app.

**Two of four memory systems are absent.** Per the
[memory docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)
and the
[provider docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers),
the agent draws on four systems. The screen surfaces the two writable files and
a provider _config_ tab; Session Search does not appear at all, and the provider's
actual state is never shown.

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

**Per-agent memory is unreachable.** `Memory` renders whichever profile is
active. Named profiles have their own stores that the UI cannot show:

```
~/.hermes/memories/MEMORY.md                    513 B
~/.hermes/profiles/myrtle/memories/MEMORY.md    309 B   invisible
~/.hermes/profiles/myrtle/memories/USER.md     1347 B   invisible
```

This already misleads in practice: the default profile's memory contains an
entry describing _Myrtle's_ working scope, while the `myrtle` profile holds a
different memory the user cannot see.

## Goals

- Show all four memory systems, including the two the user cannot edit.
- Make each system's editability explicit rather than implied by absent controls.
- Let the user inspect any agent's memory without switching agents.
- Replace the summary cards with metrics that describe what they label.
- Leave room for a fifth system (P2) without redesigning the screen.

## Non-goals

- Reading _inside_ external provider stores. Eight backends, eight clients; the
  provider row reports state, not contents.
- Editing a non-active agent's memory. Read-only — see _Agent switcher_ for why.
- Cross-agent comparison views.
- Any new memory or knowledge source. That is P2.

## The four systems

| Key        | Label             | Editable       | Backing store        | Scale metric          |
| ---------- | ----------------- | -------------- | -------------------- | --------------------- |
| `memory`   | Agent Memory      | user + agent   | `memories/MEMORY.md` | chars / limit         |
| `user`     | User Profile      | user + agent   | `memories/USER.md`   | chars / limit         |
| `sessions` | Session Search    | read-only      | `state.db` (FTS5)    | sessions + messages   |
| `provider` | External Provider | read-only here | 8 pluggable backends | active + reachability |

Providers are **additive**: the docs state the built-in memory "continues to
work exactly as before" alongside an external provider. The current Providers
tab implies an either/or choice; the systems list must show both as concurrently
live.

## Design

### Systems inventory replaces the cards

`CapacityCards` is deleted. In its place, a list with one row per system:
label, one-line description, an editability badge (`Editable` / `Read-only`),
its own scale metric, and last activity where knowable.

Each system uses a metric appropriate to it rather than being forced into a
capacity bar. Only `memory` and `user` are bounded, so only they get a bar.
At >=90% the bar is neutral-toned with the caption _"At capacity — the agent
consolidates on the next write"_, not a red alarm.

Selecting a row reveals that system's detail below. The existing tab components
become detail panes:

- `memory` -> `MemoryEntries` (unchanged behaviour)
- `user` -> `MemoryProfile` (unchanged behaviour)
- `sessions` -> counts, the most recent sessions, and an FTS query box
- `provider` -> `MemoryProviders` (existing activate/deactivate/env-var UI)

`MemoryTabs` is removed as primary navigation.

Persona/`SOUL.md` stays reachable from this screen but leaves the systems list.
It is a context file, not a memory store — the docs group it with `AGENTS.md`,
it has no capacity, and the agent does not write to it. Listing it as a memory
system is part of what makes the current screen misleading. It renders as a
separate section below the inventory, labelled as a context file, so nothing
the user can reach today becomes unreachable.

### Agent switcher

A profile selector in the header, populated from the existing `listProfiles`
IPC. Changing it re-reads every system for that profile. The active agent is
marked; non-active agents render read-only, with edit affordances hidden rather
than disabled-and-explained.

### Reading another profile safely

`getDbConnection()` resolves `activeStateDbPath()` and caches a single
connection, so it cannot serve another profile. `memory.ts#getSessionStats`
already demonstrates the correct pattern — open
`profileHome(profile)/state.db` read-only, query, close in a `finally`.

A new `readSessionMemory(profile)` follows that pattern for counts, recent
sessions, and FTS queries. The cached active-profile connection is left
untouched, so the Sessions screen is unaffected.

### IPC contract

`readMemory(profile)` returns a superset of today's shape. `memory` and `user`
keep their fields so `MemoryEntries` and `MemoryProfile` need no changes. Added:

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

`stats` is removed; its two fields move into `sessions`, which is where they
describe something. It has two consumers, both of which change:

- `CapacityCards.tsx:40` — deleted by this work anyway.
- `useLocalCommands.ts:70` — the `/memory` slash command prints
  `"Stats: N sessions, M messages"`. It must read the same values from
  `sessions`, and its output should gain the two systems it currently omits so
  the command and the screen agree on what memory is.

### One per-agent surface, not two

`ProfileModal` already reads per-agent memory: `readMemory(profile.id)` feeding
`MemoryEntries` in its `agentMemory` section (`ProfileModal.tsx:145-168, 505-513`).
It shows `MEMORY.md` entries only — no user profile, no sessions, no provider.

This work must not produce a third memory surface. `ProfileModal` keeps its
section, but renders the same inventory component the Memory screen uses, scoped
to that agent. One implementation, two mount points; a system added later (P2's
vault) appears in both without further work.

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
`memory.provider` path specifically via `getYamlPath`, matching what
`Memory.tsx` already does through `getConfig("memory.provider", profile)` — the
two disagree today.

## Error handling

Every system reads independently and degrades alone. A missing `state.db`
yields `available: false` and a row reading _"No sessions recorded yet"_; it
must not blank the screen or prevent `MEMORY.md` from rendering. This mirrors
the existing per-check isolation in `config-health.ts`.

A profile whose `memories/` directory does not exist is a legitimate empty
state, not an error — `web-wizard-agent` is exactly this case.

Provider reachability is best-effort. When it cannot be determined without a
network call, it stays `null` and the row shows the configured provider without
a health claim, rather than guessing.

## Testing

Unit tests, following the existing `src/main/*.test.ts` pattern of pointing
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

Renderer tests for the inventory: read-only systems render no edit affordance;
a >=90% bar carries the consolidation caption and not an error style; the
inventory renders identically when mounted from `ProfileModal` as from the
Memory screen.

`ProfileModal.test.tsx:87` mocks `readMemory` as `{ entries: [] }` — a shape
that matches neither today's contract nor the new one. It needs updating to the
real shape, or it will keep passing while the component it guards diverges.

## Documentation

There is no `lat.md` file for memory. P1 adds `lat.md/memory.md` covering the
four systems, the editability boundary, per-agent reading and why the
active-profile connection cache is bypassed. `lat check` must pass.

## Out of scope: P2

Linking an Obsidian vault and exposing folders as agent context. Retrieval is
**filesystem access**, not semantic RAG — decided during design.

The agent already ships an Obsidian skill
(`skills/note-taking/obsidian/SKILL.md`) that reads, searches, creates and edits
vault notes, resolving the vault from `OBSIDIAN_VAULT_PATH` in the profile
`.env` and falling back to `~/Documents/Obsidian Vault`. The skill is already
active in this install; `OBSIDIAN_VAULT_PATH` is unset and the fallback path
does not exist, so it is loaded and pointed at nothing.

P2 is therefore small: a way to set that path from the UI, surfaced as a fifth
row in the inventory this spec builds. No ingestion pipeline, no embeddings, no
index.
