# Agent Settings: memory, model and vault per agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline, in this session. Steps use checkbox (`- [ ]`) syntax for tracking. Read **Execution protocol** before Task 0 and follow it for every task.

**Goal:** Make Agent Settings the one place where an agent's memory (five systems), LLM model/provider, and Obsidian vault are read and edited; turn the top-level Memory screen into a read-only cross-agent overview; and stop desktop memory writes from silently losing the agent's concurrent edits.

**Architecture:** The storage layer is already per-profile; the UI is what pretends otherwise. Extend `MemoryInfo` from two markdown files to five systems, add per-profile readers that do not disturb the cached active-profile SQLite connection, route every desktop memory write through a two-level check (compare-and-swap at write time, expected-content at edit time) that reports conflicts instead of overwriting, render the systems inventory and a model picker inside the existing profile modal, and render a compact read-only overview on the Memory screen. Nothing new is built below the renderer for the model picker: the chat's `useModelConfig(profile)` hook and `ModelPicker` component are reused in persist mode.

**Tech Stack:** Electron + TypeScript, React renderer, `better-sqlite3`, `date-fns`, `lucide-react`, Vitest + Testing Library, `lat.md` for docs.

**Spec:** `docs/superpowers/specs/2026-09-02-memory-screen-design.md` — read it first; every task argues from it.

## Execution protocol

This plan is written for an agent (Opus 5) executing inline in one session. Follow it exactly.

**Skills to invoke, and when:**

| When | Skill | Why |
| --- | --- | --- |
| Before Task 0 | `superpowers:executing-plans` | Sets the task loop: mark in progress, follow steps, verify, mark complete, stop on blockers. |
| Task 0, Step 1 | `superpowers:using-git-worktrees` | Creates the isolated branch/worktree. Never implement on `main`. |
| Every task with a test | `superpowers:test-driven-development` | Red → green → commit. Write the failing test first, watch it fail, then implement. |
| Before every commit and at Task 12 | `superpowers:verification-before-completion` | Run the named commands and read their output before claiming anything passes. |
| Task 12 (docs) | `lat-md` | Section rules: leading paragraph ≤250 chars under every heading, `@lat:` tags on tests, `lat check` must pass. |
| Task 13 | `superpowers:finishing-a-development-branch` | Verify, then open the PR. |

**Progress tracking — do this, it is how CSJ keeps the work on track:**

1. When you start a task, change its row in the **Progress** table below to `in progress`.
2. After each step, tick its checkbox in this file: `- [ ]` → `- [x]`.
3. When the task's commit step runs, include this plan file in that commit (`git add docs/superpowers/plans/2026-09-02-memory-per-agent.md`) so the ticks land with the code.
4. Set the row to `done` with the commit's short SHA.
5. If a step fails and you cannot fix it inside that task's own rules, write what happened under **Execution log** at the bottom, set the row to `blocked`, commit the plan file alone (`wip(plan): log blocker on task N`), and stop. Do not skip ahead.

**Rules that apply to every task:**

- Run commands exactly as written. Do not substitute `npm test` for a targeted `npx vitest run <path>`.
- A test that you expected to fail and that passes instead is a bug in the test. Stop and fix the test before implementing.
- Never widen a task's scope. If you notice something else broken, note it in the Execution log and continue.
- Copy code from this plan verbatim, then adapt only where the plan says "adapt".
- `lat` is not installed globally: use `npx --yes lat.md check` and `npx --yes lat.md locate "<Section>"`.

## Progress

| # | Task | Status | Commit |
| --- | --- | --- | --- |
| 0 | Branch and baseline | done | (no code) |
| 1 | Compare-and-swap writes with an expected-content check | done | b04741d |
| 2 | Route every memory writer through the check | done | 75c32bc |
| 3 | Fix `getActiveMemoryProvider` reading the LLM provider | done | 0aad884 |
| 4 | Per-profile session reader | done | 10621c7 |
| 5 | Five-system `MemoryInfo` contract and its consumers | done | b29f77a |
| 6 | Cross-agent memory summary reader and IPC | in progress | |
| 7 | Systems inventory, vault pane, capacity tone, styles | not started | |
| 8 | Conflict-aware editors | not started | |
| 9 | Agent Settings: Memory tab and naming | not started | |
| 10 | Memory screen becomes the cross-agent overview | not started | |
| 11 | Agent Settings: model and provider in the Profile tab | not started | |
| 12 | Documentation and full verification | not started | |
| 13 | Finish the branch | not started | |

## File map

Files this plan creates or changes, and what each is responsible for.

| File | Responsibility |
| --- | --- |
| `src/main/memory-write.ts` (new) | The two-level write check: `mutateMemoryFile` and `WriteResult`. Knows nothing about memory formats. |
| `src/main/memory.ts` | Memory file formats, limits, the five-system `readMemory`, and the five writers. |
| `src/main/memory-session.ts` (new) | Read-only counts and last activity from one profile's `state.db`. |
| `src/main/agents-memory.ts` (new) | One summary row per agent for the overview; isolates per-agent failures. |
| `src/main/installer.ts` | `getActiveMemoryProvider` fix only. |
| `src/main/config.ts` | Gains `removeEnvValue`, the remover the env layer never had; unlinking the vault deletes the line instead of blanking it. |
| `src/main/ssh-remote.ts` | SSH twins of every reader and writer above. |
| `src/main/ipc/register.ts` | Memory IPC handlers: pass `expected` through; add `read-all-agents-memory`. |
| `src/preload/index.ts`, `src/preload/index.d.ts` | Renderer-facing signatures for the above. |
| `src/renderer/src/screens/Memory/types.ts` | Renderer copies of `MemoryData` and `AgentMemorySummary`. |
| `src/renderer/src/screens/Memory/CapacityBar.tsx` | Gains `tone` and a zero-limit guard. |
| `src/renderer/src/screens/Memory/MemorySystems.tsx` (new) | The five-row inventory with expandable details. |
| `src/renderer/src/screens/Memory/MemoryVault.tsx` (new) | The vault detail pane: path, Choose Folder, Clear. |
| `src/renderer/src/screens/Memory/MemoryEntries.tsx`, `MemoryProfile.tsx` | Send `expected`, reload on conflict. |
| `src/renderer/src/screens/Memory/Memory.tsx` | Rewritten as the read-only overview. `MemoryTabs.tsx` and `CapacityCards.tsx` are deleted. |
| `src/renderer/src/screens/Chat/hooks/useLocalCommands.ts` | `/memory` prints all five systems. |
| `src/renderer/src/screens/Layout/Layout.tsx` | Mounts the overview with `onOpenAgent`. |
| `src/renderer/src/components/profile/ProfileModal.tsx` | Memory tab mounts the inventory; Profile tab mounts the model picker; labels. |
| `src/renderer/src/components/profile/ProfileModelPicker.tsx` (new) | Per-agent model pick + inline missing-key field. |
| `src/shared/i18n/locales/en/memory.ts`, `en/agents.ts` | New English strings. |
| `src/renderer/src/assets/main.css` | Styles for every new class name. |
| `lat.md/memory.md`, `lat.md/agent-settings.md` (new), `lat.md/lat.md`, `lat.md/chat-commands.md` | Documentation. |

## Global Constraints

- Node has **no** `flock`. Never add a native locking addon; concurrency is compare-and-swap plus expected-content only.
- A memory write must **never** overwrite a file that changed since it was read, or that no longer matches what the user saw. Failing is correct; overwriting is not.
- New user-facing strings go in `src/shared/i18n/locales/en/*.ts` only. `t()` falls back to English for other locales (`src/shared/i18n/index.ts:624`), so English-only additions are safe.
- Read another profile's `state.db` with a short-lived read-only connection, closed in `finally`. Never route it through `getDbConnection()`, which caches one connection for the active profile.
- Every system reads independently; one unavailable system must not blank a surface.
- Persona/`SOUL.md` is a context file, not a memory system. It keeps its own Persona tab and never joins the inventory.
- The vault is a folder the agent's Obsidian skill uses, not a memory provider. The desktop writes only its path (`OBSIDIAN_VAULT_PATH` in the profile `.env`), never notes.
- `npm run typecheck` and `npx --yes lat.md check` must pass before the final commit.
- Run tests with `npx vitest run <path>`. `vitest.config` includes `src/**/*.test.ts(x)` and `tests/**/*.test.ts`.
- `listProfiles()` in `src/main/profiles.ts:176` is **async** (`Promise<ProfileInfo[]>`). Anything consuming it is async too.
- Every SSH twin of a changed reader or writer changes with it. `src/main/ipc/register.ts` branches to `ssh*` variants, so a renderer in SSH mode gets the SSH return type, not the local one. `SshProfileInfo` has **no** `id` field; its `name` is the directory slug.
- New class names need styles in `src/renderer/src/assets/main.css` in the same task. An unstyled `<button>` row is not a finished component. `grep -c "memory-system" main.css` and `grep -c "memory-agent" main.css` are both 0 today.
- Renderer tests mock `useI18n` so `t()` returns the key (see `ConfigHealthBanner.test.tsx:8-13`). Never assert English copy.
- `tsconfig.web.json` includes test files, so a test that omits a required prop fails `npm run typecheck:web`.
- Git hooks only run on `release*` branches; commits on the feature branch are not gated by them.

---

### Task 0: Branch and baseline

**Files:** none changed.

**Interfaces:** none.

- [x] **Step 1: Create the isolated workspace**

Invoke `superpowers:using-git-worktrees`. Branch name: `feat/agent-settings-memory`. If it creates a worktree under `.worktrees/`, `cd` into it for every later command. Confirm:

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `feat/agent-settings-memory`

- [x] **Step 2: Install and typecheck the untouched tree**

Run: `npm install && npm run typecheck`
Expected: typecheck clean. If it is not clean before you have changed anything, stop and log it.

- [x] **Step 3: Measure the test baseline yourself**

Run: `npx vitest run 2>&1 | tail -15`
Expected: mostly passing. At the time of writing `tests/gateway-restart.test.ts` and `tests/terminal-launcher.test.ts` failed on a clean tree and appeared flaky, but that is **unverified for your checkout**. Write the exact list of failing files under **Execution log → Baseline**. Any failure outside that list later is yours.

- [x] **Step 4: Record the baseline**

Update the Progress row for Task 0 to `done` (no commit; nothing changed). Commit the plan file alone:

```bash
git add docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "docs(plan): record test baseline before implementation"
```

---

### Task 1: Compare-and-swap writes with an expected-content check

**Files:**

- Create: `src/main/memory-write.ts`
- Test: `src/main/memory-write.test.ts`

**Interfaces:**

- Consumes: `safeWriteFile` from `./utils` (atomic temp-file-and-rename; creates the parent directory).
- Produces, and Task 2 depends on these exact names:
  - `WriteResult` = `{ success: boolean; error?: string; conflict?: boolean }`
  - `Mutation` = `{ content: string } | { error: string } | { conflict: true }`
  - `MEMORY_CONFLICT_ERROR: string`
  - `readCurrent(filePath: string): string`
  - `mutateMemoryFile(filePath: string, mutate: (current: string) => Mutation): WriteResult`

- [x] **Step 1: Write the failing test**

```ts
// src/main/memory-write.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  readCurrent,
  mutateMemoryFile,
  MEMORY_CONFLICT_ERROR,
} from "./memory-write";

const dir = mkdtempSync(join(tmpdir(), "hermes-cas-"));
const file = join(dir, "MEMORY.md");

beforeEach(() => writeFileSync(file, "one"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("mutateMemoryFile", () => {
  it("reads an absent file as empty string", () => {
    expect(readCurrent(join(dir, "nope.md"))).toBe("");
  });

  it("writes when the file is unchanged", () => {
    const r = mutateMemoryFile(file, (cur) => ({ content: cur + "-two" }));
    expect(r).toEqual({ success: true });
    expect(readFileSync(file, "utf-8")).toBe("one-two");
  });

  it("retries once when the file changes mid-mutate, then succeeds", () => {
    let calls = 0;
    const r = mutateMemoryFile(file, (cur) => {
      calls += 1;
      if (calls === 1) writeFileSync(file, "agent-wrote"); // simulate the agent
      return { content: cur + "-mine" };
    });
    expect(r.success).toBe(true);
    expect(calls).toBe(2);
    // The second attempt read the agent's content, so its work is preserved.
    expect(readFileSync(file, "utf-8")).toBe("agent-wrote-mine");
  });

  it("fails with conflict rather than overwriting when it keeps losing", () => {
    const r = mutateMemoryFile(file, (cur) => {
      writeFileSync(file, "agent-" + Math.random()); // changes every attempt
      return { content: cur + "-mine" };
    });
    expect(r.success).toBe(false);
    expect(r.conflict).toBe(true);
    expect(r.error).toBe(MEMORY_CONFLICT_ERROR);
    expect(readFileSync(file, "utf-8")).toMatch(/^agent-/); // never clobbered
  });

  it("fails with conflict and writes nothing when the mutation reports a stale view", () => {
    let calls = 0;
    const r = mutateMemoryFile(file, () => {
      calls += 1;
      return { conflict: true };
    });
    expect(r).toEqual({
      success: false,
      conflict: true,
      error: MEMORY_CONFLICT_ERROR,
    });
    expect(calls).toBe(1); // a stale expectation can never become fresh
    expect(readFileSync(file, "utf-8")).toBe("one");
  });

  it("returns a failure result instead of throwing when the write fails", () => {
    const r = mutateMemoryFile(join(dir, "no-such-dir", "x", "\0bad"), () => ({
      content: "x",
    }));
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("propagates a mutate error without writing", () => {
    const r = mutateMemoryFile(file, () => ({ error: "too long" }));
    expect(r).toEqual({ success: false, error: "too long" });
    expect(readFileSync(file, "utf-8")).toBe("one");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/memory-write.test.ts`
Expected: FAIL — cannot resolve `./memory-write`.

- [x] **Step 3: Write the implementation**

```ts
// src/main/memory-write.ts
import { existsSync, readFileSync } from "fs";
import { safeWriteFile } from "./utils";

export interface WriteResult {
  success: boolean;
  error?: string;
  /**
   * Nothing was written because the file changed underneath us, or no longer
   * matches what the user was looking at. The caller should reload its view.
   */
  conflict?: boolean;
}

/** What a mutation wants done with the file it was handed. */
export type Mutation =
  | { content: string }
  | { error: string }
  /** Disk no longer matches what the user saw. Fail now; do not retry. */
  | { conflict: true };

export const MEMORY_CONFLICT_ERROR =
  "The agent changed this file while you were editing. Your view has been " +
  "reloaded — reapply your change.";

/** Current bytes of a memory file; "" when absent or unreadable. */
export function readCurrent(filePath: string): string {
  try {
    return existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
  } catch {
    return "";
  }
}

function conflict(): WriteResult {
  return { success: false, conflict: true, error: MEMORY_CONFLICT_ERROR };
}

/**
 * Read-modify-write a memory file without clobbering a concurrent writer.
 *
 * Node exposes no flock, so we cannot join the agent's fcntl lock on
 * `<file>.lock`. Two checks stand in for it:
 *
 * 1. The mutation may report `conflict` when the content it was handed no
 *    longer matches what the user was editing (the writer decides; see
 *    memory.ts). That fails immediately — a stale expectation cannot become
 *    fresh by retrying.
 * 2. Immediately before the atomic rename we confirm the on-disk bytes still
 *    match what the mutation was computed from. A losing attempt re-reads and
 *    retries once, which picks up the agent's write and reapplies the caller's
 *    change on top. A second loss fails as a conflict.
 *
 * It never falls back to an unconditional write.
 */
export function mutateMemoryFile(
  filePath: string,
  mutate: (current: string) => Mutation,
): WriteResult {
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = readCurrent(filePath);
    const result = mutate(current);
    if ("error" in result) return { success: false, error: result.error };
    if ("conflict" in result) return conflict();
    if (readCurrent(filePath) !== current) continue; // lost the race, retry once
    try {
      safeWriteFile(filePath, result.content);
    } catch (err) {
      // writeMemoryRaw's caller (the agent-sync cloud pull) expects a result,
      // not a throw — preserve that for every writer routed through here.
      return { success: false, error: (err as Error).message };
    }
    return { success: true };
  }
  return conflict();
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/memory-write.test.ts`
Expected: PASS, 7 tests.

- [x] **Step 5: Commit**

```bash
git add src/main/memory-write.ts src/main/memory-write.test.ts docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "feat(memory): compare-and-swap writes that report conflicts instead of overwriting"
```

---

### Task 2: Route every memory writer through the check

**Files:**

- Modify: `src/main/memory.ts` (`addMemoryEntry`, `updateMemoryEntry`, `removeMemoryEntry`, `writeUserProfile`, `writeMemoryRaw`)
- Modify: `src/main/ssh-remote.ts:560-616` (`sshUpdateMemoryEntry`, `sshRemoveMemoryEntry`, `sshWriteUserProfile`)
- Modify: `src/main/ipc/register.ts:2383-2410` (three handlers)
- Modify: `src/preload/index.ts:1040-1052`, `src/preload/index.d.ts:755-764`
- Test: `src/main/memory-writers.test.ts`

**Interfaces:**

- Consumes: `mutateMemoryFile`, `WriteResult`, `Mutation` from Task 1.
- Produces, and Tasks 5, 8 and 9 depend on these exact signatures:
  - `addMemoryEntry(content: string, profile?: string): WriteResult`
  - `updateMemoryEntry(index: number, content: string, profile?: string, expected?: string): WriteResult`
  - `removeMemoryEntry(index: number, profile?: string, expected?: string): WriteResult` — **was `boolean`**
  - `writeUserProfile(content: string, profile?: string, expected?: string): WriteResult`
  - `writeMemoryRaw(content: string, profile?: string): WriteResult`
  - `expected` is what the user was looking at: the entry's original text for update/remove, the whole file for the user profile. When omitted (agent-sync, old callers) the check is skipped.

- [x] **Step 1: Write the failing test**

