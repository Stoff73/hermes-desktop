# Memory

Each agent draws on five memory systems, read and edited in one place — Agent Settings — and summarised read-only on the Memory screen. Desktop writes never overwrite what the agent wrote.

Upstream docs: [memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) and [memory providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers). Design: `docs/superpowers/specs/2026-09-02-memory-screen-design.md`.

## The five systems

Agent Memory and User Profile are bounded markdown files both sides edit; Session Search is the agent's own database; the external provider and the Obsidian vault are configured here but their contents are not read here.

| Key        | Store                           | Editable     | Metric                   |
| ---------- | ------------------------------- | ------------ | ------------------------ |
| `memory`   | `memories/MEMORY.md`            | user + agent | chars / limit            |
| `user`     | `memories/USER.md`              | user + agent | chars / limit            |
| `sessions` | `state.db`                      | read-only    | sessions, messages, last |
| `provider` | one of 8 plugins                | configurable | active name, installed   |
| `vault`    | folder in `OBSIDIAN_VAULT_PATH` | configurable | folder name, exists      |

[[src/main/memory.ts#readMemory]] assembles all five for one profile; every system reads independently so one failure never blanks the others. Persona (`SOUL.md`) is a context file, not a memory system, and keeps its own tab.

The inventory renders four cards, not five: `provider` and `vault` are both external stores you point the agent at but cannot read from here, so they share one **External memory providers** card. The card's metric names the active provider and the linked vault folder; its detail stacks the provider grid above the vault pane.

## Editability boundary

The inventory badges each row Editable, Configurable or Read-only, because a row whose detail hosts an Activate button cannot honestly be called read-only.

The badge is decided in [[src/renderer/src/screens/Memory/MemorySystems.tsx#MemorySystems]]. Bounded stores get a neutral-toned capacity bar from [[src/renderer/src/screens/Memory/CapacityBar.tsx#CapacityBar]] and, at 90%, the caption that the agent consolidates on the next write — at-capacity is the normal steady state, not a fault.

## Two surfaces

Agent Settings writes; the Memory screen reads. Keeping exactly one writing surface is what removes the duplication the earlier tabbed screen had.

### Agent Settings writes

The Memory tab of the profile modal mounts the inventory for that agent and is the only place memory, the provider or the vault path are changed. Every card starts collapsed, so no one system reads as the tab's subject.

See [[agent-settings]]. The modal fetches `readMemory` and `discoverMemoryProviders` together, because an empty provider list makes the provider pane report that no providers exist.

### The overview reads

The Memory screen lists every agent with a run-state dot, fill levels, session count, last activity, provider and vault state, and opens Agent Settings at the Memory tab on selection.

[[src/main/agents-memory.ts#readAllAgentsMemory]] builds one summary per profile and degrades an unreadable agent to an unavailable row. The IPC branches to the SSH readers so a remote connection lists remote agents; the screen is hidden only in HTTP remote mode.

## Run state

Each summary carries whether that agent's gateway is up, so the overview can show a green or red dot and, when red, the reason.

[[src/main/agent-status.ts#readAgentRunStatus]] reads the profile's own `gateway_state.json`. The file outlives the process it describes, so a recorded `running` is believed only when its pid is still alive — otherwise a crashed agent stays green forever. A stopped agent carries the gateway's `exit_reason` verbatim; an unreadable file reports `unknown` rather than guessing, and so does every agent over SSH, which is not inspected for liveness.

## Reading another profile

Session counts come from a short-lived read-only connection to that profile's `state.db`, never from the cached active-profile connection.

`getDbConnection()` resolves the active profile's path and caches one handle, so it cannot serve another agent. [[src/main/memory-session.ts#readSessionMemory]] opens `profileHome(profile)/state.db` read-only and closes it in `finally`.

## Write protection

Two checks stand in for the fcntl lock the agent holds and the desktop cannot take: a compare-and-swap at write time and an expected-content check at edit time. A conflict fails; it never overwrites.

### Compare-and-swap

Immediately before the atomic rename, the on-disk bytes are re-read and must equal what the mutation was computed from; a losing attempt retries once, then fails.

[[src/main/memory-write.ts#mutateMemoryFile]] implements it and returns a `WriteResult` with `conflict: true` on failure. The retry re-reads the agent's newer content and reapplies the caller's change on top.

### Expected-content check

Every edit sends what the user was looking at; the writer refuses if disk no longer matches, without retrying, because a stale expectation cannot become fresh.

[[src/main/memory.ts#updateMemoryEntry]] and [[src/main/memory.ts#removeMemoryEntry]] compare the entry at that index with the text the user saw, which also catches an index shift after the agent inserts or removes an entry. [[src/main/memory.ts#writeUserProfile]] compares the whole file. Appending is exempt (it cannot clobber) and so is the cloud-sync pull in [[src/main/memory.ts#writeMemoryRaw]], where the remote copy wins by design. The editors reload on conflict; the profile editor keeps the draft so a second save is an informed overwrite.

### Why not an fcntl lock

Node 22 has no `flock`, and the only lockfile library in the tree locks with `mkdir`, which cannot interoperate with the agent's advisory lock.

The agent's `memory_tool.py` re-reads under its lock before every mutation, so a desktop write landing outside that window is picked up on its next reload rather than lost. Config and env writes are already atomic and the agent loads them at session start; the desktop reads `state.db` read-only and writes only the vault path, so those have no race to remove.

## Provider detection

The active memory provider is read from the `memory.provider` path, not from any `provider:` line in the file.

[[src/main/installer.ts#getActiveMemoryProvider]] previously regex-scanned the whole `config.yaml` and reported the LLM provider (`xai`) as the memory provider on real configs, which also meant no provider card was ever badged Active.

## The vault

The Obsidian vault is a folder the agent's bundled note-taking skill uses, located by `OBSIDIAN_VAULT_PATH` in the agent's `.env`; the desktop sets the path and nothing else.

The vault pane sits inside the External memory providers card, under its own heading. [[src/renderer/src/screens/Memory/MemoryVault.tsx#MemoryVault]] writes it through the existing `setEnv`, using the native folder dialog, and unlinks through [[src/main/config.ts#removeEnvValue]], which deletes the line rather than leaving a blank `KEY=` for the skill to misread. Because the variable is profile-scoped, agents can use different vaults. A path whose folder is missing is a warning, not an error.

## Slash command

`/memory` in chat prints the same five systems for the active agent, so the command and the UI agree on what memory is.

See [[chat-commands#Slash command execution#Central command router#Desktop commands]] for how desktop commands are dispatched.

## Tests

Main-process tests point `HERMES_HOME` at a scratch directory; renderer tests mock `useI18n` so `t()` returns the key.

### Compare-and-swap protocol

An unchanged file is written; a file that changed mid-mutation is retried once and then fails with `conflict`; a mutation reporting a stale view fails at once without writing.

### Writers refuse stale edits

An update or delete whose expected text no longer matches that index, and a profile save whose expected content no longer matches the file, fail with `conflict` and write nothing; without an expectation the check is skipped.

### Provider path is read, not scanned

A config carrying only `model.provider` and an unrelated `provider: xai` yields no memory provider; `memory.provider` is returned when set; an empty quoted value reads as unset.

### Named profile sessions

Counts and the newest start time are read from the named profile's database, not the active one, and a profile without `state.db` reports `available: false`.

### Five-system contract

`readMemory` returns all five systems, coerces a deactivated provider to `null`, exposes no `stats`, survives a missing `memories/` directory, and reads the vault path and folder existence.

### Cross-agent summary

One row per profile; an agent whose stores throw becomes an unavailable row instead of failing the list.

### Inventory rendering

All five rows render with the correct badge; a near-full store carries the consolidation caption and no error colour; sessions never appear on User Profile; provider and vault warnings show; rows toggle their detail.

### Vault pane

Shows Not linked or the path with a missing-folder warning; choosing a folder writes `OBSIDIAN_VAULT_PATH` for that agent; unlinking removes the variable from that agent's `.env` rather than blanking it.

### Unlinking removes the variable

`removeEnvValue` deletes the variable's active and commented lines and leaves every other line untouched; it is a no-op when the variable or the file is absent.

### Entry editor sends expectations

Saving an edit sends the entry's original text; a conflict reloads, closes the editor and shows the message; deleting sends the entry text and reports failure.

### Profile editor keeps the draft

Saving sends the loaded content as the expectation; on conflict the draft survives and the view reloads; fresh content resyncs the textarea when nothing is being edited.

### Agent run status

A live pid reads as running; a `running` record whose process is gone reads as stopped, as does an agent that never started; the gateway's exit reason is passed through, and an unreadable state file reports unknown.

### Overview rows

Every agent renders with its facts; an unreadable agent is marked without blanking the list; selecting a row opens that agent; no editing affordance exists.
