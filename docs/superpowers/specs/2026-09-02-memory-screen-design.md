# Agent Settings: memory, model and vault per agent

Status: approved (revised 2026-09-02, session 2)
Date: 2026-09-02
Supersedes the first two drafts of this file (a single Memory screen with an
agent switcher; then a memory-only rework). Revised after review to add the
per-agent LLM model/provider pin, the Obsidian vault as a fifth memory system,
and edit-level write protection.

**Product context.** Hermes One is becoming a desktop dashboard for creating,
managing, editing, checking, chatting with, and launching autonomous agents on a
local machine, shipped as a macOS install. An agent is a Hermes profile: its own
`config.yaml`, `.env`, `SOUL.md`, memories, sessions, skills and `state.db`
under `~/.hermes/profiles/<id>/` (the default agent lives at `~/.hermes`). This
spec makes the per-agent settings screen the one place where an agent's memory,
model and knowledge sources are read and edited. Preset agents and the
first-run onboarding flow are later work and are out of scope here.

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
- `2 Memories` restates the bar and the tab header (`2 entries`) below it.

**Per-agent data is presented as global.** This is the structural defect. The
storage layer is already per-profile throughout:

```
readMemory(profile)                 memories/ under that profile
discoverMemoryProviders(profile)    per-profile active flag
getActiveMemoryProvider(profile)    reads profileHome(profile)/config.yaml
setEnv(envKey, value, profile)      writes that profile's .env
getModelConfig(profile)             reads that profile's model block
setModelConfig(..., profile)        writes that profile's model block
```

Agents can already run different memory providers and different LLM providers.
The Memory screen renders whichever profile is active and offers no way to reach
another, so named profiles' stores are unreachable:

```
~/.hermes/memories/MEMORY.md                    513 B
~/.hermes/profiles/myrtle/memories/MEMORY.md    309 B   invisible
~/.hermes/profiles/myrtle/memories/USER.md     1347 B   invisible
```

This already misleads in practice: the default profile's memory holds an entry
describing _Myrtle's_ working scope, while the `myrtle` profile holds a
different memory the user cannot see.

**The agent's model is read-only in its own settings.** `ProfileModal` shows
provider and model as chips. Changing them requires switching the active agent
and using the Providers screen, so the "different agents on different models"
capability the agent supports is effectively hidden.

**The Obsidian skill is loaded and pointed at nothing.** The agent ships
`skills/note-taking/obsidian/SKILL.md`, active in this install. It resolves the
vault from `OBSIDIAN_VAULT_PATH` in the profile `.env`, falling back to
`~/Documents/Obsidian Vault`. The variable is unset and the fallback does not
exist. There is no UI to set it.

## Goals

- Show all of an agent's memory systems, including the ones the user cannot
  edit, and make each system's editability explicit.
- Put per-agent things in a per-agent place: memory, persona, model/provider,
  memory provider, and vault are all configured in Agent Settings.
- Answer "what does each agent remember" without opening agents one by one.
- Let each agent be pinned to its own LLM model and provider from its settings.
- Let each agent link its own Obsidian vault.
- Replace the summary cards with metrics that describe what they label.
- Never let a desktop edit silently overwrite something the agent wrote.

## Non-goals

- Reading _inside_ external provider stores. Eight backends, eight clients; the
  provider row reports state, not contents.
- Cross-agent comparison grids.
- Indexing, embedding or semantically searching the vault. Retrieval is the
  agent's own filesystem access through its Obsidian skill — decided during
  design.
- Preset agents, agent templates, and first-run onboarding. Profile creation
  already supports cloning from a source profile; presets become bundled
  templates in a later spec.
- Stopping or restarting an agent to apply a change. See _Concurrency_.

## The five systems

| Key        | Label             | Editable       | Backing store              | Scale metric               |
| ---------- | ----------------- | -------------- | -------------------------- | -------------------------- |
| `memory`   | Agent Memory      | user + agent   | `memories/MEMORY.md`       | chars / limit              |
| `user`     | User Profile      | user + agent   | `memories/USER.md`         | chars / limit              |
| `sessions` | Session Search    | read-only      | `state.db` (FTS5)          | sessions + messages + last |
| `provider` | External Provider | configurable   | 8 pluggable backends       | active + installed         |
| `vault`    | Obsidian Vault    | configurable   | folder via `OBSIDIAN_VAULT_PATH` | linked + folder exists |