```ts
// src/main/memory-writers.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

const home = mkdtempSync(join(tmpdir(), "hermes-mw-"));
process.env.HERMES_HOME = home;
const memFile = join(home, "memories", "MEMORY.md");
const userFile = join(home, "memories", "USER.md");

let mod: typeof import("./memory");
beforeAll(async () => {
  mkdirSync(join(home, "memories"), { recursive: true });
  mod = await import("./memory");
});
beforeEach(() => {
  writeFileSync(memFile, "first");
  writeFileSync(userFile, "me");
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("memory writers", () => {
  it("appends an entry with the § delimiter", () => {
    expect(mod.addMemoryEntry("second")).toEqual({ success: true });
    expect(readFileSync(memFile, "utf-8")).toBe("first\n§\nsecond");
  });

  it("removes an entry and reports success", () => {
    writeFileSync(memFile, "a\n§\nb");
    expect(mod.removeMemoryEntry(0)).toEqual({ success: true });
    expect(readFileSync(memFile, "utf-8")).toBe("b");
  });

  it("reports a missing index instead of throwing", () => {
    const r = mod.removeMemoryEntry(99);
    expect(r.success).toBe(false);
    expect(r.conflict).toBeUndefined();
    expect(r.error).toBeTruthy();
  });

  it("still enforces the char limit", () => {
    const r = mod.addMemoryEntry("x".repeat(5000));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/limit/i);
    expect(readFileSync(memFile, "utf-8")).toBe("first");
  });

  it("updates an entry whose expected text still matches", () => {
    writeFileSync(memFile, "a\n§\nb");
    expect(mod.updateMemoryEntry(1, "B", undefined, "b")).toEqual({
      success: true,
    });
    expect(readFileSync(memFile, "utf-8")).toBe("a\n§\nB");
  });

  it("refuses an update whose expected text is stale, and writes nothing", () => {
    // The user loaded [a, b, c] and is editing "c" at index 2; the agent then
    // removed "a", so index 2 no longer exists and "c" moved to index 1.
    writeFileSync(memFile, "b\n§\nc");
    const r = mod.updateMemoryEntry(2, "C", undefined, "c");
    expect(r.success).toBe(false);
    expect(r.conflict).toBe(true);
    expect(readFileSync(memFile, "utf-8")).toBe("b\n§\nc");
    // Same shape when the index exists but holds a different entry now.
    const r2 = mod.updateMemoryEntry(1, "C", undefined, "zzz");
    expect(r2.conflict).toBe(true);
    expect(readFileSync(memFile, "utf-8")).toBe("b\n§\nc");
  });

  it("refuses a delete whose expected text is stale", () => {
    writeFileSync(memFile, "b\n§\nc");
    const r = mod.removeMemoryEntry(0, undefined, "a");
    expect(r.conflict).toBe(true);
    expect(readFileSync(memFile, "utf-8")).toBe("b\n§\nc");
  });

  it("skips the expected check when no expectation is given", () => {
    writeFileSync(memFile, "b\n§\nc");
    expect(mod.removeMemoryEntry(0)).toEqual({ success: true });
    expect(readFileSync(memFile, "utf-8")).toBe("c");
  });

  it("saves the user profile when expected matches the file", () => {
    expect(mod.writeUserProfile("me v2", undefined, "me")).toEqual({
      success: true,
    });
    expect(readFileSync(userFile, "utf-8")).toBe("me v2");
  });

  it("refuses a user profile save whose expected content is stale", () => {
    writeFileSync(userFile, "agent edited me");
    const r = mod.writeUserProfile("me v2", undefined, "me");
    expect(r.conflict).toBe(true);
    expect(readFileSync(userFile, "utf-8")).toBe("agent edited me");
  });

  it("writeMemoryRaw replaces the file without an expectation", () => {
    expect(mod.writeMemoryRaw("cloud copy")).toEqual({ success: true });
    expect(readFileSync(memFile, "utf-8")).toBe("cloud copy");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/memory-writers.test.ts`
Expected: FAIL — `removeMemoryEntry` returns `true`, not `{ success: true }`; the `expected` tests fail because the argument is ignored.

- [x] **Step 3: Replace the five writers in `src/main/memory.ts`**

Add the import at the top of `src/main/memory.ts`:

```ts
import {
  mutateMemoryFile,
  type Mutation,
  type WriteResult,
} from "./memory-write";
```

Delete the line `const writeFileSafe = safeWriteFile;` and its comment. Keep the `safeWriteFile` import only if something else in the file still uses it (after this task nothing does — remove it from the import list too).

Replace everything from the `// ── Write operations` comment to the end of the file (and `writeMemoryRaw` above it) with:

```ts
/**
 * Replace MEMORY.md wholesale. Used by cloud agent sync when the remote copy
 * wins — the content is the user's own cloud copy, so no entry parsing or
 * char-limit gate applies, and there is no "what the user saw" to check
 * against. Still goes through the compare-and-swap so a concurrent agent
 * write is retried over rather than clobbered.
 */
export function writeMemoryRaw(content: string, profile?: string): WriteResult {
  return mutateMemoryFile(memoryPath(profile), () => ({ content }));
}

// ── Write operations ────────────────────────────────

/**
 * Guard for index-addressed edits. `expected` is the entry text the user was
 * looking at. If the index is gone or holds different text now, the agent has
 * reordered the file underneath the user and the edit must not land.
 */
function entryStillMatches(
  entries: MemoryEntry[],
  index: number,
  expected: string | undefined,
): Mutation | null {
  if (index < 0 || index >= entries.length) {
    return expected === undefined
      ? { error: "Entry not found" }
      : { conflict: true };
  }
  if (expected !== undefined && entries[index].content !== expected.trim()) {
    return { conflict: true };
  }
  return null;
}

export function addMemoryEntry(content: string, profile?: string): WriteResult {
  const limits = readMemoryLimits(profile);
  return mutateMemoryFile(memoryPath(profile), (current) => {
    const entries = parseMemoryEntries(current);
    const next = serializeEntries([
      ...entries,
      { index: entries.length, content: content.trim() },
    ]);
    if (next.length > limits.memoryCharLimit) {
      return {
        error: `Would exceed memory limit (${next.length}/${limits.memoryCharLimit} chars)`,
      };
    }
    return { content: next };
  });
}

export function updateMemoryEntry(
  index: number,
  content: string,
  profile?: string,
  expected?: string,
): WriteResult {
  const limits = readMemoryLimits(profile);
  return mutateMemoryFile(memoryPath(profile), (current) => {
    const entries = parseMemoryEntries(current);
    const stale = entryStillMatches(entries, index, expected);
    if (stale) return stale;
    entries[index] = { ...entries[index], content: content.trim() };
    const next = serializeEntries(entries);
    if (next.length > limits.memoryCharLimit) {
      return {
        error: `Would exceed memory limit (${next.length}/${limits.memoryCharLimit} chars)`,
      };
    }
    return { content: next };
  });
}

export function removeMemoryEntry(
  index: number,
  profile?: string,
  expected?: string,
): WriteResult {
  return mutateMemoryFile(memoryPath(profile), (current) => {
    const entries = parseMemoryEntries(current);
    const stale = entryStillMatches(entries, index, expected);
    if (stale) return stale;
    entries.splice(index, 1);
    return { content: serializeEntries(entries) };
  });
}

export function writeUserProfile(
  content: string,
  profile?: string,
  expected?: string,
): WriteResult {
  const limits = readMemoryLimits(profile);
  if (content.length > limits.userCharLimit) {
    return {
      success: false,
      error: `Exceeds limit (${content.length}/${limits.userCharLimit} chars)`,
    };
  }
  return mutateMemoryFile(userPath(profile), (current) => {
    if (expected !== undefined && current !== expected) return { conflict: true };
    return { content };
  });
}
```

- [x] **Step 4: Run the writer tests**

Run: `npx vitest run src/main/memory-writers.test.ts src/main/memory-write.test.ts`
Expected: PASS, 11 + 7 tests.

- [x] **Step 5: Normalise the SSH twins**

In `src/main/ssh-remote.ts`, add to the existing `import type { MemoryInfo } from "./memory";` line:

```ts
import type { MemoryInfo } from "./memory";
import type { WriteResult } from "./memory-write";
```

Replace `sshUpdateMemoryEntry`, `sshRemoveMemoryEntry` and `sshWriteUserProfile` (lines 560-616) with:

```ts
export async function sshUpdateMemoryEntry(
  config: SshConfig,
  index: number,
  content: string,
  profile?: string,
  expected?: string,
): Promise<WriteResult> {
  const [current, limits] = await Promise.all([
    sshReadFile(config, remoteMemoryPath(profile)),
    sshReadMemoryLimits(config, profile),
  ]);
  const entries = parseMemoryEntries(current);
  const stale = sshEntryStale(entries, index, expected);
  if (stale) return stale;
  entries[index] = { ...entries[index], content: content.trim() };
  const newContent = serializeEntries(entries);
  if (newContent.length > limits.memoryCharLimit) {
    return {
      success: false,
      error: `Would exceed memory limit (${newContent.length}/${limits.memoryCharLimit} chars)`,
    };
  }
  await sshWriteFile(config, remoteMemoryPath(profile), newContent);
  return { success: true };
}

export async function sshRemoveMemoryEntry(
  config: SshConfig,
  index: number,
  profile?: string,
  expected?: string,
): Promise<WriteResult> {
  const current = await sshReadFile(config, remoteMemoryPath(profile));
  const entries = parseMemoryEntries(current);
  const stale = sshEntryStale(entries, index, expected);
  if (stale) return stale;
  entries.splice(index, 1);
  await sshWriteFile(
    config,
    remoteMemoryPath(profile),
    serializeEntries(entries),
  );
  return { success: true };
}

export async function sshWriteUserProfile(
  config: SshConfig,
  content: string,
  profile?: string,
  expected?: string,
): Promise<WriteResult> {
  const limits = await sshReadMemoryLimits(config, profile);
  if (content.length > limits.userCharLimit) {
    return {
      success: false,
      error: `Exceeds limit (${content.length}/${limits.userCharLimit} chars)`,
    };
  }
  if (expected !== undefined) {
    const current = await sshReadFile(config, remoteUserPath(profile));
    if (current !== expected) return sshConflict();
  }
  await sshWriteFile(config, remoteUserPath(profile), content);
  return { success: true };
}

// Over SSH there is no atomic compare-and-swap, only the expected-content
// check; the remote write itself is a plain file write.
function sshConflict(): WriteResult {
  return {
    success: false,
    conflict: true,
    error:
      "The agent changed this file while you were editing. Your view has " +
      "been reloaded — reapply your change.",
  };
}

function sshEntryStale(
  entries: { content: string }[],
  index: number,
  expected: string | undefined,
): WriteResult | null {
  if (index < 0 || index >= entries.length) {
    return expected === undefined
      ? { success: false, error: "Entry not found" }
      : sshConflict();
  }
  if (expected !== undefined && entries[index].content !== expected.trim()) {
    return sshConflict();
  }
  return null;
}
```

- [x] **Step 6: Pass `expected` through IPC and preload**

In `src/main/ipc/register.ts`, replace the `update-memory-entry`, `remove-memory-entry` and `write-user-profile` handlers with:

```ts
  ipcMain.handle(
    "update-memory-entry",
    (
      _event,
      index: number,
      content: string,
      profile?: string,
      expected?: string,
    ) => {
      const conn = getConnectionConfig();
      if (conn.mode === "ssh" && conn.ssh)
        return sshUpdateMemoryEntry(conn.ssh, index, content, profile, expected);
      return updateMemoryEntry(index, content, profile, expected);
    },
  );
  ipcMain.handle(
    "remove-memory-entry",
    (_event, index: number, profile?: string, expected?: string) => {
      const conn = getConnectionConfig();
      if (conn.mode === "ssh" && conn.ssh)
        return sshRemoveMemoryEntry(conn.ssh, index, profile, expected);
      return removeMemoryEntry(index, profile, expected);
    },
  );
  ipcMain.handle(
    "write-user-profile",
    (_event, content: string, profile?: string, expected?: string) => {
      const conn = getConnectionConfig();
      if (conn.mode === "ssh" && conn.ssh)
        return sshWriteUserProfile(conn.ssh, content, profile, expected);
      return writeUserProfile(content, profile, expected);
    },
  );
```

In `src/preload/index.ts`, replace the four writer entries (`addMemoryEntry` through `writeUserProfile`) with:

```ts
  addMemoryEntry: (
    content: string,
    profile?: string,
  ): Promise<{ success: boolean; error?: string; conflict?: boolean }> =>
    ipcRenderer.invoke("add-memory-entry", content, profile),
  updateMemoryEntry: (
    index: number,
    content: string,
    profile?: string,
    expected?: string,
  ): Promise<{ success: boolean; error?: string; conflict?: boolean }> =>
    ipcRenderer.invoke("update-memory-entry", index, content, profile, expected),
  removeMemoryEntry: (
    index: number,
    profile?: string,
    expected?: string,
  ): Promise<{ success: boolean; error?: string; conflict?: boolean }> =>
    ipcRenderer.invoke("remove-memory-entry", index, profile, expected),
  writeUserProfile: (
    content: string,
    profile?: string,
    expected?: string,
  ): Promise<{ success: boolean; error?: string; conflict?: boolean }> =>
    ipcRenderer.invoke("write-user-profile", content, profile, expected),
```

In `src/preload/index.d.ts`, replace the matching four declarations with:

```ts
  addMemoryEntry: (
    content: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string; conflict?: boolean }>;
  updateMemoryEntry: (
    index: number,
    content: string,
    profile?: string,
    expected?: string,
  ) => Promise<{ success: boolean; error?: string; conflict?: boolean }>;
  removeMemoryEntry: (
    index: number,
    profile?: string,
    expected?: string,
  ) => Promise<{ success: boolean; error?: string; conflict?: boolean }>;
  writeUserProfile: (
    content: string,
    profile?: string,
    expected?: string,
  ) => Promise<{ success: boolean; error?: string; conflict?: boolean }>;
```

- [x] **Step 7: Typecheck and run the memory tests**

Run: `npm run typecheck && npx vitest run src/main/memory-writers.test.ts src/main/agent-sync.test.ts`
Expected: typecheck clean (`MemoryEntries.tsx` still compiles because it ignores `removeMemoryEntry`'s result; Task 8 fixes that). Tests PASS. If `agent-sync.test.ts` fails on `writeMemoryRaw`'s return shape, its mock at `src/main/agent-sync.test.ts:90` returns the old shape — update the mock to return `{ success: true }`.

- [x] **Step 8: Commit**

```bash
git add src/main/memory.ts src/main/memory-writers.test.ts src/main/ssh-remote.ts src/main/ipc/register.ts src/preload/index.ts src/preload/index.d.ts src/main/agent-sync.test.ts docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "feat(memory): route all memory writes through the conflict check"
```

---

### Task 3: Fix `getActiveMemoryProvider` reading the LLM provider

**Files:**

- Modify: `src/main/installer.ts:1426-1436`
- Test: `src/main/active-memory-provider.test.ts`

**Interfaces:**

- Consumes: `getYamlPath(content: string, dottedKey: string): string | null` from `./yaml-path` (returns `""` for `provider: ""`, `null` when the key is absent).
- Produces: `getActiveMemoryProvider(profile?: string): string` — unchanged signature, correct value. Task 5 depends on it. Side effect: `discoverMemoryProviders` derives each provider's `active` flag from this, so the Active badge on provider cards starts working.

- [x] **Step 1: Write the failing test**

```ts
// src/main/active-memory-provider.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const home = mkdtempSync(join(tmpdir(), "hermes-amp-"));
process.env.HERMES_HOME = home;
const cfg = join(home, "config.yaml");

let getActiveMemoryProvider: (p?: string) => string;
beforeAll(async () => {
  ({ getActiveMemoryProvider } = await import("./installer"));
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("getActiveMemoryProvider", () => {
  it("ignores an unrelated model provider", () => {
    // The real config shape that produced "xai" as the memory provider.
    writeFileSync(
      cfg,
      'model:\n  default: "gpt-5.6-luna"\n  provider: "openai-codex"\n' +
        "providers:\n  grok:\n    provider: xai\n",
    );
    expect(getActiveMemoryProvider()).toBe("");
  });

  it("reads memory.provider when set", () => {
    writeFileSync(
      cfg,
      "model:\n  provider: openai-codex\nmemory:\n  provider: mem0\n",
    );
    expect(getActiveMemoryProvider()).toBe("mem0");
  });

  it("returns empty for a deactivated provider written as an empty string", () => {
    writeFileSync(cfg, 'memory:\n  provider: ""\n');
    expect(getActiveMemoryProvider()).toBe("");
  });

  it("returns empty when there is no config file", () => {
    rmSync(cfg, { force: true });
    expect(getActiveMemoryProvider()).toBe("");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/active-memory-provider.test.ts`
Expected: FAIL — the first test gets `"xai"`, expected `""`.

- [x] **Step 3: Write the implementation**

In `src/main/installer.ts`, add `import { getYamlPath } from "./yaml-path";` next to the other local imports (around line 19-23) if absent, then replace the body of `getActiveMemoryProvider`:

```ts
/**
 * The memory provider from `memory.provider` in the profile's config.yaml.
 *
 * Reads the dotted path rather than scanning for any `provider:` line — the old
 * regex matched an unrelated `provider:` elsewhere in the file and reported the
 * *model* provider ("xai") as the memory provider on real configs.
 */
export function getActiveMemoryProvider(profile?: string): string {
  try {
    const configPath = join(profileHome(profile), "config.yaml");
    if (!existsSync(configPath)) return "";
    const content = readFileSync(configPath, "utf-8");
    return (getYamlPath(content, "memory.provider") ?? "").trim();
  } catch {
    return "";
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/active-memory-provider.test.ts && npm run typecheck:node`
Expected: PASS, 4 tests; typecheck clean.

- [x] **Step 5: Commit**

```bash
git add src/main/installer.ts src/main/active-memory-provider.test.ts docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "fix(memory): read memory.provider instead of any provider: line"
```

---

### Task 4: Per-profile session reader

**Files:**

- Create: `src/main/memory-session.ts`
- Test: `src/main/memory-session.test.ts`

**Interfaces:**

- Consumes: `profileHome` from `./utils`.
- Produces, and Tasks 5 and 6 depend on these exact names:
  - `SessionMemory` = `{ totalSessions: number; totalMessages: number; lastSessionAt: number | null; available: boolean }`
  - `readSessionMemory(profile?: string): SessionMemory`
- The real `sessions` table has `started_at REAL NOT NULL` (unix seconds, possibly fractional); `lastSessionAt` is floored to whole seconds.

- [x] **Step 1: Write the failing test**

```ts
// src/main/memory-session.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";

const home = mkdtempSync(join(tmpdir(), "hermes-sess-"));
process.env.HERMES_HOME = home;

function seed(
  dbPath: string,
  sessions: number,
  messages: number,
  last: number,
): void {
  const db = new Database(dbPath);
  // Mirrors the columns the reader touches in the agent's real schema.
  db.exec("CREATE TABLE sessions (id TEXT PRIMARY KEY, started_at REAL NOT NULL)");
  db.exec("CREATE TABLE messages (id INTEGER PRIMARY KEY)");
  for (let i = 0; i < sessions; i++)
    db.prepare("INSERT INTO sessions VALUES (?, ?)").run(`s${i}`, last - i + 0.5);
  for (let i = 0; i < messages; i++)
    db.prepare("INSERT INTO messages VALUES (?)").run(i);
  db.close();
}

let readSessionMemory: (p?: string) => {
  totalSessions: number;
  totalMessages: number;
  lastSessionAt: number | null;
  available: boolean;
};

beforeAll(async () => {
  seed(join(home, "state.db"), 2, 5, 1000);
  mkdirSync(join(home, "profiles", "myrtle"), { recursive: true });
  seed(join(home, "profiles", "myrtle", "state.db"), 7, 40, 9999);
  ({ readSessionMemory } = await import("./memory-session"));
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("readSessionMemory", () => {
  it("reads the default profile and floors the newest start time", () => {
    expect(readSessionMemory()).toEqual({
      totalSessions: 2,
      totalMessages: 5,
      lastSessionAt: 1000,
      available: true,
    });
  });

  it("reads a NAMED profile, not the active one", () => {
    const r = readSessionMemory("myrtle");
    expect(r.totalSessions).toBe(7);
    expect(r.totalMessages).toBe(40);
    expect(r.lastSessionAt).toBe(9999);
  });

  it("reports unavailable when the profile has no state.db", () => {
    expect(readSessionMemory("web-wizard-agent")).toEqual({
      totalSessions: 0,
      totalMessages: 0,
      lastSessionAt: null,
      available: false,
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/memory-session.test.ts`
Expected: FAIL — cannot resolve `./memory-session`.

- [x] **Step 3: Write the implementation**

```ts
// src/main/memory-session.ts
import { existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { profileHome } from "./utils";

export interface SessionMemory {
  totalSessions: number;
  totalMessages: number;
  /** Unix seconds of the most recent session start, or null. */
  lastSessionAt: number | null;
  /** state.db exists and could be read. */
  available: boolean;
}

export const UNAVAILABLE_SESSIONS: SessionMemory = {
  totalSessions: 0,
  totalMessages: 0,
  lastSessionAt: null,
  available: false,
};

/**
 * Session-search memory for one profile — the read-only layer the agent
 * searches with FTS5.
 *
 * Deliberately NOT routed through `getDbConnection()`: that resolves
 * `activeStateDbPath()` and caches a single connection, so it can only ever
 * serve the active profile. A short-lived read-only handle, closed in
 * `finally`, lets the overview read every agent without disturbing that cache.
 */
export function readSessionMemory(profile?: string): SessionMemory {
  const dbPath = join(profileHome(profile), "state.db");
  if (!existsSync(dbPath)) return UNAVAILABLE_SESSIONS;

  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    const row = db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM sessions) AS s, " +
          "(SELECT COUNT(*) FROM messages) AS m, " +
          "(SELECT MAX(started_at) FROM sessions) AS t",
      )
      .get() as { s: number; m: number; t: number | null } | undefined;
    return {
      totalSessions: row?.s ?? 0,
      totalMessages: row?.m ?? 0,
      lastSessionAt: row?.t != null ? Math.floor(row.t) : null,
      available: true,
    };
  } catch (err) {
    console.error("[memory] readSessionMemory failed:", err);
    return UNAVAILABLE_SESSIONS;
  } finally {
    db?.close();
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/memory-session.test.ts`
Expected: PASS, 3 tests.

- [x] **Step 5: Commit**

```bash
git add src/main/memory-session.ts src/main/memory-session.test.ts docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "feat(memory): per-profile session reader that bypasses the active-profile cache"
```

---

### Task 5: Five-system `MemoryInfo` contract and its consumers

**Files:**

- Modify: `src/main/memory.ts` (`MemoryInfo`, `readMemory`; delete `getSessionStats`)
- Modify: `src/main/ssh-remote.ts:475-534` (`sshGetSessionStats`, `sshReadMemory`)
- Modify: `src/preload/index.ts:1027-1033`, `src/preload/index.d.ts:745-749`
- Modify: `src/renderer/src/screens/Memory/types.ts`
- Modify: `src/renderer/src/screens/Memory/Memory.tsx:6,64` (remove `CapacityCards`)
- Modify: `src/renderer/src/screens/Chat/hooks/useLocalCommands.ts:63-77`
- Modify: `src/shared/i18n/locales/en/memory.ts`
- Modify: `src/renderer/src/assets/main.css:14237-14265`
- Modify: `src/renderer/src/components/profile/ProfileModal.test.tsx:87`
- Delete: `src/renderer/src/screens/Memory/CapacityCards.tsx`
- Test: `src/main/memory-contract.test.ts`

**Interfaces:**

- Consumes: `readSessionMemory`/`SessionMemory` (Task 4), `getActiveMemoryProvider` (Task 3), `discoverMemoryProviders` from `./installer`, `readEnv(profile?: string): Record<string, string>` from `./config`.
- Produces, and Tasks 6–11 depend on this shape:

```ts
export interface ProviderMemory { active: string | null; installed: boolean }
export interface VaultMemory { path: string | null; exists: boolean }
export interface MemoryInfo {
  memory: { content; exists; lastModified; entries; charCount; charLimit }; // unchanged
  user: { content; exists; lastModified; charCount; charLimit };           // unchanged
  sessions: SessionMemory;
  provider: ProviderMemory;
  vault: VaultMemory;
}
```

`stats` is gone. The renderer's `MemoryData` mirrors this exactly.

- [x] **Step 1: Write the failing test**

```ts
// src/main/memory-contract.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const home = mkdtempSync(join(tmpdir(), "hermes-contract-"));
process.env.HERMES_HOME = home;

let readMemory: (p?: string) => import("./memory").MemoryInfo;
beforeAll(async () => {
  mkdirSync(join(home, "memories"), { recursive: true });
  writeFileSync(join(home, "memories", "MEMORY.md"), "a\n§\nb");
  writeFileSync(join(home, "config.yaml"), "memory:\n  provider: mem0\n");
  ({ readMemory } = await import("./memory"));
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("readMemory contract", () => {
  it("returns all five systems", () => {
    const d = readMemory();
    expect(d.memory.entries).toHaveLength(2);
    expect(d.user.exists).toBe(false); // USER.md absent is an empty state
    expect(d.sessions.available).toBe(false); // no state.db in this scratch home
    expect(d.provider.active).toBe("mem0");
    expect(typeof d.provider.installed).toBe("boolean");
    expect(d.vault).toEqual({ path: null, exists: false });
  });

  it("coerces a deactivated provider to null, not an empty string", () => {
    writeFileSync(join(home, "config.yaml"), 'memory:\n  provider: ""\n');
    expect(readMemory().provider).toEqual({ active: null, installed: false });
  });

  it("no longer exposes stats", () => {
    expect((readMemory() as Record<string, unknown>).stats).toBeUndefined();
  });

  it("survives a profile with no memories directory", () => {
    const d = readMemory("web-wizard-agent");
    expect(d.memory.entries).toEqual([]);
    expect(d.memory.exists).toBe(false);
    expect(d.sessions.available).toBe(false);
    expect(d.vault).toEqual({ path: null, exists: false });
  });

  it("reads the vault path from the profile .env and checks the folder", () => {
    const phome = join(home, "profiles", "vaulted");
    mkdirSync(phome, { recursive: true });
    const vault = join(phome, "vault");
    writeFileSync(join(phome, ".env"), `OBSIDIAN_VAULT_PATH=${vault}\n`);
    expect(readMemory("vaulted").vault).toEqual({ path: vault, exists: false });
    mkdirSync(vault);
    expect(readMemory("vaulted").vault).toEqual({ path: vault, exists: true });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/memory-contract.test.ts`
Expected: FAIL — `d.sessions` is undefined.

- [x] **Step 3: Extend `MemoryInfo` and `readMemory` in `src/main/memory.ts`**

Delete `getSessionStats` (lines 91-119) and the `import Database from "better-sqlite3";` line. Add these imports:

```ts
import { readSessionMemory, type SessionMemory } from "./memory-session";
import { getActiveMemoryProvider, discoverMemoryProviders } from "./installer";
import { readEnv } from "./config";
```

Replace the `MemoryInfo` interface (keep `memory` and `user` exactly as they are) so it ends with:

```ts
export interface ProviderMemory {
  /** memory.provider from config.yaml, or null when built-in only. */
  active: string | null;
  /** The active provider's plugin is present in this installation. */
  installed: boolean;
}

export interface VaultMemory {
  /** OBSIDIAN_VAULT_PATH from the profile .env, or null when unset. */
  path: string | null;
  /** That directory exists on this machine. */
  exists: boolean;
}

export interface MemoryInfo {
  memory: {
    content: string;
    exists: boolean;
    lastModified: number | null;
    entries: MemoryEntry[];
    charCount: number;
    charLimit: number;
  };
  user: {
    content: string;
    exists: boolean;
    lastModified: number | null;
    charCount: number;
    charLimit: number;
  };
  sessions: SessionMemory;
  provider: ProviderMemory;
  vault: VaultMemory;
}
```

Add these two readers above `readMemory`:

```ts
function readProviderMemory(profile?: string): ProviderMemory {
  try {
    // `|| null` matters: MemoryProviders.handleDeactivate writes
    // `memory.provider: ""`, and `"" ?? fallback` would render an empty string.
    const active = getActiveMemoryProvider(profile) || null;
    if (!active) return { active: null, installed: false };
    const installed = discoverMemoryProviders(profile).some(
      (p) => p.name === active,
    );
    return { active, installed };
  } catch {
    return { active: null, installed: false };
  }
}

/**
 * The Obsidian vault is not a memory provider; it is a folder the agent's
 * bundled note-taking skill reads and writes, located by OBSIDIAN_VAULT_PATH
 * in the profile .env. The desktop only ever writes that path.
 */
function readVaultMemory(profile?: string): VaultMemory {
  try {
    const path = (readEnv(profile).OBSIDIAN_VAULT_PATH ?? "").trim() || null;
    return { path, exists: !!path && existsSync(path) };
  } catch {
    return { path: null, exists: false };
  }
}
```

In `readMemory`, replace `stats: getSessionStats(profile),` with:

```ts
    sessions: readSessionMemory(profile),
    provider: readProviderMemory(profile),
    vault: readVaultMemory(profile),
```

- [x] **Step 4: Run the contract test**

Run: `npx vitest run src/main/memory-contract.test.ts`
Expected: PASS, 5 tests. If the vault test fails because `readEnv` returned a cached empty map, the `.env` was read before it was written — the test writes it first, so check the order rather than adding cache-busting.

- [x] **Step 5: Mirror the shape over SSH**

In `src/main/ssh-remote.ts`, change the `sshGetSessionStats` return type and script (lines 475-503) to:

```ts
async function sshGetSessionStats(
  config: SshConfig,
  profile?: string,
): Promise<SessionMemory> {
  const script = `
import sqlite3, json, os, sys
payload = json.load(sys.stdin)
profile = payload.get("profile")
db = os.path.expanduser(f"~/.hermes/profiles/{profile}/state.db" if profile and profile != "default" else "~/.hermes/state.db")
unavailable = {"totalSessions": 0, "totalMessages": 0, "lastSessionAt": None, "available": False}
if not os.path.exists(db):
    print(json.dumps(unavailable))
    sys.exit(0)
conn = sqlite3.connect(db)
try:
    s = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    m = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
    last = conn.execute("SELECT MAX(started_at) FROM sessions").fetchone()[0]
    print(json.dumps({"totalSessions": s, "totalMessages": m, "lastSessionAt": int(last) if last else None, "available": True}))
except Exception:
    print(json.dumps(unavailable))
finally:
    conn.close()
`;
  try {
    const out = await sshPython(config, script, pythonJsonInput({ profile }));
    return JSON.parse(out.trim());
  } catch {
    return {
      totalSessions: 0,
      totalMessages: 0,
      lastSessionAt: null,
      available: false,
    };
  }
}

async function sshDirExists(config: SshConfig, path: string): Promise<boolean> {
  const script = `
import json, os, sys
payload = json.load(sys.stdin)
print(json.dumps({"exists": os.path.isdir(os.path.expanduser(payload.get("path", "")))}))
`;
  try {
    const out = await sshPython(config, script, pythonJsonInput({ path }));
    return Boolean(JSON.parse(out.trim()).exists);
  } catch {
    return false;
  }
}
```

Add `import type { SessionMemory } from "./memory-session";` beside the other type imports. Then in `sshReadMemory`, read the env alongside the other four and replace the `stats,` line:

```ts
  const [memContent, userContent, sessions, limits, env, memoryProvider] =
    await Promise.all([
      sshReadFile(config, remoteMemoryPath(profile)),
      sshReadFile(config, remoteUserPath(profile)),
      sshGetSessionStats(config, profile),
      sshReadMemoryLimits(config, profile),
      sshReadEnv(config, profile),
      // ssh-remote.ts does not import getYamlPath (it has its own
      // locateInYaml); use the existing remote config reader.
      sshGetConfigValue(config, "memory.provider", profile),
    ]);
  const vaultPath = (env.OBSIDIAN_VAULT_PATH ?? "").trim() || null;

  return {
    memory: {
      content: memContent,
      exists: memContent.length > 0,
      lastModified: null,
      entries: parseMemoryEntries(memContent),
      charCount: memContent.length,
      charLimit: limits.memoryCharLimit,
    },
    user: {
      content: userContent,
      exists: userContent.length > 0,
      lastModified: null,
      charCount: userContent.length,
      charLimit: limits.userCharLimit,
    },
    sessions,
    provider: {
      active: (memoryProvider ?? "").trim() || null,
      // Checking the remote plugin directory is not cheaply available; the
      // provider row shows the active name without an installed warning.
      installed: true,
    },
    vault: {
      path: vaultPath,
      exists: vaultPath ? await sshDirExists(config, vaultPath) : false,
    },
  };
```

- [x] **Step 6: Mirror the shape in preload and renderer types**

In `src/preload/index.ts`, replace the `readMemory` entry with:

```ts
  readMemory: (
    profile?: string,
  ): Promise<{
    memory: {
      content: string;
      exists: boolean;
      lastModified: number | null;
      entries: { index: number; content: string }[];
      charCount: number;
      charLimit: number;
    };
    user: {
      content: string;
      exists: boolean;
      lastModified: number | null;
      charCount: number;
      charLimit: number;
    };
    sessions: {
      totalSessions: number;
      totalMessages: number;
      lastSessionAt: number | null;
      available: boolean;
    };
    provider: { active: string | null; installed: boolean };
    vault: { path: string | null; exists: boolean };
  }> => ipcRenderer.invoke("read-memory", profile),
```

In `src/preload/index.d.ts`, replace the `readMemory` declaration with the same object type using `=> Promise<{ ... }>` syntax.

Replace the whole of `src/renderer/src/screens/Memory/types.ts` with:

```ts
export interface MemoryEntry {
  index: number;
  content: string;
}

/** Mirrors `MemoryInfo` in src/main/memory.ts. */
export interface MemoryData {
  memory: {
    content: string;
    exists: boolean;
    lastModified: number | null;
    entries: MemoryEntry[];
    charCount: number;
    charLimit: number;
  };
  user: {
    content: string;
    exists: boolean;
    lastModified: number | null;
    charCount: number;
    charLimit: number;
  };
  sessions: {
    totalSessions: number;
    totalMessages: number;
    lastSessionAt: number | null;
    available: boolean;
  };
  provider: { active: string | null; installed: boolean };
  vault: { path: string | null; exists: boolean };
}

export interface MemoryProviderInfo {
  name: string;
  description: string;
  installed: boolean;
  active: boolean;
  envVars: string[];
}

export type MemoryTab = "entries" | "profile" | "providers" | "soul";
```

- [x] **Step 7: Remove the two `stats` readers**

Delete `src/renderer/src/screens/Memory/CapacityCards.tsx` (`git rm`). In `src/renderer/src/screens/Memory/Memory.tsx` delete line 6 (`import { CapacityCards } from "./CapacityCards";`) and line 64 (`<CapacityCards data={data} />`). Task 10 rewrites this file; a screen without summary cards in between is fine.

In `src/renderer/src/assets/main.css` delete the four rules `.memory-capacity-grid`, `.memory-capacity-card`, `.memory-capacity-card-header`, `.memory-capacity-card-footer` (lines 14237-14265). Keep `.memory-capacity`, `.memory-capacity-header`, `.memory-capacity-label`, `.memory-capacity-value`, `.memory-capacity-track`, `.memory-capacity-fill` — `CapacityBar` uses them.

In `src/renderer/src/screens/Chat/hooks/useLocalCommands.ts`, replace the `/memory` case body (lines 63-77) with:

```ts
        case "/memory": {
          const mem = await window.hermesAPI.readMemory(profile);
          const lines: string[] = ["**Agent Memory**\n"];
          if (mem.memory.exists && mem.memory.content.trim()) {
            lines.push(mem.memory.content.trim());
          } else {
            lines.push(t("memory.noMemoryEntries"));
          }
          lines.push(
            `\n**User Profile:** ${mem.user.charCount}/${mem.user.charLimit} chars`,
          );
          lines.push(
            mem.sessions.available
              ? `**Session Search:** ${mem.sessions.totalSessions} sessions, ${mem.sessions.totalMessages} messages`
              : `**Session Search:** ${t("memory.sessionsUnavailable")}`,
          );
          lines.push(
            `**Provider:** ${mem.provider.active ?? t("memory.providerBuiltIn")}`,
          );
          lines.push(
            `**Obsidian Vault:** ${mem.vault.path ?? t("memory.vaultNotLinked")}`,
          );
          addAgentMessage(lines.join("\n"));
          return true;
        }
```

In `src/shared/i18n/locales/en/memory.ts`, add inside the default export, before `providers: {`:

```ts
  sessionsUnavailable: "No sessions recorded yet",
  providerBuiltIn: "Built-in only",
  vaultNotLinked: "Not linked",
```

In `src/renderer/src/components/profile/ProfileModal.test.tsx:87`, replace `readMemory: vi.fn().mockResolvedValue({ entries: [] }),` with the real shape:

```ts
      readMemory: vi.fn().mockResolvedValue({
        memory: {
          content: "",
          exists: false,
          lastModified: null,
          entries: [],
          charCount: 0,
          charLimit: 2200,
        },
        user: {
          content: "",
          exists: false,
          lastModified: null,
          charCount: 0,
          charLimit: 1375,
        },
        sessions: {
          totalSessions: 0,
          totalMessages: 0,
          lastSessionAt: null,
          available: false,
        },
        provider: { active: null, installed: false },
        vault: { path: null, exists: false },
      }),
```

- [x] **Step 8: Typecheck and run the affected tests**

Run: `npm run typecheck && npx vitest run src/main/memory-contract.test.ts src/renderer/src/components/profile/`
Expected: typecheck clean; all PASS.

- [x] **Step 9: Commit**

```bash
git add src/main/memory.ts src/main/memory-contract.test.ts src/main/ssh-remote.ts src/preload/index.ts src/preload/index.d.ts src/renderer/src/screens/Memory/types.ts src/renderer/src/screens/Memory/Memory.tsx src/renderer/src/screens/Chat/hooks/useLocalCommands.ts src/shared/i18n/locales/en/memory.ts src/renderer/src/assets/main.css src/renderer/src/components/profile/ProfileModal.test.tsx docs/superpowers/plans/2026-09-02-memory-per-agent.md
git rm src/renderer/src/screens/Memory/CapacityCards.tsx
git commit -m "feat(memory): expand MemoryInfo to five systems, drop stats"
```

---

### Task 6: Cross-agent memory summary reader and IPC

**Files:**

- Create: `src/main/agents-memory.ts`
- Modify: `src/main/ipc/register.ts` (memory IPC block, after `read-memory` at ~line 2368)
- Modify: `src/preload/index.ts`, `src/preload/index.d.ts` (after `readMemory`)
- Modify: `src/renderer/src/screens/Memory/types.ts` (append)
- Test: `src/main/agents-memory.test.ts`

**Interfaces:**

- Consumes: `readMemory`/`MemoryInfo` (Task 5), `listProfiles` from `./profiles` (**async**), `sshListProfiles`/`sshReadMemory` from `./ssh-remote` (`SshProfileInfo` has `name` but no `id`).
- Produces, and Task 10 depends on these:

```ts
export interface AgentMemoryBase {
  id: string; name: string; isActive: boolean; color?: string; avatar?: string | null;
}
export interface AgentMemorySummary extends AgentMemoryBase {
  memoryChars: number; memoryLimit: number; memoryEntries: number;
  userChars: number; userLimit: number;
  totalSessions: number; lastSessionAt: number | null;
  provider: string | null; vaultLinked: boolean;
  available: boolean;
}
export function summariseAgentMemory(base: AgentMemoryBase, m: MemoryInfo): AgentMemorySummary
export function unavailableAgentMemory(base: AgentMemoryBase): AgentMemorySummary
export async function readAllAgentsMemory(): Promise<AgentMemorySummary[]>
```

exposed as `window.hermesAPI.readAllAgentsMemory(): Promise<AgentMemorySummary[]>`.

- [x] **Step 1: Write the failing test**

```ts
// src/main/agents-memory.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./profiles", () => ({
  // Mirrors the real async signature — a sync mock lets a broken impl pass.
  listProfiles: vi.fn(async () => [
    { id: "default", name: "Hermes One", isActive: true, color: "#123456" },
    { id: "myrtle", name: "Myrtle", isActive: false },
  ]),
}));

vi.mock("./memory", () => ({
  readMemory: vi.fn((profile?: string) => {
    if (profile === "myrtle") throw new Error("unreadable");
    return {
      memory: {
        charCount: 512,
        charLimit: 2200,
        entries: [{ index: 0, content: "a" }],
      },
      user: { charCount: 1363, charLimit: 1375 },
      sessions: {
        totalSessions: 22,
        totalMessages: 1278,
        lastSessionAt: 99,
        available: true,
      },
      provider: { active: "mem0", installed: true },
      vault: { path: "/v", exists: true },
    };
  }),
}));

import { readAllAgentsMemory } from "./agents-memory";

beforeEach(() => vi.clearAllMocks());

describe("readAllAgentsMemory", () => {
  it("returns one summary per profile", async () => {
    expect(await readAllAgentsMemory()).toHaveLength(2);
  });

  it("summarises a readable agent", async () => {
    const d = (await readAllAgentsMemory())[0];
    expect(d).toMatchObject({
      id: "default",
      name: "Hermes One",
      isActive: true,
      color: "#123456",
      memoryChars: 512,
      memoryLimit: 2200,
      memoryEntries: 1,
      userChars: 1363,
      userLimit: 1375,
      totalSessions: 22,
      lastSessionAt: 99,
      provider: "mem0",
      vaultLinked: true,
      available: true,
    });
  });

  it("marks an unreadable agent unavailable instead of throwing", async () => {
    const d = (await readAllAgentsMemory())[1];
    expect(d.id).toBe("myrtle");
    expect(d.available).toBe(false);
    expect(d.memoryChars).toBe(0);
    expect(d.vaultLinked).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/agents-memory.test.ts`
Expected: FAIL — cannot resolve `./agents-memory`.

- [x] **Step 3: Write the implementation**

```ts
// src/main/agents-memory.ts
import { listProfiles } from "./profiles";
import { readMemory, type MemoryInfo } from "./memory";

/** Identity fields copied from the profile list. */
export interface AgentMemoryBase {
  id: string;
  name: string;
  isActive: boolean;
  color?: string;
  avatar?: string | null;
}

export interface AgentMemorySummary extends AgentMemoryBase {
  memoryChars: number;
  memoryLimit: number;
  memoryEntries: number;
  userChars: number;
  userLimit: number;
  totalSessions: number;
  lastSessionAt: number | null;
  provider: string | null;
  vaultLinked: boolean;
  /** False when this agent's stores could not be read at all. */
  available: boolean;
}

/** Reduce a full MemoryInfo to the overview row. Shared with the SSH branch. */
export function summariseAgentMemory(
  base: AgentMemoryBase,
  m: MemoryInfo,
): AgentMemorySummary {
  return {
    ...base,
    memoryChars: m.memory.charCount,
    memoryLimit: m.memory.charLimit,
    memoryEntries: m.memory.entries.length,
    userChars: m.user.charCount,
    userLimit: m.user.charLimit,
    totalSessions: m.sessions.totalSessions,
    lastSessionAt: m.sessions.lastSessionAt,
    provider: m.provider.active,
    vaultLinked: m.vault.path !== null,
    available: true,
  };
}

export function unavailableAgentMemory(
  base: AgentMemoryBase,
): AgentMemorySummary {
  return {
    ...base,
    memoryChars: 0,
    memoryLimit: 0,
    memoryEntries: 0,
    userChars: 0,
    userLimit: 0,
    totalSessions: 0,
    lastSessionAt: null,
    provider: null,
    vaultLinked: false,
    available: false,
  };
}

/**
 * One memory summary per agent, for the cross-agent overview.
 *
 * One unreadable agent must not blank the list, so each read is isolated and
 * degrades to an unavailable row.
 */
export async function readAllAgentsMemory(): Promise<AgentMemorySummary[]> {
  const profiles = await listProfiles();
  return profiles.map((p) => {
    const base: AgentMemoryBase = {
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      color: p.color,
      avatar: p.avatar,
    };
    try {
      return summariseAgentMemory(base, readMemory(p.id));
    } catch (err) {
      console.error(`[memory] summary failed for ${p.id}:`, err);
      return unavailableAgentMemory(base);
    }
  });
}
```

If `ProfileInfo` in `src/main/profiles.ts` does not declare `color`/`avatar`, check what `listProfiles` actually returns (it is what `ProfileModal.tsx:30-45` mirrors, which has both) and adapt the two field reads to the real names; do not add fields to `ProfileInfo` for this.

- [x] **Step 4: Register the IPC, SSH-aware**

In `src/main/ipc/register.ts`, add to the imports:

```ts
import {
  readAllAgentsMemory,
  summariseAgentMemory,
  unavailableAgentMemory,
} from "../agents-memory";
```

`sshListProfiles` and `sshReadMemory` are already imported (the `list-profiles` and `read-memory` handlers use them). Directly after the `read-memory` handler add:

```ts
  ipcMain.handle("read-all-agents-memory", async () => {
    const conn = getConnectionConfig();
    if (conn.mode === "ssh" && conn.ssh) {
      // list-profiles and read-memory are both already SSH-aware. A local-only
      // summary would list LOCAL agents while drilling into REMOTE memory.
      const remote = conn.ssh;
      const profiles = await sshListProfiles(remote);
      return Promise.all(
        profiles.map(async (p) => {
          // SshProfileInfo has no id; its name is the directory slug.
          const base = { id: p.name, name: p.name, isActive: p.isActive };
          try {
            return summariseAgentMemory(base, await sshReadMemory(remote, p.name));
          } catch {
            return unavailableAgentMemory(base);
          }
        }),
      );
    }
    return readAllAgentsMemory();
  });
```

- [x] **Step 5: Expose it in preload and the renderer types**

In `src/preload/index.ts`, directly after the `readMemory` entry:

```ts
  readAllAgentsMemory: (): Promise<
    Array<{
      id: string;
      name: string;
      isActive: boolean;
      color?: string;
      avatar?: string | null;
      memoryChars: number;
      memoryLimit: number;
      memoryEntries: number;
      userChars: number;
      userLimit: number;
      totalSessions: number;
      lastSessionAt: number | null;
      provider: string | null;
      vaultLinked: boolean;
      available: boolean;
    }>
  > => ipcRenderer.invoke("read-all-agents-memory"),
```

Mirror the same signature in `src/preload/index.d.ts` after `readMemory`.

Append to `src/renderer/src/screens/Memory/types.ts`:

```ts
/** Mirrors `AgentMemorySummary` in src/main/agents-memory.ts. */
export interface AgentMemorySummary {
  id: string;
  name: string;
  isActive: boolean;
  color?: string;
  avatar?: string | null;
  memoryChars: number;
  memoryLimit: number;
  memoryEntries: number;
  userChars: number;
  userLimit: number;
  totalSessions: number;
  lastSessionAt: number | null;
  provider: string | null;
  vaultLinked: boolean;
  available: boolean;
}
```

- [x] **Step 6: Run test and typecheck**

Run: `npx vitest run src/main/agents-memory.test.ts && npm run typecheck`
Expected: PASS, 3 tests; typecheck clean.

- [x] **Step 7: Commit**

```bash
git add src/main/agents-memory.ts src/main/agents-memory.test.ts src/main/ipc/register.ts src/preload/index.ts src/preload/index.d.ts src/renderer/src/screens/Memory/types.ts docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "feat(memory): cross-agent memory summary reader and IPC"
```

---

### Task 7: Systems inventory, vault pane, capacity tone, styles

**Files:**

- Modify: `src/renderer/src/screens/Memory/CapacityBar.tsx`
- Create: `src/renderer/src/screens/Memory/MemoryVault.tsx`
- Create: `src/renderer/src/screens/Memory/MemorySystems.tsx`
- Modify: `src/shared/i18n/locales/en/memory.ts`
- Modify: `src/renderer/src/assets/main.css` (append after `.memory-soul-tab .soul-container`, ~line 14590)
- Modify: `src/main/config.ts` (after `setEnvValue`, ~line 286), `src/main/ssh-remote.ts` (after `sshSetEnvValue`, ~line 1092), `src/main/ipc/register.ts` (after the `set-env` handler, ~line 1030), `src/preload/index.ts:256`, `src/preload/index.d.ts` (beside `setEnv`)
- Test: `src/main/remove-env.test.ts`, `src/renderer/src/screens/Memory/MemoryVault.test.tsx`, `src/renderer/src/screens/Memory/MemorySystems.test.tsx`

**Interfaces:**

- Consumes: `MemoryData`, `MemoryProviderInfo` (Task 5), existing `MemoryEntries`, `MemoryProfile`, `MemoryProviders`; `window.hermesAPI.selectFolder(): Promise<string | null>` and `setEnv(key, value, profile): Promise<boolean>` (both exist); `formatDistanceToNowStrict` from `date-fns` (already a dependency, used in `MessageRow.tsx`).
- Produces in the main process: `removeEnvValue(key: string, profile?: string): void` in `config.ts`, `sshRemoveEnvValue(config, key, profile?)` in `ssh-remote.ts`, IPC `remove-env`, and `window.hermesAPI.removeEnv(key: string, profile?: string): Promise<boolean>`. The env layer has a setter and no remover; unlinking the vault must delete the line, not leave a blank `OBSIDIAN_VAULT_PATH=` for the agent's skill to misread.
- Produces, and Task 9 depends on these:
  - `<MemorySystems data={MemoryData} profile={string | undefined} providers={MemoryProviderInfo[]} onRefresh={() => void} />` — `providers` is required.
  - `<MemoryVault path={string | null} exists={boolean} profile={string | undefined} onRefresh={() => void} />`
  - `CapacityBar` gains `tone?: "ramp" | "neutral"` (default `"ramp"`) and renders 0% when `limit` is 0.
- The overview (Task 10) does **not** mount `MemorySystems`; it renders its own compact rows. There is no `readOnly` prop anywhere.

- [ ] **Step 1: Add the strings**

In `src/shared/i18n/locales/en/memory.ts`, add inside the default export, directly after the three keys Task 5 added (`sessionsUnavailable`, `providerBuiltIn`, `vaultNotLinked`) and before `providers: {`:

```ts
  systemsTitle: "Memory systems",
  editable: "Editable",
  readOnly: "Read-only",
  configurable: "Configurable",
  atCapacity: "At capacity — the agent consolidates on the next write",
  nextSessionNote: "Takes effect in this agent's next session.",
  sessionSearch: "Session Search",
  sessionSearchDesc:
    "Every past conversation, searchable. Written automatically by the agent.",
  sessionSearchHint: "Search past conversations from the Sessions screen.",
  agentMemoryDesc: "Curated notes the agent keeps about your environment.",
  userProfileDesc: "Who you are — name, role, preferences.",
  providerDesc:
    "An external memory backend, running alongside built-in memory.",
  providerNotInstalled: "not installed",
  sessionsAndMessages: "{{sessions}} sessions · {{messages}} messages",
  lastActive: "active {{when}}",
  vaultTitle: "Obsidian Vault",
  vaultDesc:
    "A notes folder the agent reads and writes through its Obsidian skill.",
  vaultHint:
    "Choose the folder of an Obsidian vault. The agent's note-taking skill will read, search and edit notes there.",
  vaultLinked: "Vault linked",
  vaultMissing: "folder not found",
  vaultChoose: "Choose folder…",
  vaultClear: "Unlink",
```

- [ ] **Step 2: Give `CapacityBar` a neutral tone and a zero-limit guard**

Replace the whole of `src/renderer/src/screens/Memory/CapacityBar.tsx` with:

```tsx
interface CapacityBarProps {
  used: number;
  limit: number;
  label: string;
  /**
   * "neutral" suppresses the error/warning colour ramp: a bounded curated
   * store at capacity is its normal steady state — the agent consolidates on
   * the next write — so it must not read as a fault. Default keeps today's
   * ramp for other callers.
   */
  tone?: "ramp" | "neutral";
}

export function CapacityBar({
  used,
  limit,
  label,
  tone = "ramp",
}: CapacityBarProps): React.JSX.Element {
  // limit is 0 for an agent whose stores could not be read; avoid NaN%.
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color =
    tone === "neutral"
      ? "var(--accent)"
      : pct > 90
        ? "var(--error)"
        : pct > 70
          ? "var(--warning)"
          : "var(--success)";
  return (
    <div className="memory-capacity">
      <div className="memory-capacity-header">
        {label && <span className="memory-capacity-label">{label}</span>}
        <span className="memory-capacity-value">
          {used.toLocaleString()} / {limit.toLocaleString()} chars ({pct}%)
        </span>
      </div>
      <div className="memory-capacity-track">
        <div
          className="memory-capacity-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the failing env-removal test**

```ts
// src/main/remove-env.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const home = mkdtempSync(join(tmpdir(), "hermes-rmenv-"));
process.env.HERMES_HOME = home;
const envFile = join(home, ".env");
const seed = "A=1\nOBSIDIAN_VAULT_PATH=/v\n# OBSIDIAN_VAULT_PATH=old\nB=2\n";

let mod: typeof import("./config");
beforeAll(async () => {
  mod = await import("./config");
});
beforeEach(() => writeFileSync(envFile, seed));
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("removeEnvValue", () => {
  it("removes the variable's lines (active and commented) and leaves the rest untouched", () => {
    mod.removeEnvValue("OBSIDIAN_VAULT_PATH");
    expect(readFileSync(envFile, "utf-8")).toBe("A=1\nB=2\n");
    expect(mod.readEnv().OBSIDIAN_VAULT_PATH).toBeUndefined();
  });

  it("is a no-op when the variable is absent or the file is missing", () => {
    mod.removeEnvValue("NOPE");
    expect(readFileSync(envFile, "utf-8")).toBe(seed);
    rmSync(envFile);
    expect(() => mod.removeEnvValue("A")).not.toThrow();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/main/remove-env.test.ts`
Expected: FAIL — `mod.removeEnvValue is not a function`.

- [ ] **Step 5: Implement the remover, its SSH twin, the IPC and the preload entry**

In `src/main/config.ts`, directly after `setEnvValue` (ends ~line 286):

```ts
/**
 * Remove a variable from the profile .env entirely — active and commented
 * lines alike, the same lines `setEnvValue` would have replaced. Used when a
 * setting is unlinked rather than changed, so no blank `KEY=` line is left
 * for the agent to misread as a value.
 */
export function removeEnvValue(key: string, profile?: string): void {
  validateEnvEntry(key, "");
  const { envFile } = profilePaths(profile);
  invalidateCache(`env:${profile || "default"}`);
  if (!existsSync(envFile)) return;
  const re = new RegExp(`^#?\\s*${escapeRegex(key)}\\s*=`);
  const lines = readFileSync(envFile, "utf-8").split("\n");
  const kept = lines.filter((line) => !re.test(line.trim()));
  if (kept.length === lines.length) return;
  safeWriteFile(envFile, kept.join("\n"));
}
```

`escapeRegex`, `invalidateCache`, `profilePaths` and `safeWriteFile` are already in scope in that file (all used by `setEnvValue`).

In `src/main/ssh-remote.ts`, directly after `sshSetEnvValue`:

```ts
export async function sshRemoveEnvValue(
  config: SshConfig,
  key: string,
  profile?: string,
): Promise<void> {
  const envPath = remoteEnvPath(profile);
  const content = await sshReadFile(config, envPath);
  const re = new RegExp(`^#?\\s*${escapeRegex(key)}\\s*=`);
  const kept = content.split("\n").filter((line) => !re.test(line.trim()));
  if (kept.length === content.split("\n").length) return;
  await sshWriteFile(config, envPath, kept.join("\n"));
}
```

(`escapeRegex` is declared further down the same file; function declarations hoist.)

In `src/main/ipc/register.ts`, add `removeEnvValue` to the existing `../config` import and `sshRemoveEnvValue` to the `../ssh-remote` import, then directly after the `set-env` handler add:

```ts
  ipcMain.handle(
    "remove-env",
    async (_event, key: string, profile?: string) => {
      const conn = getConnectionConfig();
      if (conn.mode === "ssh" && conn.ssh) {
        await sshRemoveEnvValue(conn.ssh, key, profile);
        return true;
      }
      removeEnvValue(key, profile);
      return true;
    },
  );
```

(`set-env` restarts the gateway only for API-key-shaped names; `OBSIDIAN_VAULT_PATH` never matches, so neither setting nor removing the vault path restarts anything.)

In `src/preload/index.ts`, directly after the `setEnv` entry (line 256-257):

```ts
  removeEnv: (key: string, profile?: string): Promise<boolean> =>
    ipcRenderer.invoke("remove-env", key, profile),
```

and in `src/preload/index.d.ts`, beside the `setEnv` declaration:

```ts
  removeEnv: (key: string, profile?: string) => Promise<boolean>;
```

- [ ] **Step 6: Run it to verify it passes, and typecheck**

Run: `npx vitest run src/main/remove-env.test.ts && npm run typecheck`
Expected: PASS, 2 tests; typecheck clean.

- [ ] **Step 7: Write the failing vault-pane test**

```tsx
// src/renderer/src/screens/Memory/MemoryVault.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryVault } from "./MemoryVault";

// Repo convention (ConfigHealthBanner.test.tsx): t() returns the key.
vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const api = {
  selectFolder: vi.fn(),
  setEnv: vi.fn(),
  removeEnv: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  api.selectFolder.mockResolvedValue("/Users/me/Vault");
  api.setEnv.mockResolvedValue(true);
  api.removeEnv.mockResolvedValue(true);
  (window as unknown as { hermesAPI: unknown }).hermesAPI = api;
});

describe("MemoryVault", () => {
  it("shows Not linked and no unlink button when there is no path", () => {
    render(
      <MemoryVault path={null} exists={false} profile="p" onRefresh={() => {}} />,
    );
    expect(screen.getByTestId("memory-vault-path").textContent).toContain(
      "memory.vaultNotLinked",
    );
    expect(screen.queryByText("memory.vaultClear")).toBeNull();
  });

  it("shows the path and a missing-folder warning when the folder is absent", () => {
    render(
      <MemoryVault
        path="/gone/Vault"
        exists={false}
        profile="p"
        onRefresh={() => {}}
      />,
    );
    const el = screen.getByTestId("memory-vault-path");
    expect(el.textContent).toContain("/gone/Vault");
    expect(el.textContent).toContain("memory.vaultMissing");
  });

  it("choosing a folder writes OBSIDIAN_VAULT_PATH for that agent and refreshes", async () => {
    const onRefresh = vi.fn();
    render(
      <MemoryVault path={null} exists={false} profile="p" onRefresh={onRefresh} />,
    );
    fireEvent.click(screen.getByText("memory.vaultChoose"));
    await waitFor(() =>
      expect(api.setEnv).toHaveBeenCalledWith(
        "OBSIDIAN_VAULT_PATH",
        "/Users/me/Vault",
        "p",
      ),
    );
    expect(onRefresh).toHaveBeenCalled();
  });

  it("does nothing when the folder dialog is cancelled", async () => {
    api.selectFolder.mockResolvedValue(null);
    render(
      <MemoryVault path={null} exists={false} profile="p" onRefresh={() => {}} />,
    );
    fireEvent.click(screen.getByText("memory.vaultChoose"));
    await waitFor(() => expect(api.selectFolder).toHaveBeenCalled());
    expect(api.setEnv).not.toHaveBeenCalled();
  });

  it("unlinking removes the variable from this agent's .env, and refreshes", async () => {
    const onRefresh = vi.fn();
    render(
      <MemoryVault path="/v" exists={true} profile="p" onRefresh={onRefresh} />,
    );
    fireEvent.click(screen.getByText("memory.vaultClear"));
    await waitFor(() =>
      expect(api.removeEnv).toHaveBeenCalledWith("OBSIDIAN_VAULT_PATH", "p"),
    );
    expect(api.setEnv).not.toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `npx vitest run src/renderer/src/screens/Memory/MemoryVault.test.tsx`
Expected: FAIL — cannot resolve `./MemoryVault`.

- [ ] **Step 9: Implement the vault pane**

```tsx
// src/renderer/src/screens/Memory/MemoryVault.tsx
import { useState } from "react";
import { useI18n } from "../../components/useI18n";

interface MemoryVaultProps {
  path: string | null;
  exists: boolean;
  profile?: string;
  onRefresh: () => void;
}

/**
 * Detail pane for the Obsidian vault row. The desktop only ever writes the
 * path (OBSIDIAN_VAULT_PATH in this agent's .env); the agent's note-taking
 * skill reads and writes the notes. Unlinking removes the variable outright
 * so no blank line is left for the skill to misread.
 */
export function MemoryVault({
  path,
  exists,
  profile,
  onRefresh,
}: MemoryVaultProps): React.JSX.Element {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function apply(write: () => Promise<boolean>): Promise<void> {
    setSaving(true);
    setError("");
    try {
      const ok = await write();
      if (!ok) setError(t("memory.saveFailed"));
      onRefresh();
    } catch {
      setError(t("memory.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function choose(): Promise<void> {
    const picked = await window.hermesAPI.selectFolder();
    if (!picked) return;
    await apply(() =>
      window.hermesAPI.setEnv("OBSIDIAN_VAULT_PATH", picked, profile),
    );
  }

  async function unlink(): Promise<void> {
    await apply(() =>
      window.hermesAPI.removeEnv("OBSIDIAN_VAULT_PATH", profile),
    );
  }

  return (
    <div className="memory-vault">
      <p className="memory-vault-hint">{t("memory.vaultHint")}</p>
      {error && <div className="memory-error">{error}</div>}
      <div className="memory-vault-path" data-testid="memory-vault-path">
        <code>{path ?? t("memory.vaultNotLinked")}</code>
        {path && !exists && (
          <span className="memory-system-warn">{t("memory.vaultMissing")}</span>
        )}
      </div>
      <div className="memory-vault-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void choose()}
          disabled={saving}
        >
          {t("memory.vaultChoose")}
        </button>
        {path && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void unlink()}
            disabled={saving}
          >
            {t("memory.vaultClear")}
          </button>
        )}
      </div>
      <div className="memory-system-note">{t("memory.nextSessionNote")}</div>
    </div>
  );
}
```

- [ ] **Step 10: Run the vault test to verify it passes**

Run: `npx vitest run src/renderer/src/screens/Memory/MemoryVault.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 11: Write the failing inventory test**

```tsx
// src/renderer/src/screens/Memory/MemorySystems.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemorySystems } from "./MemorySystems";
import type { MemoryData } from "./types";

// Repo convention (ConfigHealthBanner.test.tsx): t() returns the key, so
// assertions never depend on English copy. Interpolations are appended so a
// test can check the values a string was given.
vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

function data(overrides: Partial<MemoryData> = {}): MemoryData {
  return {
    memory: {
      content: "a",
      exists: true,
      lastModified: null,
      entries: [{ index: 0, content: "a" }],
      charCount: 512,
      charLimit: 2200,
    },
    user: {
      content: "u",
      exists: true,
      lastModified: null,
      charCount: 1363,
      charLimit: 1375,
    },
    sessions: {
      totalSessions: 22,
      totalMessages: 1278,
      lastSessionAt: null,
      available: true,
    },
    provider: { active: null, installed: false },
    vault: { path: null, exists: false },
    ...overrides,
  };
}

function renderSystems(d: MemoryData = data()): void {
  render(
    <MemorySystems data={d} profile="p" providers={[]} onRefresh={() => {}} />,
  );
}

describe("MemorySystems", () => {
  it("lists all five systems", () => {
    renderSystems();
    for (const key of ["memory", "user", "sessions", "provider", "vault"]) {
      expect(screen.getByTestId(`memory-system-${key}`)).toBeTruthy();
    }
  });

  it("badges each system by what you can actually do to it", () => {
    renderSystems();
    const text = (key: string): string =>
      screen.getByTestId(`memory-system-${key}`).textContent ?? "";
    expect(text("memory")).toContain("memory.editable");
    expect(text("user")).toContain("memory.editable");
    // Written entirely by the agent.
    expect(text("sessions")).toContain("memory.readOnly");
    // You choose and configure the backend or folder but cannot read or write
    // its store. "Read-only" beside an Activate button would be a new lie.
    expect(text("provider")).toContain("memory.configurable");
    expect(text("vault")).toContain("memory.configurable");
  });

  it("captions a near-full store as consolidating and does not paint it red", () => {
    renderSystems();
    // user is 1363/1375 = 99%
    const row = screen.getByTestId("memory-system-user");
    expect(row.textContent).toContain("memory.atCapacity");
    // CapacityBar sets the colour inline; assert the real style rather than a
    // class name that does not exist anywhere in main.css.
    const fill = row.querySelector(".memory-capacity-fill") as HTMLElement;
    expect(fill.style.background).not.toContain("--error");
    // Unbounded systems get no bar at all.
    expect(
      screen
        .getByTestId("memory-system-sessions")
        .querySelector(".memory-capacity-fill"),
    ).toBeNull();
  });

  it("shows sessions on Session Search, never on User Profile", () => {
    renderSystems();
    expect(screen.getByTestId("memory-system-sessions").textContent).toContain(
      "memory.sessionsAndMessages:22,1278",
    );
    expect(screen.getByTestId("memory-system-user").textContent).not.toContain(
      "22",
    );
  });

  it("shows last activity when a session time is known, and the empty state when none are recorded", () => {
    renderSystems(
      data({
        sessions: {
          totalSessions: 1,
          totalMessages: 1,
          lastSessionAt: Math.floor(Date.now() / 1000) - 3600,
          available: true,
        },
      }),
    );
    expect(screen.getByTestId("memory-system-sessions").textContent).toContain(
      "memory.lastActive:",
    );
    renderSystems(
      data({
        sessions: {
          totalSessions: 0,
          totalMessages: 0,
          lastSessionAt: null,
          available: false,
        },
      }),
    );
    expect(
      screen.getAllByTestId("memory-system-sessions")[1].textContent,
    ).toContain("memory.sessionsUnavailable");
  });

  it("warns when the active provider's plugin is not installed", () => {
    renderSystems(data({ provider: { active: "mem0", installed: false } }));
    const row = screen.getByTestId("memory-system-provider");
    expect(row.textContent).toContain("mem0");
    expect(row.textContent).toContain("memory.providerNotInstalled");
  });

  it("shows the vault folder name, or Not linked, and warns when the folder is missing", () => {
    renderSystems();
    expect(screen.getByTestId("memory-system-vault").textContent).toContain(
      "memory.vaultNotLinked",
    );
    renderSystems(data({ vault: { path: "/Users/me/My Vault", exists: false } }));
    const row = screen.getAllByTestId("memory-system-vault")[1];
    expect(row.textContent).toContain("My Vault");
    expect(row.textContent).toContain("memory.vaultMissing");
  });

  it("opens Agent Memory by default and toggles details on click", () => {
    renderSystems();
    const memory = screen.getByTestId("memory-system-memory");
    expect(memory.querySelector(".memory-system-detail")).not.toBeNull();
    const sessions = screen.getByTestId("memory-system-sessions");
    expect(sessions.querySelector(".memory-system-detail")).toBeNull();
    fireEvent.click(sessions.querySelector(".memory-system-head")!);
    expect(sessions.querySelector(".memory-system-detail")).not.toBeNull();
    expect(memory.querySelector(".memory-system-detail")).toBeNull();
  });
});
```

- [ ] **Step 12: Run it to verify it fails**

Run: `npx vitest run src/renderer/src/screens/Memory/MemorySystems.test.tsx`
Expected: FAIL — cannot resolve `./MemorySystems`.

- [ ] **Step 13: Implement the inventory**

```tsx
// src/renderer/src/screens/Memory/MemorySystems.tsx
import { useState } from "react";
import { Database, User, Search, Cloud, BookOpen } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useI18n } from "../../components/useI18n";
import { CapacityBar } from "./CapacityBar";
import { MemoryEntries } from "./MemoryEntries";
import { MemoryProfile } from "./MemoryProfile";
import { MemoryProviders } from "./MemoryProviders";
import { MemoryVault } from "./MemoryVault";
import type { MemoryData, MemoryProviderInfo } from "./types";

type SystemKey = "memory" | "user" | "sessions" | "provider" | "vault";

interface MemorySystemsProps {
  data: MemoryData;
  profile?: string;
  /**
   * From discoverMemoryProviders(profile). An empty array makes
   * MemoryProviders render "No memory providers found in this installation",
   * so the caller must fetch these — deliberately required, not optional.
   */
  providers: MemoryProviderInfo[];
  onRefresh: () => void;
}

const NEAR_FULL = 0.9;

/** Last path segment of a vault path, for the row metric. */
function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** "3 hours ago" from unix seconds; "" when the timestamp is unusable. */
export function relativeTime(unixSeconds: number): string {
  try {
    return formatDistanceToNowStrict(unixSeconds * 1000, { addSuffix: true });
  } catch {
    return "";
  }
}

interface SystemRow {
  key: SystemKey;
  Icon: typeof Database;
  label: string;
  desc: string;
  /** What you can actually do to this system, already localised. */
  badge: string;
  /** Bounded stores get a capacity bar and the at-capacity caption. */
  bounded: boolean;
  used: number;
  limit: number;
  metric: React.ReactNode;
  detail: React.ReactNode;
}

export function MemorySystems({
  data,
  profile,
  providers,
  onRefresh,
}: MemorySystemsProps): React.JSX.Element {
  const { t } = useI18n();
  const [open, setOpen] = useState<SystemKey | null>("memory");

  const rows: SystemRow[] = [
    {
      key: "memory",
      Icon: Database,
      label: t("memory.agentMemory"),
      desc: t("memory.agentMemoryDesc"),
      badge: t("memory.editable"),
      bounded: true,
      used: data.memory.charCount,
      limit: data.memory.charLimit,
      metric: (
        <CapacityBar
          used={data.memory.charCount}
          limit={data.memory.charLimit}
          label=""
          tone="neutral"
        />
      ),
      detail: (
        <MemoryEntries
          entries={data.memory.entries}
          profile={profile}
          onRefresh={onRefresh}
        />
      ),
    },
    {
      key: "user",
      Icon: User,
      label: t("memory.userProfile"),
      desc: t("memory.userProfileDesc"),
      badge: t("memory.editable"),
      bounded: true,
      used: data.user.charCount,
      limit: data.user.charLimit,
      metric: (
        <CapacityBar
          used={data.user.charCount}
          limit={data.user.charLimit}
          label=""
          tone="neutral"
        />
      ),
      detail: (
        <MemoryProfile
          content={data.user.content}
          charLimit={data.user.charLimit}
          profile={profile}
          onRefresh={onRefresh}
        />
      ),
    },
    {
      key: "sessions",
      Icon: Search,
      label: t("memory.sessionSearch"),
      desc: t("memory.sessionSearchDesc"),
      // Written entirely by the agent.
      badge: t("memory.readOnly"),
      bounded: false,
      used: 0,
      limit: 0,
      metric: data.sessions.available ? (
        <span className="memory-system-facts">
          <span>
            {t("memory.sessionsAndMessages", {
              sessions: data.sessions.totalSessions,
              messages: data.sessions.totalMessages,
            })}
          </span>
          {data.sessions.lastSessionAt !== null && (
            <span>
              {t("memory.lastActive", {
                when: relativeTime(data.sessions.lastSessionAt),
              })}
            </span>
          )}
        </span>
      ) : (
        <span>{t("memory.sessionsUnavailable")}</span>
      ),
      // Deliberately thin: search lives on the Sessions screen, which already
      // implements FTS over the same table.
      detail: (
        <div className="memory-system-detail-note">
          {data.sessions.available
            ? t("memory.sessionsAndMessages", {
                sessions: data.sessions.totalSessions,
                messages: data.sessions.totalMessages,
              })
            : t("memory.sessionsUnavailable")}
          {data.sessions.lastSessionAt !== null && (
            <>
              {" · "}
              {t("memory.lastActive", {
                when: relativeTime(data.sessions.lastSessionAt),
              })}
            </>
          )}
          <br />
          {t("memory.sessionSearchHint")}
        </div>
      ),
    },
    {
      key: "provider",
      Icon: Cloud,
      label: t("memory.providersTitle"),
      desc: t("memory.providerDesc"),
      // You choose and configure the backend but cannot read or write its
      // store. "Read-only" beside its own Activate button would be a new lie.
      badge: t("memory.configurable"),
      bounded: false,
      used: 0,
      limit: 0,
      metric: (
        <span className="memory-system-facts">
          <span>{data.provider.active ?? t("memory.providerBuiltIn")}</span>
          {data.provider.active && !data.provider.installed && (
            <span className="memory-system-warn">
              {t("memory.providerNotInstalled")}
            </span>
          )}
        </span>
      ),
      detail: (
        <MemoryProviders
          providers={providers}
          activeProvider={data.provider.active}
          profile={profile}
          onRefresh={onRefresh}
        />
      ),
    },
    {
      key: "vault",
      Icon: BookOpen,
      label: t("memory.vaultTitle"),
      desc: t("memory.vaultDesc"),
      badge: t("memory.configurable"),
      bounded: false,
      used: 0,
      limit: 0,
      metric: (
        <span className="memory-system-facts">
          <span>
            {data.vault.path
              ? folderName(data.vault.path)
              : t("memory.vaultNotLinked")}
          </span>
          {data.vault.path && !data.vault.exists && (
            <span className="memory-system-warn">{t("memory.vaultMissing")}</span>
          )}
        </span>
      ),
      detail: (
        <MemoryVault
          path={data.vault.path}
          exists={data.vault.exists}
          profile={profile}
          onRefresh={onRefresh}
        />
      ),
    },
  ];

  return (
    <div className="memory-systems">
      {rows.map((r) => {
        const isOpen = open === r.key;
        const nearFull =
          r.bounded && r.limit > 0 && r.used / r.limit >= NEAR_FULL;
        return (
          <div
            className={`memory-system ${isOpen ? "is-open" : ""}`}
            key={r.key}
            data-testid={`memory-system-${r.key}`}
          >
            <button
              type="button"
              className="memory-system-head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : r.key)}
            >
              <r.Icon size={15} className="memory-system-icon" />
              <span className="memory-system-text">
                <span className="memory-system-label">{r.label}</span>
                <span className="memory-system-desc">{r.desc}</span>
              </span>
              <span className="memory-system-badge">{r.badge}</span>
              <span className="memory-system-metric">{r.metric}</span>
            </button>
            {nearFull && (
              <div className="memory-system-note">{t("memory.atCapacity")}</div>
            )}
            {isOpen && (
              <div className="memory-system-detail">
                {r.detail}
                {r.bounded && (
                  <div className="memory-system-note">
                    {t("memory.nextSessionNote")}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 14: Style every new class name**

Append to `src/renderer/src/assets/main.css` after the `.memory-soul-tab .soul-container` rule (the last `.memory-*` rule, ~line 14590). Tokens follow the existing `.memory-entry-card` and `.memory-tab` rules so the screen reads as one design.

```css
/* ── Memory: systems inventory (Agent Settings → Memory) ───────────────── */

.memory-systems {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memory-system {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.memory-system:hover {
  border-color: var(--border-bright);
}

.memory-system-head {
  width: 100%;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto minmax(180px, 220px);
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: none;
  border: none;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.memory-system-icon {
  color: var(--text-muted);
}

.memory-system-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.memory-system-label {
  font-size: 13px;
  font-weight: 600;
}

.memory-system-desc {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.memory-system-badge {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  white-space: nowrap;
}

.memory-system-metric {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 0;
}

.memory-system-metric .memory-capacity {
  margin: 0;
}

.memory-system-facts {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-end;
  text-align: right;
}

.memory-system-warn {
  font-size: 11px;
  color: var(--warning);
}

.memory-system-note {
  font-size: 12px;
  color: var(--text-muted);
  padding: 0 14px 10px;
}

.memory-system-detail {
  border-top: 1px solid var(--border);
  padding: 14px;
}

.memory-system-detail-note {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.memory-vault {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.memory-vault-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.memory-vault-path {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.memory-vault-path code {
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.memory-vault-actions {
  display: flex;
  gap: 8px;
}
```

If any `var(--...)` token used above does not exist in `main.css` (check with `grep -c -- "--bg-elevated:" src/renderer/src/assets/main.css`, likewise `--border-bright`, `--radius-sm`, `--warning`), substitute the nearest existing token from the `.memory-entry-card` / `.memory-tab` rules; do not invent a token.

- [ ] **Step 15: Run the Memory tests and typecheck**

Run: `npx vitest run src/renderer/src/screens/Memory/ src/main/remove-env.test.ts && npm run typecheck`
Expected: PASS (2 env + 5 vault + 8 inventory); typecheck clean.

- [ ] **Step 16: Commit**

```bash
git add src/renderer/src/screens/Memory/ src/shared/i18n/locales/en/memory.ts src/renderer/src/assets/main.css src/main/config.ts src/main/remove-env.test.ts src/main/ssh-remote.ts src/main/ipc/register.ts src/preload/index.ts src/preload/index.d.ts docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "feat(memory): systems inventory with five rows, vault pane that unlinks cleanly, neutral capacity tone"
```

---

### Task 8: Conflict-aware editors

**Files:**

- Modify: `src/renderer/src/screens/Memory/MemoryEntries.tsx`
- Modify: `src/renderer/src/screens/Memory/MemoryProfile.tsx`
- Test: `src/renderer/src/screens/Memory/MemoryEntries.test.tsx`, `src/renderer/src/screens/Memory/MemoryProfile.test.tsx`

**Interfaces:**

- Consumes: the preload writer signatures from Task 2 (`updateMemoryEntry(index, content, profile?, expected?)`, `removeMemoryEntry(index, profile?, expected?)`, `writeUserProfile(content, profile?, expected?)`, all returning `{ success, error?, conflict? }`).
- Produces: nothing other tasks depend on. Component props are unchanged.

Behaviour being built: every edit sends what the user was looking at; on `conflict` the view reloads (`onRefresh()`) and the message from the main process is shown. For entries the editor closes, because the entry it was editing may no longer be at that index. For the user profile the draft **survives** in the textarea and the baseline moves to the fresh disk content, so a second save is an informed overwrite rather than a silent one.

- [ ] **Step 1: Write the failing entries test**

```tsx
// src/renderer/src/screens/Memory/MemoryEntries.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryEntries } from "./MemoryEntries";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const api = {
  addMemoryEntry: vi.fn(),
  updateMemoryEntry: vi.fn(),
  removeMemoryEntry: vi.fn(),
};

const entries = [
  { index: 0, content: "a" },
  { index: 1, content: "b" },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.updateMemoryEntry.mockResolvedValue({ success: true });
  api.removeMemoryEntry.mockResolvedValue({ success: true });
  (window as unknown as { hermesAPI: unknown }).hermesAPI = api;
});

describe("MemoryEntries conflict handling", () => {
  it("sends the entry's original text as the expectation when saving an edit", async () => {
    render(<MemoryEntries entries={entries} profile="p" onRefresh={() => {}} />);
    fireEvent.click(screen.getAllByText("memory.edit")[1]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "B" } });
    fireEvent.click(screen.getByText("memory.save"));
    await waitFor(() =>
      expect(api.updateMemoryEntry).toHaveBeenCalledWith(1, "B", "p", "b"),
    );
  });

  it("reloads, closes the editor and shows the message on a conflict", async () => {
    api.updateMemoryEntry.mockResolvedValue({
      success: false,
      conflict: true,
      error: "changed underneath",
    });
    const onRefresh = vi.fn();
    render(<MemoryEntries entries={entries} profile="p" onRefresh={onRefresh} />);
    fireEvent.click(screen.getAllByText("memory.edit")[0]);
    fireEvent.click(screen.getByText("memory.save"));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("changed underneath")).toBeTruthy();
  });

  it("sends the entry's text as the expectation when deleting, and reports failure", async () => {
    api.removeMemoryEntry.mockResolvedValue({ success: false, error: "nope" });
    const onRefresh = vi.fn();
    const { container } = render(
      <MemoryEntries entries={entries} profile="p" onRefresh={onRefresh} />,
    );
    // The trash button is icon-only: second .memory-entry-btn in the first card.
    const firstCard = container.querySelectorAll(".memory-entry-card")[0];
    fireEvent.click(firstCard.querySelectorAll(".memory-entry-btn")[1]);
    fireEvent.click(screen.getByText("memory.yes"));
    await waitFor(() =>
      expect(api.removeMemoryEntry).toHaveBeenCalledWith(0, "p", "a"),
    );
    expect(onRefresh).toHaveBeenCalled();
    expect(screen.getByText("nope")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/renderer/src/screens/Memory/MemoryEntries.test.tsx`
Expected: FAIL — `updateMemoryEntry` called with 3 arguments, not 4; delete result ignored.

- [ ] **Step 3: Make `MemoryEntries` send expectations and react to conflicts**

In `src/renderer/src/screens/Memory/MemoryEntries.tsx`:

Add a state line after `const [editContent, setEditContent] = useState("");`:

```tsx
  /** The entry text as loaded — sent as the expectation so a save cannot land
   *  on an entry the agent has since changed or moved. */
  const [editOriginal, setEditOriginal] = useState("");
```

Replace `handleAddEntry`'s failure branch, `handleSaveEdit`, and `handleDeleteEntry` with:

```tsx
  async function handleAddEntry(): Promise<void> {
    if (!newEntry.trim()) return;
    setError("");
    const result = await window.hermesAPI.addMemoryEntry(
      newEntry.trim(),
      profile,
    );
    if (result.success) {
      setNewEntry("");
      setShowAdd(false);
      onRefresh();
    } else {
      setError(result.error || t("memory.addFailed"));
      // The agent moved the file underneath us; reload so the view matches disk.
      if (result.conflict) onRefresh();
    }
  }

  async function handleSaveEdit(): Promise<void> {
    if (editingIndex === null) return;
    setError("");
    const result = await window.hermesAPI.updateMemoryEntry(
      editingIndex,
      editContent.trim(),
      profile,
      editOriginal,
    );
    if (result.success) {
      setEditingIndex(null);
      setEditContent("");
      onRefresh();
    } else {
      setError(result.error || t("memory.updateFailed"));
      if (result.conflict) {
        // The entry under this index is not the one the user was editing.
        setEditingIndex(null);
        setEditContent("");
        onRefresh();
      }
    }
  }

  async function handleDeleteEntry(
    index: number,
    expected: string,
  ): Promise<void> {
    setError("");
    const result = await window.hermesAPI.removeMemoryEntry(
      index,
      profile,
      expected,
    );
    setConfirmDelete(null);
    if (!result.success) setError(result.error || t("memory.updateFailed"));
    // Reload on success and on failure alike: a conflict means the list on
    // screen is stale, and a plain error costs nothing to refresh after.
    onRefresh();
  }
```

Update the two call sites in the JSX:

- The Edit button's `onClick` becomes:

```tsx
                    onClick={() => {
                      setEditingIndex(entry.index);
                      setEditContent(entry.content);
                      setEditOriginal(entry.content);
                    }}
```

- The confirm-delete Yes button's `onClick` becomes `onClick={() => handleDeleteEntry(entry.index, entry.content)}`.

- [ ] **Step 4: Run the entries test to verify it passes**

Run: `npx vitest run src/renderer/src/screens/Memory/MemoryEntries.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing profile-editor test**

```tsx
// src/renderer/src/screens/Memory/MemoryProfile.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryProfile } from "./MemoryProfile";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const api = { writeUserProfile: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  api.writeUserProfile.mockResolvedValue({ success: true });
  (window as unknown as { hermesAPI: unknown }).hermesAPI = api;
});

describe("MemoryProfile conflict handling", () => {
  it("sends the loaded content as the expectation", async () => {
    render(
      <MemoryProfile content="me" charLimit={1375} profile="p" onRefresh={() => {}} />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "me v2" } });
    fireEvent.click(screen.getByText("memory.saveProfile"));
    await waitFor(() =>
      expect(api.writeUserProfile).toHaveBeenCalledWith("me v2", "p", "me"),
    );
  });

  it("keeps the draft, reloads, and shows the message on a conflict", async () => {
    api.writeUserProfile.mockResolvedValue({
      success: false,
      conflict: true,
      error: "agent wrote first",
    });
    const onRefresh = vi.fn();
    render(
      <MemoryProfile content="me" charLimit={1375} profile="p" onRefresh={onRefresh} />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "me v2" } });
    fireEvent.click(screen.getByText("memory.saveProfile"));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "me v2",
    );
    expect(screen.getByText("agent wrote first")).toBeTruthy();
  });

  it("resyncs the textarea when fresh content arrives and nothing is being edited", () => {
    const { rerender } = render(
      <MemoryProfile content="me" charLimit={1375} profile="p" onRefresh={() => {}} />,
    );
    rerender(
      <MemoryProfile content="fresh" charLimit={1375} profile="p" onRefresh={() => {}} />,
    );
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "fresh",
    );
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/renderer/src/screens/Memory/MemoryProfile.test.tsx`
Expected: FAIL — `writeUserProfile` called with 2 arguments; resync test fails because the textarea keeps "me".

- [ ] **Step 7: Make `MemoryProfile` send its baseline and resync**

In `src/renderer/src/screens/Memory/MemoryProfile.tsx`, change the React import to `import { useEffect, useState } from "react";`, add after the `useState` lines:

```tsx
  // Resync to disk when a refresh delivers new content and the user is not
  // mid-edit. After a conflict the draft survives (userEditing stays true) but
  // `initialContent` has moved on, so the next save's expectation is the
  // fresh file — an informed overwrite, not a silent one.
  useEffect(() => {
    if (!userEditing) setUserContent(initialContent);
  }, [initialContent, userEditing]);
```

and replace `handleSave` with:

```tsx
  async function handleSave(): Promise<void> {
    setError("");
    const result = await window.hermesAPI.writeUserProfile(
      userContent,
      profile,
      initialContent,
    );
    if (result.success) {
      setUserEditing(false);
      setUserSaved(true);
      setTimeout(() => setUserSaved(false), 2000);
      onRefresh();
    } else {
      setError(result.error || t("memory.saveFailed"));
      if (result.conflict) onRefresh();
    }
  }
```

- [ ] **Step 8: Run both editor tests and typecheck**

Run: `npx vitest run src/renderer/src/screens/Memory/ && npm run typecheck:web`
Expected: PASS; typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/screens/Memory/MemoryEntries.tsx src/renderer/src/screens/Memory/MemoryEntries.test.tsx src/renderer/src/screens/Memory/MemoryProfile.tsx src/renderer/src/screens/Memory/MemoryProfile.test.tsx docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "feat(memory): editors send what the user saw and reload on conflict"
```

---

### Task 9: Agent Settings: Memory tab and naming

**Files:**

- Modify: `src/renderer/src/components/profile/ProfileModal.tsx:22-23,109,145-157,318-334,503-519`
- Modify: `src/renderer/src/components/profile/ProfileModal.test.tsx:34-36,80-90`
- Modify: `src/shared/i18n/locales/en/agents.ts:39-40,55`
- Modify: `src/renderer/src/assets/main.css` (one rule near `.profile-modal-sidebar-head`)

**Interfaces:**

- Consumes: `MemorySystems` (Task 7), `MemoryData`/`MemoryProviderInfo` (Task 5), `window.hermesAPI.discoverMemoryProviders(profile)` (exists).
- Produces: nothing later tasks depend on. Task 11 adds to the same file's Profile tab.

- [ ] **Step 1: Rename the labels**

In `src/shared/i18n/locales/en/agents.ts`:

- line 39: `editAppearance: "Edit profile",` → `editAppearance: "Agent settings",`
- line 40: `editAppearanceFor: "Edit {{name}}",` → `editAppearanceFor: "Agent settings for {{name}}",`
- line 55: `sectionAgentMemory: "Agent Memory",` → `sectionAgentMemory: "Memory",`
- add after line 55: `agentSettings: "Agent settings",`

The keys are unchanged, so `Agents.tsx:460-463` and `ProfileSwitcher.tsx:216` pick up the new wording without edits.

- [ ] **Step 2: Add a failing test for the Memory tab**

Append to `src/renderer/src/components/profile/ProfileModal.test.tsx` inside the existing `describe` (or as a new `describe("Memory tab")` at the end):

```tsx
  it("loads memory and providers for this agent and mounts the inventory", async () => {
    installHermesAPI([profile()]);
    renderModal();
    fireEvent.click(
      await screen.findByRole("button", { name: "agents.sectionAgentMemory" }),
    );
    expect(await screen.findByTestId("memory")).toBeTruthy();
    const hermes = (window as unknown as {
      hermesAPI: {
        readMemory: ReturnType<typeof vi.fn>;
        discoverMemoryProviders: ReturnType<typeof vi.fn>;
      };
    }).hermesAPI;
    await waitFor(() =>
      expect(hermes.discoverMemoryProviders).toHaveBeenCalledWith("default"),
    );
    expect(hermes.readMemory).toHaveBeenCalledWith("default");
  });
```

Also change the existing module mock at lines 34-36 from `MemoryEntries` to the inventory:

```tsx
vi.mock("../../screens/Memory/MemorySystems", () => ({
  MemorySystems: (): React.JSX.Element => <div data-testid="memory" />,
}));
```

and add to the `hermesAPI` object in `installHermesAPI`:

```tsx
      discoverMemoryProviders: vi.fn().mockResolvedValue([]),
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/renderer/src/components/profile/ProfileModal.test.tsx`
Expected: the new test FAILS — `discoverMemoryProviders` is never called (and `data-testid="memory"` is not found, since the real `MemoryEntries` renders instead of the mocked `MemorySystems`).

- [ ] **Step 4: Mount the inventory and fetch the providers**

In `src/renderer/src/components/profile/ProfileModal.tsx`:

Replace the two imports at lines 22-23 with:

```tsx
import { MemorySystems } from "../../screens/Memory/MemorySystems";
import type {
  MemoryData,
  MemoryProviderInfo,
} from "../../screens/Memory/types";
```

After `const [memoryData, setMemoryData] = useState<MemoryData | null>(null);` add:

```tsx
  const [memoryProviders, setMemoryProviders] = useState<MemoryProviderInfo[]>(
    [],
  );
```

Replace `loadMemoryData` (lines 145-157) with:

```tsx
  const loadMemoryData = useCallback(async (): Promise<void> => {
    if (!profile) return;
    setMemoryLoading(true);
    setMemoryError("");
    try {
      // MemorySystems requires the providers list: an empty one makes the
      // provider pane say "No memory providers found" for every agent.
      const [data, provs] = await Promise.all([
        window.hermesAPI.readMemory(profile.id),
        window.hermesAPI.discoverMemoryProviders(profile.id),
      ]);
      setMemoryData(data as MemoryData);
      setMemoryProviders(provs);
    } catch {
      setMemoryError(t("memory.loadFailed"));
    } finally {
      setMemoryLoading(false);
    }
  }, [profile, t]);
```

Replace the `section === "agentMemory"` block (lines 503-519) with — keep the pane wrapper, it carries the layout:

```tsx
            {section === "agentMemory" && (
              <div className="profile-modal-pane profile-modal-memory-pane">
                {memoryLoading && !memoryData ? (
                  <div className="profile-modal-loading">
                    <OrbLoader state="searching" size={64} />
                  </div>
                ) : memoryData ? (
                  <MemorySystems
                    data={memoryData}
                    profile={profile.id}
                    providers={memoryProviders}
                    onRefresh={loadMemoryData}
                  />
                ) : memoryError ? (
                  <div className="memory-error">{memoryError}</div>
                ) : null}
              </div>
            )}
```

Add the Agent Settings kicker above the sidebar head (line 318 area), so the modal names itself:

```tsx
      <aside className="profile-modal-sidebar">
        <span className="profile-modal-kicker">{t("agents.agentSettings")}</span>
        <div className="profile-modal-sidebar-head">
```

And in `src/renderer/src/assets/main.css`, directly before the `.profile-modal-sidebar-head {` rule, add:

```css
.profile-modal-kicker {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 6px;
}
```

- [ ] **Step 5: Run the modal tests and typecheck**

Run: `npx vitest run src/renderer/src/components/profile/ && npm run typecheck:web`
Expected: PASS (existing tests plus the new one); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/profile/ProfileModal.tsx src/renderer/src/components/profile/ProfileModal.test.tsx src/shared/i18n/locales/en/agents.ts src/renderer/src/assets/main.css docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "feat(agent-settings): Memory tab shows all five systems; modal names itself Agent settings"
```

---

### Task 10: Memory screen becomes the cross-agent overview

**Files:**

- Modify: `src/renderer/src/screens/Memory/Memory.tsx` (rewrite)
- Delete: `src/renderer/src/screens/Memory/MemoryTabs.tsx`
- Modify: `src/renderer/src/screens/Memory/types.ts` (remove `MemoryTab`)
- Modify: `src/renderer/src/screens/Layout/Layout.tsx:27,965`
- Modify: `src/shared/i18n/locales/en/memory.ts`
- Modify: `src/renderer/src/assets/main.css` (append)
- Create: `src/renderer/src/screens/Memory/Memory.test.tsx`

**Interfaces:**

- Consumes: `window.hermesAPI.readAllAgentsMemory()` and `AgentMemorySummary` (Task 6), `CapacityBar` with `tone` (Task 7), `relativeTime` exported from `MemorySystems.tsx` (Task 7), `useProfileModal().openProfile(name, { initialSection })` from `components/profile/ProfileModalContext.ts` (exists; `Layout` is rendered inside `ProfileModalProvider` — `ProfileSwitcher`, which Layout renders, already calls the hook).
- Produces: `<Memory onOpenAgent={(profileId: string) => void} />`. The old `profile` prop is gone.

- [ ] **Step 1: Add the strings**

In `src/shared/i18n/locales/en/memory.ts`, add before `providers: {`:

```ts
  overviewSubtitle: "What each of your agents remembers.",
  agentUnavailable: "Memory could not be read",
  activeAgent: "Active",
  sessionsCount: "{{count}} sessions",
  openAgentMemory: "Open agent settings",
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/renderer/src/screens/Memory/Memory.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Memory from "./Memory";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

vi.mock("../../components/common/ProfileAvatar", () => ({
  default: ({ name }: { name: string }) => (
    <span data-testid={`avatar-${name}`} />
  ),
}));

const agents = [
  {
    id: "default",
    name: "Hermes One",
    isActive: true,
    memoryChars: 512,
    memoryLimit: 2200,
    memoryEntries: 2,
    userChars: 1363,
    userLimit: 1375,
    totalSessions: 22,
    lastSessionAt: Math.floor(Date.now() / 1000) - 7200,
    provider: null,
    vaultLinked: true,
    available: true,
  },
  {
    id: "myrtle",
    name: "Myrtle",
    isActive: false,
    memoryChars: 0,
    memoryLimit: 0,
    memoryEntries: 0,
    userChars: 0,
    userLimit: 0,
    totalSessions: 0,
    lastSessionAt: null,
    provider: null,
    vaultLinked: false,
    available: false,
  },
];

beforeEach(() => {
  (window as unknown as { hermesAPI: unknown }).hermesAPI = {
    readAllAgentsMemory: vi.fn().mockResolvedValue(agents),
  };
});

describe("Memory overview", () => {
  it("lists every agent with its memory facts", async () => {
    render(<Memory />);
    await waitFor(() => expect(screen.getByText("Hermes One")).toBeTruthy());
    expect(screen.getByText("Myrtle")).toBeTruthy();
    const row = screen.getByTestId("memory-agent-default");
    expect(row.textContent).toContain("memory.sessionsCount:22");
    expect(row.textContent).toContain("memory.lastActive:");
    expect(row.textContent).toContain("memory.providerBuiltIn");
    expect(row.textContent).toContain("memory.vaultLinked");
    expect(row.textContent).toContain("memory.activeAgent");
  });

  it("marks an unreadable agent without blanking the list", async () => {
    render(<Memory />);
    await waitFor(() =>
      expect(screen.getByText("memory.agentUnavailable")).toBeTruthy(),
    );
    expect(screen.getByText("Hermes One")).toBeTruthy();
    // No bar for an agent whose limits are unknown — and no NaN%.
    expect(
      screen.getByTestId("memory-agent-myrtle").querySelector(".memory-capacity"),
    ).toBeNull();
  });

  it("opens the selected agent", async () => {
    const onOpenAgent = vi.fn();
    render(<Memory onOpenAgent={onOpenAgent} />);
    await waitFor(() => screen.getByText("Myrtle"));
    fireEvent.click(screen.getByTestId("memory-agent-myrtle"));
    expect(onOpenAgent).toHaveBeenCalledWith("myrtle");
  });

  it("has no editing affordance", async () => {
    render(<Memory />);
    await waitFor(() => screen.getByText("Myrtle"));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("memory.addMemory")).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/renderer/src/screens/Memory/Memory.test.tsx`
Expected: FAIL — the component still calls `readMemory`, `getConfig` and `discoverMemoryProviders`, which the mock does not provide.

- [ ] **Step 4: Rewrite `Memory.tsx`**

Replace the whole of `src/renderer/src/screens/Memory/Memory.tsx` with:

```tsx
import { useState, useEffect, useCallback } from "react";
import { Refresh } from "../../assets/icons";
import { useI18n } from "../../components/useI18n";
import { OrbLoader } from "../../components/OrbLoader";
import ProfileAvatar from "../../components/common/ProfileAvatar";
import { CapacityBar } from "./CapacityBar";
import { relativeTime } from "./MemorySystems";
import type { AgentMemorySummary } from "./types";

interface MemoryProps {
  /** Called with the profile id when a row is selected. */
  onOpenAgent?: (profileId: string) => void;
}

/**
 * Cross-agent memory overview. Reads only — every write happens in Agent
 * Settings (ProfileModal → Memory), so there is exactly one place that edits
 * memory. Selecting a row opens that agent there.
 */
function Memory({ onOpenAgent }: MemoryProps): React.JSX.Element {
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentMemorySummary[] | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setAgents(await window.hermesAPI.readAllAgentsMemory());
    } catch {
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!agents) {
    return (
      <div className="settings-container">
        <h1 className="settings-header">{t("memory.title")}</h1>
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <OrbLoader state="searching" size={64} />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="memory-header">
        <div>
          <h1 className="settings-header" style={{ marginBottom: 4 }}>
            {t("memory.title")}
          </h1>
          <p className="memory-subtitle">{t("memory.overviewSubtitle")}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => void load()}>
          <Refresh size={13} />
        </button>
      </div>

      <div className="memory-agents">
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`memory-agent ${a.isActive ? "is-active" : ""}`}
            data-testid={`memory-agent-${a.id}`}
            title={t("memory.openAgentMemory")}
            onClick={() => onOpenAgent?.(a.id)}
          >
            <div className="memory-agent-head">
              <ProfileAvatar
                name={a.id}
                color={a.color}
                avatar={a.avatar}
                size={28}
              />
              <span className="memory-agent-name">{a.name}</span>
              {a.isActive && (
                <span className="memory-agent-active">
                  {t("memory.activeAgent")}
                </span>
              )}
            </div>
            {a.available ? (
              <div className="memory-agent-metrics">
                <div className="memory-agent-bars">
                  <CapacityBar
                    used={a.memoryChars}
                    limit={a.memoryLimit}
                    label={t("memory.agentMemory")}
                    tone="neutral"
                  />
                  <CapacityBar
                    used={a.userChars}
                    limit={a.userLimit}
                    label={t("memory.userProfile")}
                    tone="neutral"
                  />
                </div>
                <div className="memory-agent-facts">
                  <span>
                    {a.totalSessions > 0
                      ? t("memory.sessionsCount", { count: a.totalSessions })
                      : t("memory.sessionsUnavailable")}
                  </span>
                  {a.lastSessionAt !== null && (
                    <span>
                      {t("memory.lastActive", {
                        when: relativeTime(a.lastSessionAt),
                      })}
                    </span>
                  )}
                  <span>{a.provider ?? t("memory.providerBuiltIn")}</span>
                  <span>
                    {a.vaultLinked
                      ? t("memory.vaultLinked")
                      : t("memory.vaultNotLinked")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="memory-agent-unavailable">
                {t("memory.agentUnavailable")}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Memory;
```

Delete `src/renderer/src/screens/Memory/MemoryTabs.tsx` (`git rm`) and remove the now-unused `export type MemoryTab = ...` line from `types.ts`.

- [ ] **Step 5: Wire the caller**

In `src/renderer/src/screens/Layout/Layout.tsx`, add the import beside the other component imports:

```tsx
import { useProfileModal } from "../../components/profile/ProfileModalContext";
```

Inside the `Layout` component body, near the other hooks (after `const { t } = useI18n();` or the equivalent first hook call), add:

```tsx
  const { openProfile } = useProfileModal();
```

If `Layout` already destructures `openProfile` somewhere, reuse it instead of adding a second call. Replace line 965 `<Memory profile={activeProfile} />` with:

```tsx
                <Memory
                  onOpenAgent={(id) =>
                    openProfile(id, { initialSection: "agentMemory" })
                  }
                />
```

- [ ] **Step 6: Style the overview rows**

Append to `src/renderer/src/assets/main.css` after the inventory rules from Task 7:

```css
/* ── Memory: cross-agent overview (top-level Memory screen) ────────────── */

.memory-agents {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.memory-agent {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: border-color var(--transition);
}

.memory-agent:hover {
  border-color: var(--border-bright);
}

.memory-agent.is-active {
  border-color: var(--accent);
}

.memory-agent-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.memory-agent-name {
  font-size: 14px;
  font-weight: 600;
}

.memory-agent-active {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
}

.memory-agent-metrics {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: start;
}

.memory-agent-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memory-agent-facts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
  white-space: nowrap;
}

.memory-agent-unavailable {
  font-size: 12px;
  color: var(--text-muted);
}
```

- [ ] **Step 7: Run the Memory tests and typecheck**

Run: `npx vitest run src/renderer/src/screens/Memory/ && npm run typecheck:web`
Expected: PASS; typecheck clean. Typecheck catches `Layout.tsx` if the prop change was missed, and `types.ts` if `MemoryTab` is still imported anywhere.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/screens/Memory/ src/renderer/src/screens/Layout/Layout.tsx src/shared/i18n/locales/en/memory.ts src/renderer/src/assets/main.css docs/superpowers/plans/2026-09-02-memory-per-agent.md
git rm src/renderer/src/screens/Memory/MemoryTabs.tsx
git commit -m "feat(memory): Memory screen becomes a read-only cross-agent overview"
```

---

### Task 11: Agent Settings: model and provider in the Profile tab

**Files:**

- Create: `src/renderer/src/components/profile/ProfileModelPicker.tsx`
- Create: `src/renderer/src/components/profile/ProfileModelPicker.test.tsx`
- Modify: `src/renderer/src/components/profile/ProfileModal.tsx:2-16,265-304,453-465`
- Modify: `src/renderer/src/components/profile/ProfileModal.test.tsx` (one mock)
- Modify: `src/shared/i18n/locales/en/agents.ts`
- Modify: `src/renderer/src/assets/main.css` (append after `.profile-modal-kicker`)

**Interfaces:**

- Consumes (all existing):
  - `useModelConfig(profile?: string)` from `screens/Chat/hooks/useModelConfig.ts` → `{ currentModel, currentProvider, currentBaseUrl, modelGroups, displayModel, reload, selectModel(provider, model, baseUrl, { persist }) }`. With `persist: true` it writes that profile's `config.yaml` via `setModelConfig` and re-reads it.
  - `ModelPicker` (named export) from `screens/Chat/ModelPicker.tsx` with props `active, currentModel, currentProvider, currentBaseUrl, modelGroups, displayModel, onOpen, onSelectModel`. `active={false}` keeps it from also opening on the chat's global shortcut event.
  - `window.hermesAPI.rerunConfigHealth(profile): Promise<unknown>` → a `ConfigHealthReport` whose `issues[]` may contain `{ code: "MODEL_KEY_MISSING", context: { expectedKey, provider } }`. That check already knows about OAuth credentials, credential vaults and compatible-endpoint fallbacks, so the component never re-derives any of that.
  - `window.hermesAPI.setEnv(key, value, profile): Promise<boolean>`.
- Produces: `<ProfileModelPicker profile={string} />` (default export). Nothing later depends on it.

- [ ] **Step 1: Add the strings**

In `src/shared/i18n/locales/en/agents.ts`, after `agentSettings: "Agent settings",` add:

```ts
  modelLabel: "Model",
  modelHint:
    "Which model and provider this agent uses. Saved to this agent's own config.",
  modelKeyMissing:
    "This agent has no {{key}} in its .env. Paste the key to use this provider.",
  modelKeyOAuthHint:
    "For providers you sign in to (OAuth), connect from Providers with this agent active.",
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/renderer/src/components/profile/ProfileModelPicker.test.tsx
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../useI18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

vi.mock("../../screens/Chat/hooks/useModelConfig", () => ({
  useModelConfig: vi.fn(),
}));

// The real picker is a pure component; a stub that fires one selection keeps
// this test about persistence and the key check, not dropdown mechanics.
vi.mock("../../screens/Chat/ModelPicker", () => ({
  ModelPicker: ({
    displayModel,
    onSelectModel,
  }: {
    displayModel: string;
    onSelectModel: (p: string, m: string, b: string) => void;
  }) => (
    <button
      data-testid="picker"
      onClick={() => onSelectModel("xai", "grok-4", "")}
    >
      {displayModel}
    </button>
  ),
}));

import { useModelConfig } from "../../screens/Chat/hooks/useModelConfig";
import ProfileModelPicker from "./ProfileModelPicker";

const selectModel = vi.fn();
const api = {
  rerunConfigHealth: vi.fn(),
  setEnv: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (useModelConfig as Mock).mockReturnValue({
    currentModel: "gpt-5",
    currentProvider: "openai-codex",
    currentBaseUrl: "",
    modelGroups: [],
    displayModel: "gpt-5",
    reload: vi.fn(),
    selectModel,
  });
  selectModel.mockResolvedValue(undefined);
  api.rerunConfigHealth.mockResolvedValue({ issues: [] });
  api.setEnv.mockResolvedValue(true);
  (window as unknown as { hermesAPI: unknown }).hermesAPI = api;
});

describe("ProfileModelPicker", () => {
  it("binds the model hook to this agent and persists a pick to it", async () => {
    render(<ProfileModelPicker profile="myrtle" />);
    expect(useModelConfig).toHaveBeenCalledWith("myrtle");
    fireEvent.click(screen.getByTestId("picker"));
    await waitFor(() =>
      expect(selectModel).toHaveBeenCalledWith("xai", "grok-4", "", {
        persist: true,
      }),
    );
  });

  it("shows no key field when the health check is clean", async () => {
    render(<ProfileModelPicker profile="myrtle" />);
    await waitFor(() =>
      expect(api.rerunConfigHealth).toHaveBeenCalledWith("myrtle"),
    );
    expect(screen.queryByTestId("profile-model-key")).toBeNull();
  });

  it("shows an inline key field when a key is missing, and saves it to this agent", async () => {
    api.rerunConfigHealth.mockResolvedValue({
      issues: [
        {
          code: "MODEL_KEY_MISSING",
          context: { expectedKey: "XAI_API_KEY", provider: "xai" },
        },
      ],
    });
    render(<ProfileModelPicker profile="myrtle" />);
    const field = await screen.findByTestId("profile-model-key");
    expect(field.textContent).toContain("agents.modelKeyMissing:XAI_API_KEY");
    fireEvent.change(screen.getByLabelText("XAI_API_KEY"), {
      target: { value: "sk-1" },
    });
    fireEvent.click(screen.getByText("memory.save"));
    await waitFor(() =>
      expect(api.setEnv).toHaveBeenCalledWith("XAI_API_KEY", "sk-1", "myrtle"),
    );
    // Re-checked after saving.
    expect(api.rerunConfigHealth.mock.calls.length).toBeGreaterThan(1);
  });

  it("a failed health check does not block the picker", async () => {
    api.rerunConfigHealth.mockRejectedValue(new Error("boom"));
    render(<ProfileModelPicker profile="myrtle" />);
    await waitFor(() => expect(api.rerunConfigHealth).toHaveBeenCalled());
    expect(screen.getByTestId("picker")).toBeTruthy();
    expect(screen.queryByTestId("profile-model-key")).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/renderer/src/components/profile/ProfileModelPicker.test.tsx`
Expected: FAIL — cannot resolve `./ProfileModelPicker`.

- [ ] **Step 4: Implement the picker**

```tsx
// src/renderer/src/components/profile/ProfileModelPicker.tsx
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../useI18n";
import { useModelConfig } from "../../screens/Chat/hooks/useModelConfig";
import { ModelPicker } from "../../screens/Chat/ModelPicker";

interface ProfileModelPickerProps {
  /** Profile id. The pick is saved to this agent's own config.yaml. */
  profile: string;
}

interface KeyIssue {
  expectedKey: string;
  provider: string;
}

/** The slice of ConfigHealthReport this component reads. */
interface HealthReportLike {
  issues?: { code: string; context?: Record<string, string> }[];
}

/**
 * Per-agent model and provider, in Agent Settings → Profile.
 *
 * Reuses the chat's model hook and picker in persist mode, so a pick here is
 * durable for this agent (unlike the chat's session-only override). After
 * each pick the existing per-profile config health check runs; when it
 * reports MODEL_KEY_MISSING the user can paste that key straight into this
 * agent's .env. The check already understands OAuth credentials, vaults and
 * compatible-endpoint fallbacks, so nothing is re-derived here.
 */
export default function ProfileModelPicker({
  profile,
}: ProfileModelPickerProps): React.JSX.Element {
  const { t } = useI18n();
  const mc = useModelConfig(profile);
  const [keyIssue, setKeyIssue] = useState<KeyIssue | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const checkKey = useCallback(async (): Promise<void> => {
    try {
      const report = (await window.hermesAPI.rerunConfigHealth(
        profile,
      )) as HealthReportLike;
      const issue = report?.issues?.find((i) => i.code === "MODEL_KEY_MISSING");
      const expectedKey = issue?.context?.expectedKey;
      setKeyIssue(
        expectedKey
          ? { expectedKey, provider: issue?.context?.provider ?? "" }
          : null,
      );
    } catch {
      // A failed check never blocks the picker; the hint is simply omitted.
      setKeyIssue(null);
    }
  }, [profile]);

  useEffect(() => {
    void checkKey();
  }, [checkKey, mc.currentModel, mc.currentProvider]);

  async function handleSelect(
    provider: string,
    model: string,
    baseUrl: string,
  ): Promise<void> {
    setError("");
    try {
      await mc.selectModel(provider, model, baseUrl, { persist: true });
    } catch {
      setError(t("common.updateFailed"));
    }
  }

  async function saveKey(): Promise<void> {
    if (!keyIssue || !keyDraft.trim()) return;
    setSaving(true);
    setError("");
    try {
      const ok = await window.hermesAPI.setEnv(
        keyIssue.expectedKey,
        keyDraft.trim(),
        profile,
      );
      if (!ok) setError(t("common.updateFailed"));
      setKeyDraft("");
      await checkKey();
    } catch {
      setError(t("common.updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-modal-section profile-model">
      <span className="profile-modal-label">{t("agents.modelLabel")}</span>
      <p className="profile-model-hint">{t("agents.modelHint")}</p>
      <ModelPicker
        active={false}
        currentModel={mc.currentModel}
        currentProvider={mc.currentProvider}
        currentBaseUrl={mc.currentBaseUrl}
        modelGroups={mc.modelGroups}
        displayModel={mc.displayModel}
        onOpen={() => void mc.reload()}
        onSelectModel={(p, m, b) => void handleSelect(p, m, b)}
      />
      {keyIssue && (
        <div className="profile-model-key" data-testid="profile-model-key">
          <span className="profile-model-hint">
            {t("agents.modelKeyMissing", { key: keyIssue.expectedKey })}
          </span>
          <div className="profile-model-key-row">
            <input
              className="input"
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder={keyIssue.expectedKey}
              aria-label={keyIssue.expectedKey}
              disabled={saving}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!keyDraft.trim() || saving}
              onClick={() => void saveKey()}
            >
              {t("memory.save")}
            </button>
          </div>
          <span className="profile-model-hint">
            {t("agents.modelKeyOAuthHint")}
          </span>
        </div>
      )}
      {error && <div className="agents-create-error">{error}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Run the picker test to verify it passes**

Run: `npx vitest run src/renderer/src/components/profile/ProfileModelPicker.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Mount it in the Profile tab and retire the read-only chips**

In `src/renderer/src/components/profile/ProfileModal.tsx`:

1. Add `import ProfileModelPicker from "./ProfileModelPicker";` beside the other local imports.
2. In `profileChips` (lines 271-304) delete the `provider` and `model` entries, leaving `skills` and `gateway`. Delete the now-unused `providerLabel` function (lines 265-269) and remove `Brain` and `Plug` from the icon import at the top (lines 3 and 5) — they were only used by those chips.
3. Directly after the `<div className="profile-modal-stats">…</div>` block (ends at line 465) and before the colour `profile-modal-section`, add:

```tsx
                <ProfileModelPicker profile={profile.id} />
```

4. In `src/renderer/src/components/profile/ProfileModal.test.tsx`, add beside the other module mocks:

```tsx
vi.mock("./ProfileModelPicker", () => ({
  default: (): React.JSX.Element => <div data-testid="model-picker" />,
}));
```

5. Append to `src/renderer/src/assets/main.css` after `.profile-modal-kicker`:

```css
.profile-model {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.profile-model-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.profile-model-key {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 480px;
  padding: 12px;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
}

.profile-model-key-row {
  display: flex;
  gap: 8px;
}

.profile-model-key-row .input {
  flex: 1;
}
```

- [ ] **Step 7: Run the profile tests, lint and typecheck**

Run: `npx vitest run src/renderer/src/components/profile/ && npx eslint src/renderer/src/components/profile/ && npm run typecheck:web`
Expected: PASS; no unused-import lint errors; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/profile/ src/shared/i18n/locales/en/agents.ts src/renderer/src/assets/main.css docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "feat(agent-settings): pick this agent's model and provider, with an inline key field"
```

---

### Task 12: Documentation and full verification

**Files:**

- Create: `lat.md/memory.md`, `lat.md/agent-settings.md`
- Modify: `lat.md/lat.md` (index), `lat.md/chat-commands.md:118`
- Modify: every new test file (one `@lat:` comment each)

**Interfaces:** none. Invoke the `lat-md` skill before writing.

- [ ] **Step 1: Write `lat.md/memory.md`**

Every heading has a leading paragraph under 250 characters. Section ids used by the test tags below are `memory#Memory#Tests#<leaf>`; confirm each with `npx --yes lat.md locate "<leaf heading>"` after writing.

````markdown
# Memory

Each agent draws on five memory systems, read and edited in one place — Agent Settings — and summarised read-only on the Memory screen. Desktop writes never overwrite what the agent wrote.

Upstream docs: [memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) and [memory providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers). Design: `docs/superpowers/specs/2026-09-02-memory-screen-design.md`.

## The five systems

Agent Memory and User Profile are bounded markdown files both sides edit; Session Search is the agent's own database; the external provider and the Obsidian vault are configured here but their contents are not read here.

| Key        | Store                         | Editable       | Metric                      |
| ---------- | ----------------------------- | -------------- | --------------------------- |
| `memory`   | `memories/MEMORY.md`          | user + agent   | chars / limit               |
| `user`     | `memories/USER.md`            | user + agent   | chars / limit               |
| `sessions` | `state.db`                    | read-only      | sessions, messages, last    |
| `provider` | one of 8 plugins              | configurable   | active name, installed      |
| `vault`    | folder in `OBSIDIAN_VAULT_PATH` | configurable | folder name, exists         |

[[src/main/memory.ts#readMemory]] assembles all five for one profile; every system reads independently so one failure never blanks the others. Persona (`SOUL.md`) is a context file, not a memory system, and keeps its own tab.

## Editability boundary

The inventory badges each row Editable, Configurable or Read-only, because a row whose detail hosts an Activate button cannot honestly be called read-only.

The badge is decided in [[src/renderer/src/screens/Memory/MemorySystems.tsx#MemorySystems]]. Bounded stores get a neutral-toned capacity bar from [[src/renderer/src/screens/Memory/CapacityBar.tsx#CapacityBar]] and, at 90%, the caption that the agent consolidates on the next write — at-capacity is the normal steady state, not a fault.

## Two surfaces

Agent Settings writes; the Memory screen reads. Keeping exactly one writing surface is what removes the duplication the earlier tabbed screen had.

### Agent Settings writes

The Memory tab of the profile modal mounts the inventory for that agent and is the only place memory, the provider or the vault path are changed.

See [[agent-settings]]. The modal fetches `readMemory` and `discoverMemoryProviders` together, because an empty provider list makes the provider pane report that no providers exist.

### The overview reads

The Memory screen lists every agent with fill levels, session count, last activity, provider and vault state, and opens Agent Settings at the Memory tab on selection.

[[src/main/agents-memory.ts#readAllAgentsMemory]] builds one summary per profile and degrades an unreadable agent to an unavailable row. The IPC branches to the SSH readers so a remote connection lists remote agents; the screen is hidden only in HTTP remote mode.

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

[[src/renderer/src/screens/Memory/MemoryVault.tsx#MemoryVault]] writes it through the existing `setEnv`, using the native folder dialog, and unlinks through [[src/main/config.ts#removeEnvValue]], which deletes the line rather than leaving a blank `KEY=` for the skill to misread. Because the variable is profile-scoped, agents can use different vaults. A path whose folder is missing is a warning, not an error.

## Slash command

`/memory` in chat prints the same five systems for the active agent, so the command and the UI agree on what memory is.

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

### Overview rows

Every agent renders with its facts; an unreadable agent is marked without blanking the list; selecting a row opens that agent; no editing affordance exists.
````

- [ ] **Step 2: Write `lat.md/agent-settings.md`**

````markdown
# Agent Settings

The profile modal is the per-agent settings screen: everything about one agent — identity, persona, model, memory, wallet, sync — is configured there, and the rest of the app links into it rather than duplicating its controls.

An agent is a Hermes profile (`~/.hermes/profiles/<id>/`, the default at `~/.hermes`) with its own `config.yaml`, `.env`, `SOUL.md`, memories and `state.db`. [[src/renderer/src/components/profile/ProfileModal.tsx#ProfileModal]] opens from the Agents screen, the profile switcher and the Memory overview, optionally at a named tab.

## Tabs

Profile, Persona, Memory, Wallet, Sync, Advanced. Persona is the agent's system prompt (`SOUL.md`) and stays its own tab; Memory holds the five-system inventory from [[memory]].

The openers say "Agent settings" and the modal carries an "Agent settings" kicker above the agent's name, so the screen names itself.

## Model and provider

The Profile tab pins this agent's LLM model and provider, saved to its own `config.yaml`, using the chat's model hook and picker in persist mode.

[[src/renderer/src/components/profile/ProfileModelPicker.tsx#ProfileModelPicker]] mounts the chat's picker ([[src/renderer/src/screens/Chat/ModelPicker.tsx]]) driven by `useModelConfig(profile.id)`; the chat uses the same pair for its session-only override, so no new plumbing exists below the renderer. The model library is desktop-global; the pick is per agent.

### Credentials are per agent

Each profile has its own `.env` and `auth.json`, so a provider the agent has no key for fails at runtime; the Profile tab runs the per-profile config health check after each pick and offers an inline key field.

When the check reports `MODEL_KEY_MISSING` the field saves the reported key into this agent's `.env` through `setEnv` and re-checks. The check already accounts for OAuth credentials, credential vaults and compatible-endpoint fallbacks. OAuth providers must be connected from Providers with that agent active. A failed check never blocks the picker.

## Tests

Renderer tests mock `useI18n`, the model hook and the picker so they assert persistence and the key flow, not dropdown mechanics.

### Model pick persists to the agent

The hook is bound to the given profile id and a selection calls `selectModel` with `persist: true`; a clean health check shows no key field; a `MODEL_KEY_MISSING` issue shows the field and saving writes that key for that agent; a failed check still renders the picker.
````

- [ ] **Step 3: Index and cross-reference**

In `lat.md/lat.md`, add two bullets to the list (after `[[mcp-servers]]`):

```markdown
- [[memory]] — the five per-agent memory systems, the editability boundary, the read-only cross-agent overview, and the two-level write protection that replaces a lock Node cannot take.
- [[agent-settings]] — the profile modal as the per-agent home: tabs, the per-agent model/provider pin with its inline credential check, and the vault link.
```

In `lat.md/chat-commands.md:118`, after the sentence ending `so their output reads as a reply.` append:

```markdown
`/memory` prints the active agent's five memory systems — entries, user-profile fill, session counts, provider and vault — matching the inventory in [[memory]].
```

- [ ] **Step 4: Tag the tests**

Add exactly one `// @lat:` comment above the top-level `describe` in each file. Confirm each id with `npx --yes lat.md locate "<leaf heading>"` and use the full id it prints if it differs.

| File | Comment |
| --- | --- |
| `src/main/memory-write.test.ts` | `// @lat: [[memory#Memory#Tests#Compare-and-swap protocol]]` |
| `src/main/memory-writers.test.ts` | `// @lat: [[memory#Memory#Tests#Writers refuse stale edits]]` |
| `src/main/active-memory-provider.test.ts` | `// @lat: [[memory#Memory#Tests#Provider path is read, not scanned]]` |
| `src/main/memory-session.test.ts` | `// @lat: [[memory#Memory#Tests#Named profile sessions]]` |
| `src/main/memory-contract.test.ts` | `// @lat: [[memory#Memory#Tests#Five-system contract]]` |
| `src/main/agents-memory.test.ts` | `// @lat: [[memory#Memory#Tests#Cross-agent summary]]` |
| `src/main/remove-env.test.ts` | `// @lat: [[memory#Memory#Tests#Unlinking removes the variable]]` |
| `src/renderer/src/screens/Memory/MemorySystems.test.tsx` | `// @lat: [[memory#Memory#Tests#Inventory rendering]]` |
| `src/renderer/src/screens/Memory/MemoryVault.test.tsx` | `// @lat: [[memory#Memory#Tests#Vault pane]]` |
| `src/renderer/src/screens/Memory/MemoryEntries.test.tsx` | `// @lat: [[memory#Memory#Tests#Entry editor sends expectations]]` |
| `src/renderer/src/screens/Memory/MemoryProfile.test.tsx` | `// @lat: [[memory#Memory#Tests#Profile editor keeps the draft]]` |
| `src/renderer/src/screens/Memory/Memory.test.tsx` | `// @lat: [[memory#Memory#Tests#Overview rows]]` |
| `src/renderer/src/components/profile/ProfileModelPicker.test.tsx` | `// @lat: [[agent-settings#Agent Settings#Tests#Model pick persists to the agent]]` |

- [ ] **Step 5: Validate the docs**

Run: `npx --yes lat.md check`
Expected: `All checks passed`. A broken source link means a symbol name in the doc does not match the code — fix the doc, not the code. A leading-paragraph error means a heading's first paragraph exceeds 250 characters — shorten it.

- [ ] **Step 6: Full verification**

Invoke `superpowers:verification-before-completion`, then:

Run: `npm run typecheck && npx eslint --cache . && npx vitest run 2>&1 | tail -20`
Expected: typecheck clean; lint clean; every failure is in the baseline list you recorded in Task 0. Anything else is yours — fix it before continuing.

- [ ] **Step 7: Verify in the running app**

Run `npm run dev > /tmp/hermes-dev.log 2>&1 &` (do not pipe through `tail`; it buffers and looks hung). The Electron window may open on a secondary display at negative X. Get its bounds:

```bash
PID=$(pgrep -f "Electron.app/Contents/MacOS/Electron \." | head -1)
osascript -e "tell application \"System Events\" to tell (first process whose unix id is $PID) to return position of window 1 & size of window 1"
# then, using the printed x, y, w, h:
screencapture -x -R<x>,<y>,<w>,<h> /tmp/hermes-memory.png
```

Confirm the PID is the current Electron, not a stale one. Check and note the result of each under **Execution log → App check**:

1. Memory screen lists every agent, including `web-wizard-agent` as an empty (not failed) row.
2. Selecting an agent opens Agent Settings at the Memory tab with five rows.
3. User Profile shows no session count; Session Search does.
4. A near-full store reads "At capacity…" in neutral colour.
5. Profile tab shows the model picker; picking a model for a non-active agent changes that agent's `config.yaml` (`grep -A3 '^model:' ~/.hermes/profiles/<id>/config.yaml`).
6. Vault row: Choose folder writes `OBSIDIAN_VAULT_PATH` to that agent's `.env`.

Stop the dev server when done (`kill $PID`).

- [ ] **Step 8: Commit**

```bash
git add lat.md/ src/main/*.test.ts src/renderer/src/screens/Memory/*.test.tsx src/renderer/src/components/profile/*.test.tsx docs/superpowers/plans/2026-09-02-memory-per-agent.md
git commit -m "docs: document the five memory systems, write protection, and Agent Settings"
```

---

### Task 13: Finish the branch

**Files:** none.

- [ ] **Step 1: Invoke `superpowers:finishing-a-development-branch`**

Follow it. The expected outcome is a pull request against `main`. Suggested command once the skill has verified the tree:

```bash
git push -u origin feat/agent-settings-memory
gh pr create --base main --title "Agent Settings: memory, model and vault per agent" --body "$(cat <<'EOF'
## Summary
- Agent Settings (the profile modal) becomes the one place an agent's memory, LLM model/provider and Obsidian vault are read and edited
- Memory tab shows all five memory systems with honest editability badges; the top-level Memory screen becomes a read-only cross-agent overview
- Every desktop memory write is protected twice: compare-and-swap at write time and an expected-content check at edit time; a conflict fails and reloads, never overwrites
- Fixes getActiveMemoryProvider reporting the LLM provider as the memory provider, and SSH deletes always reporting failure

Spec: docs/superpowers/specs/2026-09-02-memory-screen-design.md
Plan: docs/superpowers/plans/2026-09-02-memory-per-agent.md

## Test plan
- [ ] `npm run typecheck` clean
- [ ] `npx eslint --cache .` clean
- [ ] `npx vitest run` — no failures outside the recorded baseline
- [ ] `npx --yes lat.md check` — All checks passed
- [ ] App check items 1–6 in Task 12 ticked

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Update the Progress table**

Set Task 13 to `done` with the PR URL in the Commit column, commit the plan file, and push.

---

## Self-review against the spec

Checked while writing; recorded here so the executor knows what was deliberately decided.

- **Spec coverage.** Five systems → Tasks 5, 7. Editability badges and neutral capacity → Task 7. Agent Settings naming and Memory tab → Task 9. Model/provider pin and credential check → Task 11. Overview, SSH-aware, hidden only in HTTP remote mode → Tasks 6, 10. Two-level write protection, SSH twins, `removeMemoryEntry` → `WriteResult` → Tasks 1, 2, 8. Provider regex and Active badge → Task 3. `/memory` → Task 5. Vault → Tasks 5, 7. Error handling (per-system isolation, vault warning, health-check failure not blocking) → Tasks 5, 7, 11. Docs → Task 12.
- **Deliberate simplifications.** Over SSH, `provider.installed` is reported `true` because the remote plugin directory is not cheaply reachable; the row therefore never shows a false "not installed" warning remotely.
- **Type consistency.** `WriteResult`/`Mutation` (Task 1) are the only result types; every writer, SSH twin, IPC handler and preload signature uses `{ success, error?, conflict? }`. `SessionMemory` (Task 4) is embedded unchanged in `MemoryInfo` (Task 5), `MemoryData` (Task 5) and the SSH reader. `AgentMemorySummary` (Task 6) is copied verbatim into the renderer types and the preload. `relativeTime` is defined once in `MemorySystems.tsx` (Task 7) and imported by `Memory.tsx` (Task 10).

## Execution log

The executor writes here. Keep entries short and dated.

### Baseline

_(Task 0, Step 3: list the test files that failed on the untouched tree.)_

### App check

_(Task 12, Step 7: one line per item, pass or what was seen.)_

### Blockers and notes

_(Anything that stopped a task, or was noticed and deliberately left alone.)_

### Baseline (Task 0, 2026-09-02)

Recorded on `feat/agent-settings-memory` at `25d1fc3` + the lockfile commit.

- `npm run typecheck`: clean.
- `npx vitest run`: **2 files / 7 tests failed** — `tests/gateway-restart.test.ts`
  and `tests/terminal-launcher.test.ts`. Everything else passed (1906 passed,
  3 skipped). These two are the handover's known pre-existing failures.
- A first full run under load also failed `src/renderer/src/components/AgentMarkdown.test.tsx`
  on a 5s timeout; it passes in isolation and did not recur. Load flake, not a baseline failure.

### Task 4 — test adapted to the repo's sqlite mock

The plan's Task 4 test seeded a real `better-sqlite3` database. That cannot run
here: `postinstall` runs `electron-builder install-app-deps`, so the native
binding is built for Electron's ABI (NODE_MODULE_VERSION 140) and vitest, on
plain Node (127), refuses to load it. Every other db-touching test in the repo
mocks the module for the same reason (`tests/db.test.ts`).

The test now mocks `better-sqlite3` with a constructible fake serving one row
per database path, and keeps all three original assertions plus one that the
handle is opened `{ readonly: true }` and closed. Note for later tasks: a
vitest 4 mock must use the `function` keyword to be constructible.