Providers are **additive**: the docs state the built-in memory "continues to
work exactly as before" alongside an external provider, and the existing
`providersHint` copy already says so. Only one external provider is active at a
time.

The vault is **not** a memory provider. It is a folder the agent's bundled
Obsidian skill reads, searches, creates and edits notes in. It appears in the
inventory because, from the user's point of view, it is a place the agent
remembers things, and because the env var that points at it is profile-scoped —
so different agents can use different vaults for free.

Persona (`SOUL.md`, the agent's system prompt) is a context file, not a memory
store. It keeps its own Persona tab in Agent Settings and never joins the
inventory.

## Design

Two surfaces with distinct jobs: a cross-agent overview that answers "what does
each agent remember", and Agent Settings where that agent's memory, model and
vault are read and edited.

### Agent Settings is the home

The existing profile modal (`ProfileModal`) **is** the Agent Settings screen.
It already has the right shape and several of the needed sections:

```
PROFILE_SECTIONS = [ profile, persona, agentMemory, wallet, sync, advanced ]
```

Three naming changes make that explicit. The buttons that open it (the Agents
screen row action and the profile switcher's edit action) say "Agent settings"
instead of "Edit profile"; the modal's accessible name becomes "Agent settings
for <name>" while its visible title stays the agent's name. The `agentMemory`
tab is labelled "Memory", because it will now contain a row that is itself
called "Agent Memory". Tabs read: Profile, Persona, Memory, Wallet, Sync,
Advanced. Persona stays exactly where it is.

### Model and provider live in the Profile tab

The read-only provider and model chips in the Profile tab become an editable
model picker, so an agent's model is set where everything else about it is set.

Nothing new is built below the renderer. The chat's `useModelConfig(profile)`
hook already loads the model library and that profile's current model, and its
`selectModel(..., { persist: true })` already writes that profile's
`config.yaml` through `setModelConfig`. The chat's `ModelPicker` is a pure
component that takes the hook's outputs. Agent Settings mounts the same pair
with `profile.id`, in persist mode, so a pick is durable for that agent (unlike
the chat's session-only override). An agent with no model set shows "Auto",
the agent's own default state.

The model library is desktop-global; it lists every model the user has added
under any configured provider. Credentials are **per agent**: each profile has
its own `.env` and `auth.json`, and a named profile without its own `auth.json`
falls back to the default's. An agent cloned from another inherits keys; a
fresh one has none. Picking a provider the agent has no key for therefore fails
at runtime. The Profile tab runs the existing per-profile config health check
after each pick and, when it reports `MODEL_KEY_MISSING`, shows an inline API
key field for the reported `expectedKey`, saved with `setEnv(key, value,
profile.id)` and re-checked. For OAuth-only providers the check reports no key
to set; the tab then shows a hint to sign in from Providers with that agent
active, because OAuth flows bind to the active profile.

### The systems inventory (Memory tab)

`CapacityCards` is deleted. In its place, one row per system: label, one-line
description, an editability badge, its own scale metric, and last activity
where knowable. Selecting a row reveals that system's detail.

The badge has three states, because two cannot describe these systems honestly.
`memory` and `user` are **Editable** — you change the content. `provider` and
`vault` are **Configurable** — you choose and configure the backend or folder
but cannot read or write what it stores from here. `sessions` is **Read-only**
— written entirely by the agent. Badging the provider row read-only while its
detail hosts activate/deactivate controls would be a new misrepresentation of
exactly the kind this work removes.

Each system uses a metric appropriate to it rather than being forced into a
capacity bar. Only `memory` and `user` are bounded, so only they get a bar. At
>=90% the bar is neutral-toned with the caption _"At capacity — the agent
consolidates on the next write"_, not a red alarm. `sessions` shows
"N sessions · M messages" and "active <relative time>" from the most recent
session. `provider` shows the active provider name, or "Built-in only", and a
"not installed" warning when the active provider's plugin is absent from this
installation. `vault` shows the folder name, or "Not linked", and a "folder not
found" warning when the path is set but does not exist.

Existing components become detail panes: `memory` -> `MemoryEntries`,
`user` -> `MemoryProfile`, `provider` -> `MemoryProviders`. `sessions` is new
and deliberately thin: the counts, last activity, and a hint that search lives
on the Sessions screen, which already implements FTS over the same table.
`vault` is new: the current path, a Choose Folder button using the existing
native folder dialog, and Clear; saving writes `OBSIDIAN_VAULT_PATH` to that
agent's `.env`, or removes it. Both editable panes and the vault pane carry the
line _"Takes effect in this agent's next session."_

### The Memory screen becomes a cross-agent overview

The top-level screen lists every agent with its memory summarised: the two
bounded stores' fill, session count, last activity, active memory provider, and
whether a vault is linked. Selecting an agent opens Agent Settings at the Memory
tab. Model and provider per agent already show on the Agents screen and are not
repeated here.

It reads; it does not edit. That keeps exactly one place where memory is
written, which is what stops the two-surfaces problem the previous draft had to
work around.

Over SSH the overview must read the **remote** machine's agents. `list-profiles`
and `read-memory` are both already SSH-aware, so the summary handler branches
the same way. (The screen is hidden only in HTTP "remote" mode, where the
`RemoteNotice` already explains that the data is not reachable; SSH mode renders
it.) A local-only handler would list local agents while drilling into remote
memory — the exact class of mismatch this spec exists to remove.

### Styling

Both new surfaces introduce class names that do not exist in `main.css`, so each
ships with its styles; a row rendered as an unstyled `<button>` is not done. The
`.memory-capacity-card*` rules are removed along with `CapacityCards`.

`CapacityBar` currently hard-codes `var(--error)` above 90%. It gains a tone
option so the inventory can render a near-full bounded store neutrally with the
consolidation caption, while other callers keep today's behaviour.

The model picker reuses the chat's `.chat-model-*` styles unchanged; the Profile
tab only positions it.

### IPC contract

`readMemory(profile)` returns a superset of today's shape. `memory` and `user`
keep their fields, so `MemoryEntries` and `MemoryProfile` need no changes. Added:

```ts
sessions: {
  totalSessions: number;
  totalMessages: number;
  lastSessionAt: number | null; // unix seconds of the newest session
  available: boolean; // state.db present and readable
}
provider: {
  active: string | null; // memory.provider from config.yaml, "" coerced to null
  installed: boolean; // the active provider's plugin exists in this installation
}
vault: {
  path: string | null; // OBSIDIAN_VAULT_PATH from the profile .env, "" coerced to null
  exists: boolean; // that directory exists on this machine
}
```

`stats` is removed; its two fields move into `sessions`, where they describe
something. Two consumers change:

- `CapacityCards.tsx:40` — deleted by this work anyway.
- `useLocalCommands.ts:70` — the `/memory` slash command prints
  `"Stats: N sessions, M messages"`. It must read those from `sessions`, and its
  output gains the systems it currently omits so the command and the UI agree
  on what memory is.

Every writer returns one `WriteResult`
(`{ success: boolean; error?: string; conflict?: boolean }`).
`removeMemoryEntry` changes from `boolean` to `WriteResult`, locally and over
SSH. `updateMemoryEntry`, `removeMemoryEntry` and `writeUserProfile` accept an
optional `expected` argument carrying what the user was looking at — see
_Concurrency_.

The overview needs every agent at once. Rather than N round trips it gets one
`readAllAgentsMemory()` returning a summary per profile, built on `listProfiles`
plus the same per-profile readers.

The vault path is set with the existing `setEnv("OBSIDIAN_VAULT_PATH", path,
profile)` and cleared with an empty value; no new IPC.

### Reading another profile safely

`getDbConnection()` resolves `activeStateDbPath()` and caches a single
connection, so it cannot serve another profile. `memory.ts#getSessionStats`
already demonstrates the correct pattern — open `profileHome(profile)/state.db`
read-only, query, close in a `finally`.

A new `readSessionMemory(profile)` follows that pattern for counts and the
newest session. The cached active-profile connection is untouched, so the
Sessions screen is unaffected.

## Concurrency

The agent already runs a complete protocol over its memory files, and the
desktop must join it rather than work around it.

`tools/memory_tool.py` locks a sidecar `.lock` file (`fcntl.flock(LOCK_EX)`, or
`msvcrt` on Windows), calls `_reload_target` to re-read from disk **under the
lock** before every mutation, and on detecting drift takes a `.bak.<ts>`
snapshot and **refuses the write** rather than clobbering. Its docstring names
this case explicitly — paraphrasing, a patch tool, a shell append, a manual edit
or a sister-session write. The `add` action deliberately skips the drift check
because appending cannot clobber. Both `MEMORY.md.lock` and `USER.md.lock`
exist on disk today.

**The gap is that the desktop never takes that lock**, and it cannot. Node 22
exposes no `flock` binding (`fs.flock` and `fs.flockSync` are both `undefined`),
and the only lockfile library in the tree — `proper-lockfile`, transitive via
`electron-builder` — locks with `mkdir`, which does not interoperate with an
fcntl advisory lock and would try to create `MEMORY.md.lock` as a directory
while the agent holds it as a regular file. True interop would require a native
addon rebuilt for Electron on three platforms.

The desktop therefore protects writes at two levels, neither needing a native
dependency.

**Compare-and-swap at write time.** Every writer in `memory.ts` reads the file,
computes the new content, then immediately before the atomic rename re-reads
and confirms the on-disk bytes are still exactly what it read. On a mismatch it
re-reads and retries once; if it still mismatches, the write fails with a
conflict. This closes the microsecond window between the desktop's own read and
write.

**Expected-content check at edit time.** The window that actually loses data is
not microseconds; it is the minutes between the user loading an editor and
pressing save, during which the agent may have written the same file. So the
renderer sends what the user was looking at: for User Profile, the content the
editor loaded; for an entry edit or delete, that entry's original text. The
writer compares it with what is on disk _now_ and refuses with `conflict: true`
if they differ, without retrying — a stale expectation can never become fresh.
The UI reloads the view and says the agent changed the file. This also stops an
edit or delete landing on the wrong entry after the agent inserts or removes
one, which shifts every index. Appending an entry is exempt, because appending
cannot clobber. `writeMemoryRaw` is exempt, because it is the cloud-sync pull
where the remote copy wins by design.

**A conflict never falls back to an overwrite.** That is the data loss the
check exists to prevent.

**What has no race to remove.** `config.yaml` and `.env` are written by the
desktop through a temp-file-and-rename, and the agent loads both at session
start, so a mid-session edit is either complete or invisible, never partial.
The desktop reads the agent's `state.db` tables read-only and keeps its own
tables in a separate namespace; it never writes the agent's rows. For the
vault, the desktop writes only the path; the agent's skill writes the notes.
None of these need protection beyond what exists, and the spec says so rather
than inventing it.

Stopping and restarting the agent on save is explicitly rejected. Memory is
injected as a **frozen snapshot at session start** — writes "appear in the
system prompt only at next session" — so a mid-session edit is invisible to the
running agent whether or not it restarts. Restarting would end the in-flight
session for no gain. The affordance is instead a quiet line under each editor
and the vault pane: _"Takes effect in this agent's next session."_

## Bugs fixed en route

**`getActiveMemoryProvider` returns an LLM provider.** `installer.ts:1426`
matches `^\s*provider:\s*["']?(\w+)["']?\s*$` against the whole of
`config.yaml`. It skips `model.provider: "openai-codex"` only because `\w+`
cannot match a hyphen, then matches an unrelated `provider: xai` further down.
Verified against both real profiles:

```
default: getActiveMemoryProvider() -> "xai"
myrtle:  getActiveMemoryProvider() -> "xai"
```

`xai` is a model provider, not a memory provider. The fix reads the
`memory.provider` path specifically via `getYamlPath`, matching what
`Memory.tsx` already does through `getConfig("memory.provider", profile)` — the
two disagree today. A side effect: `discoverMemoryProviders` derives each
provider card's Active badge from this value, so today no card is ever badged
active; the fix repairs that too.

**An SSH delete always reports failure.** `sshRemoveMemoryEntry` returns
`boolean` while every other writer returns `{ success }`; the renderer reads
`result.success` as `undefined` and shows an error after every successful
remote delete. It becomes `WriteResult`.

## Error handling

Every system reads independently and degrades alone. A missing `state.db`
yields `available: false` and a row reading _"No sessions recorded yet"_; it
must not blank the surface or prevent `MEMORY.md` from rendering. This mirrors
the per-check isolation in `config-health.ts`.

A profile whose `memories/` directory does not exist is a legitimate empty
state, not an error — `web-wizard-agent` is exactly this case. On the overview,
one unreadable agent must not blank the list; it renders with an unavailable
marker.

A vault path that points at a missing folder is a warning on the row, not an
error: the user may have set it before creating the folder, or moved the vault.

Provider health is deliberately not modelled. Determining reachability needs a
provider-specific network call per backend, so the row reports what is
configured and whether its plugin is installed, and claims nothing about
liveness.

A failed config health check must not block the model picker; the pick is
saved and the credential hint is simply omitted.

A write that fails the expected-content check, or loses the compare-and-swap
after one retry, fails with a message saying the agent changed the file and the
view has reloaded. It must never fall back to an unconditional overwrite.

## Testing

Unit tests follow the existing `src/main/*.test.ts` pattern of pointing
`HERMES_HOME` at a scratch directory:

- `readMemory` returns all five systems for a profile with only `MEMORY.md`.
- A profile with no `memories/` directory reads as empty, not failed.
- A profile with no `state.db` yields `available: false` while the file-backed
  systems still populate.
- `readSessionMemory` reads a _named_ profile's database, not the active one —
  the regression the current `getDbConnection` design would otherwise cause —
  and reports the newest session time.
- `getActiveMemoryProvider` returns `null` for a config.yaml carrying only
  `model.provider`, and the correct value when `memory.provider` is set. This
  test fails against today's implementation.
- A memory write whose file changed between read and rename fails with a
  conflict rather than overwriting, and reports the conflict to the caller.
- A memory write whose file is unchanged succeeds and preserves prior entries.
- An entry update or delete whose `expected` text no longer matches that entry
  fails with a conflict and writes nothing; a user-profile save whose
  `expected` no longer matches the file does the same.
- `readAllAgentsMemory` returns one entry per profile and survives a profile
  whose stores are unreadable.
- The vault reads as `{ path: null, exists: false }` when unset, and reports
  `exists` correctly for a set path.

Renderer tests: read-only systems render no edit affordance; a >=90% bar
carries the consolidation caption and not an error style; the provider row
shows the not-installed warning; the vault row shows "Not linked" and the
missing-folder warning; the overview links each agent to its own settings; the
Profile tab persists a model pick to that agent's profile and shows the inline
key field when the health check reports a missing key.

`ProfileModal.test.tsx:87` mocks `readMemory` as `{ entries: [] }` — a shape
matching neither today's contract nor the new one. It needs updating to the real
shape, or it will keep passing while the component it guards diverges.

## Documentation

There is no `lat.md` file for memory or for Agent Settings. This work adds
`lat.md/memory.md` covering the five systems, the editability boundary, the two
surfaces and their split of responsibility, per-agent reading, why the
active-profile connection cache is bypassed, and the two-level write protection
and why it is not an fcntl lock; and `lat.md/agent-settings.md` covering the
modal as the per-agent home, its tabs, the model/provider pin and its credential
check, and the vault link. `lat check` must pass.

## Later: presets and onboarding

Not in this spec. `createProfile` already supports `--clone-from`, which copies
a source profile's config, keys, `SOUL.md` and skills. Preset agents become
bundled profile templates selected during a first-run onboarding flow that
leads a new user to their first agent. That flow is its own spec once this
framework is in place.
