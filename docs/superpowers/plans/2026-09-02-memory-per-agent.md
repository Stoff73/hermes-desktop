# Memory: per-agent settings and cross-agent overview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all four of the agent's memory systems per agent, move memory/persona/providers into per-agent settings, turn the top-level Memory screen into a read-only cross-agent overview, and stop desktop memory writes from silently losing the agent's concurrent edits.

**Architecture:** The storage layer is already per-profile; the UI is what pretends otherwise. Extend `MemoryInfo` from two markdown files to four systems, add per-profile readers that do not disturb the cached active-profile SQLite connection, render the inventory in per-agent settings while the overview renders its own compact read-only rows, and route every desktop memory write through a compare-and-swap that reports conflicts instead of overwriting.

**Tech Stack:** Electron + TypeScript, React renderer, `better-sqlite3`, Vitest, `lat.md` for docs.

**Spec:** `docs/superpowers/specs/2026-09-02-memory-screen-design.md`

## Global Constraints

- Node has **no** `flock`. Never add a native locking addon; concurrency is compare-and-swap only.
- A memory write must **never** overwrite a file that changed since it was read. Failing is correct; overwriting is not.
- New user-facing strings go in `src/shared/i18n/locales/en/*.ts` only. `t()` falls back to English for other locales, so English-only additions are safe.
- Read another profile's `state.db` with a short-lived read-only connection, closed in `finally`. Never route it through `getDbConnection()`, which caches one connection for the active profile.
- Every system reads independently; one unavailable system must not blank a surface.
- Persona/`SOUL.md` is a context file, not a memory system. It keeps its own section and never joins the inventory.
- `npm run typecheck` and `npx --yes lat.md check` must pass before the final commit.
- Run tests with `npx vitest run <path>`.
- `listProfiles()` in `src/main/profiles.ts:176` is **async** (`Promise<ProfileInfo[]>`). Anything consuming it is async too.
- Every SSH twin of a changed writer must change with it. `src/main/ipc/register.ts` branches to `ssh*` variants, so a renderer in SSH mode gets the SSH return type, not the local one.
- New class names need styles in `src/renderer/src/assets/main.css` in the same task. An unstyled `<button>` row is not a finished component.
- Renderer tests mock `useI18n` so `t()` returns the key (see `ConfigHealthBanner.test.tsx:8-13`). Never assert English copy.

---

### Task 1: Compare-and-swap writes for memory files

**Files:**

- Create: `src/main/memory-write.ts`
- Test: `src/main/memory-write.test.ts`

**Interfaces:**

- Consumes: `safeWriteFile` from `./utils`.
- Produces: `WriteResult` (`{ success: boolean; error?: string; conflict?: boolean }`), `readCurrent(filePath: string): string`, `mutateMemoryFile(filePath: string, mutate: (current: string) => { content: string } | { error: string }): WriteResult`. Tasks 2 and 5 depend on these exact names.

- [ ] **Step 1: Write the failing test**

```ts
// src/main/memory-write.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readCurrent, mutateMemoryFile } from "./memory-write";

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
    expect(r.success).toBe(true);
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
    // Second attempt read the agent's content, so its work is preserved.
    expect(readFileSync(file, "utf-8")).toBe("agent-wrote-mine");
  });

  it("fails with conflict rather than overwriting when it keeps losing", () => {
    const r = mutateMemoryFile(file, (cur) => {
      writeFileSync(file, "agent-" + Math.random()); // changes every attempt
      return { content: cur + "-mine" };
    });
    expect(r.success).toBe(false);
    expect(r.conflict).toBe(true);
    expect(readFileSync(file, "utf-8")).toMatch(/^agent-/); // never clobbered
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/memory-write.test.ts`
Expected: FAIL — cannot resolve `./memory-write`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/memory-write.ts
import { existsSync, readFileSync } from "fs";
import { safeWriteFile } from "./utils";

export interface WriteResult {
  success: boolean;
  error?: string;
  /** The file changed underneath us; nothing was written. */
  conflict?: boolean;
}

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

/**
 * Read-modify-write a memory file without clobbering a concurrent writer.
 *
 * Node exposes no flock, so we cannot join the agent's fcntl lock on
 * `<file>.lock`. Instead we confirm the on-disk bytes still match what the
 * mutation was computed from, immediately before the atomic rename. A losing
 * attempt re-reads and retries once — that picks up the agent's write and
 * reapplies the caller's change on top. A second loss fails as a conflict; it
 * must never fall back to an unconditional write.
 */
export function mutateMemoryFile(
  filePath: string,
  mutate: (current: string) => { content: string } | { error: string },
): WriteResult {
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = readCurrent(filePath);
    const result = mutate(current);
    if ("error" in result) return { success: false, error: result.error };
    if (readCurrent(filePath) !== current) continue; // lost the race, retry
    try {
      safeWriteFile(filePath, result.content);
    } catch (err) {
      // writeMemoryRaw's callers (agent-sync cloud pull) expect a result, not a
      // throw — preserve that for every writer routed through here.
      return { success: false, error: (err as Error).message };
    }
    return { success: true };
  }
  return { success: false, conflict: true, error: MEMORY_CONFLICT_ERROR };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/memory-write.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/memory-write.ts src/main/memory-write.test.ts
git commit -m "feat(memory): compare-and-swap writes that report conflicts instead of overwriting"
```

---

### Task 2: Route every memory writer through the CAS

**Files:**

- Modify: `src/main/memory.ts` (`addMemoryEntry`, `updateMemoryEntry`, `removeMemoryEntry`, `writeUserProfile`, `writeMemoryRaw`)
- Test: `src/main/memory-writers.test.ts`

**Interfaces:**

- Consumes: `mutateMemoryFile`, `WriteResult` from Task 1.
- Produces: all five writers return `WriteResult`. **`removeMemoryEntry` changes from `boolean` to `WriteResult`** — Tasks 5 and 9 depend on that.

- [ ] **Step 1: Write the failing test**

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

let mod: typeof import("./memory");
beforeAll(async () => {
  mkdirSync(join(home, "memories"), { recursive: true });
  mod = await import("./memory");
});
beforeEach(() => writeFileSync(memFile, "first"));
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("memory writers", () => {
  it("appends an entry with the § delimiter", () => {
    expect(mod.addMemoryEntry("second").success).toBe(true);
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
    expect(r.error).toBeTruthy();
  });

  it("still enforces the char limit", () => {
    const r = mod.addMemoryEntry("x".repeat(5000));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/limit/i);
    expect(readFileSync(memFile, "utf-8")).toBe("first");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/memory-writers.test.ts`
Expected: FAIL — `removeMemoryEntry` returns `true`, not `{ success: true }`.

- [ ] **Step 3: Write minimal implementation**

Add the import at the top of `src/main/memory.ts`:

```ts
import { mutateMemoryFile, type WriteResult } from "./memory-write";
```

Replace the five writers. Each computes from the `current` string the CAS hands it, so a retry recomputes against the agent's newer content:

```ts
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
): WriteResult {
  const limits = readMemoryLimits(profile);
  return mutateMemoryFile(memoryPath(profile), (current) => {
    const entries = parseMemoryEntries(current);
    if (index < 0 || index >= entries.length)
      return { error: "Entry not found" };
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
): WriteResult {
  return mutateMemoryFile(memoryPath(profile), (current) => {
    const entries = parseMemoryEntries(current);
    if (index < 0 || index >= entries.length)
      return { error: "Entry not found" };
    entries.splice(index, 1);
    return { content: serializeEntries(entries) };
  });
}

export function writeUserProfile(
  content: string,
  profile?: string,
): WriteResult {
  const limits = readMemoryLimits(profile);
  return mutateMemoryFile(userPath(profile), () => {
    if (content.length > limits.userCharLimit) {
      return {
        error: `Exceeds limit (${content.length}/${limits.userCharLimit} chars)`,
      };
    }
    return { content };
  });
}

export function writeMemoryRaw(content: string, profile?: string): WriteResult {
  return mutateMemoryFile(memoryPath(profile), () => ({ content }));
}
```

- [ ] **Step 4: Normalise the SSH twin**

`src/main/ssh-remote.ts:585` declares `sshRemoveMemoryEntry(...): Promise<boolean>`, and `register.ts` branches to it in SSH mode. Left alone, an SSH delete returns `true`, the renderer reads `result.success` as `undefined`, and **every successful delete shows an error**. Change its signature and returns to `WriteResult`:

```ts
export async function sshRemoveMemoryEntry(
  config: SshConfig,
  index: number,
  profile?: string,
): Promise<WriteResult> {
  // ...existing body; return { success: true } / { success: false, error } in
  // place of the boolean.
}
```

Check the other SSH memory writers (`sshAddMemoryEntry`, `sshUpdateMemoryEntry`, `sshWriteUserProfile`) already return a `{ success, error? }` shape; align any that do not.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/main/memory-writers.test.ts && npm run typecheck:node`
Expected: tests PASS. Typecheck FAILS at `remove-memory-entry` callers expecting `boolean` — fix by returning the `WriteResult` straight through in `src/main/ipc/register.ts`, and update `removeMemoryEntry` in `src/preload/index.ts` and `src/preload/index.d.ts` to `Promise<{ success: boolean; error?: string; conflict?: boolean }>`. Re-run until clean.

- [ ] **Step 6: Commit**

```bash
git add src/main/memory.ts src/main/memory-writers.test.ts src/main/ssh-remote.ts src/main/ipc/register.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat(memory): route all memory writes through the CAS"
```

---

### Task 3: Fix getActiveMemoryProvider reading the LLM provider

**Files:**

- Modify: `src/main/installer.ts:1426-1436`
- Test: `src/main/active-memory-provider.test.ts`

**Interfaces:**

- Consumes: `getYamlPath(content: string, dottedKey: string): string | null` from `./yaml-path`.
- Produces: `getActiveMemoryProvider(profile?: string): string` — unchanged signature, correct value. Task 5 depends on it.

- [ ] **Step 1: Write the failing test**

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

  it("returns empty when there is no config file", () => {
    rmSync(cfg, { force: true });
    expect(getActiveMemoryProvider()).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/active-memory-provider.test.ts`
Expected: FAIL — first test gets `"xai"`, expected `""`.

- [ ] **Step 3: Write minimal implementation**

Replace the body in `src/main/installer.ts`. Add `import { getYamlPath } from "./yaml-path";` if absent.

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/active-memory-provider.test.ts && npm run typecheck:node`
Expected: PASS, 3 tests; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/main/installer.ts src/main/active-memory-provider.test.ts
git commit -m "fix(memory): read memory.provider instead of any provider: line"
```

---

### Task 4: Per-profile session reader

**Files:**

- Create: `src/main/memory-session.ts`
- Test: `src/main/memory-session.test.ts`

**Interfaces:**

- Consumes: `profileHome` from `./utils`.
- Produces: `SessionMemory` (`{ totalSessions: number; totalMessages: number; lastSessionAt: number | null; available: boolean }`) and `readSessionMemory(profile?: string): SessionMemory`. Task 5 embeds this type.

- [ ] **Step 1: Write the failing test**

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
  db.exec("CREATE TABLE sessions (id TEXT PRIMARY KEY, started_at INTEGER)");
  db.exec("CREATE TABLE messages (id INTEGER PRIMARY KEY)");
  for (let i = 0; i < sessions; i++)
    db.prepare("INSERT INTO sessions VALUES (?, ?)").run(`s${i}`, last - i);
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
  it("reads the default profile", () => {
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/memory-session.test.ts`
Expected: FAIL — cannot resolve `./memory-session`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/memory-session.ts
import { existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { profileHome } from "./utils";

export interface SessionMemory {
  totalSessions: number;
  totalMessages: number;
  /** Unix seconds of the most recent session, or null. */
  lastSessionAt: number | null;
  /** state.db exists and could be read. */
  available: boolean;
}

const UNAVAILABLE: SessionMemory = {
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
  if (!existsSync(dbPath)) return UNAVAILABLE;

  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    const counts = db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM sessions) AS s, (SELECT COUNT(*) FROM messages) AS m",
      )
      .get() as { s: number; m: number };
    const last = db
      .prepare("SELECT MAX(started_at) AS t FROM sessions")
      .get() as { t: number | null };
    return {
      totalSessions: counts?.s ?? 0,
      totalMessages: counts?.m ?? 0,
      lastSessionAt: last?.t ?? null,
      available: true,
    };
  } catch (err) {
    console.error("[memory] readSessionMemory failed:", err);
    return UNAVAILABLE;
  } finally {
    db?.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/memory-session.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/memory-session.ts src/main/memory-session.test.ts
git commit -m "feat(memory): per-profile session reader that bypasses the active-profile cache"
```

---

### Task 5: Extend the MemoryInfo contract to four systems

**Files:**

- Modify: `src/main/memory.ts` (`MemoryInfo`, `readMemory`; delete `getSessionStats`)
- Modify: `src/main/ssh-remote.ts:505-534` (`sshReadMemory`)
- Modify: `src/preload/index.ts:1027`, `src/preload/index.d.ts:745`
- Modify: `src/renderer/src/screens/Memory/types.ts`
- Test: `src/main/memory-contract.test.ts`

**Interfaces:**

- Consumes: `readSessionMemory`/`SessionMemory` (Task 4), `getActiveMemoryProvider` (Task 3).
- Produces: `MemoryInfo` gains `sessions: SessionMemory` and `provider: ProviderMemory` (`{ active: string | null; installed: boolean }`) and **loses `stats`**. Tasks 6, 7, 8, 9, 10 consume this shape.

- [ ] **Step 1: Write the failing test**

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
  it("returns all four systems", () => {
    const d = readMemory();
    expect(d.memory.entries).toHaveLength(2);
    expect(d.user.exists).toBe(false); // USER.md absent is an empty state
    expect(d.sessions.available).toBe(false); // no state.db in this scratch home
    expect(d.provider.active).toBe("mem0");
  });

  it("coerces a deactivated provider to null, not an empty string", () => {
    writeFileSync(join(home, "config.yaml"), 'memory:\n  provider: ""\n');
    expect(readMemory().provider.active).toBeNull();
  });

  it("no longer exposes stats", () => {
    expect((readMemory() as Record<string, unknown>).stats).toBeUndefined();
  });

  it("survives a profile with no memories directory", () => {
    const d = readMemory("web-wizard-agent");
    expect(d.memory.entries).toEqual([]);
    expect(d.memory.exists).toBe(false);
    expect(d.sessions.available).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/memory-contract.test.ts`
Expected: FAIL — `d.sessions` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `src/main/memory.ts`: delete `getSessionStats` and its `better-sqlite3` import, add

```ts
import { readSessionMemory, type SessionMemory } from "./memory-session";
import { getActiveMemoryProvider, discoverMemoryProviders } from "./installer";
```

then replace the `stats` field on `MemoryInfo` and the `readMemory` return:

```ts
export interface ProviderMemory {
  /** memory.provider from config.yaml, or null when built-in only. */
  active: string | null;
  /** The active provider's plugin is present in this installation. */
  installed: boolean;
}

export interface MemoryInfo {
  memory: {
    /* unchanged */
  };
  user: {
    /* unchanged */
  };
  sessions: SessionMemory;
  provider: ProviderMemory;
}

function readProviderMemory(profile?: string): ProviderMemory {
  try {
    // `|| null` matters: MemoryProviders.handleDeactivate writes
    // `memory.provider: ""`, and `"" ?? fallback` renders an empty string.
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
```

and in `readMemory`, replace `stats: getSessionStats(profile)` with:

```ts
    sessions: readSessionMemory(profile),
    provider: readProviderMemory(profile),
```

In `src/main/ssh-remote.ts#sshReadMemory`, replace the `stats,` line with:

```ts
    sessions: {
      ...stats,
      // Not cheaply available over SSH; the UI treats null as "unknown".
      lastSessionAt: null,
      available: true,
    },
    provider: {
      // ssh-remote.ts does not import getYamlPath (it has its own locateInYaml);
      // use the existing remote config reader instead.
      active: (await sshGetConfigValue(config, "memory.provider", profile)) || null,
      installed: false,
    },
```

Mirror the same fields in `src/preload/index.ts` `readMemory`, `src/preload/index.d.ts:745`, and `src/renderer/src/screens/Memory/types.ts` (`MemoryData`): drop `stats`, add `sessions` and `provider`.

- [ ] **Step 4: Remove the last two `stats` readers in the same commit**

`stats` has exactly two consumers and both must go now, or typecheck stays red across commits:

- Delete `src/renderer/src/screens/Memory/CapacityCards.tsx` and its import and `<CapacityCards data={data} />` usage in `Memory.tsx`. Task 8 builds its replacement; the screen renders without a summary in between, which is fine because Task 10 rewrites it anyway.
- Delete the now-orphaned `.memory-capacity-card`, `.memory-capacity-card-header`, `.memory-capacity-card-footer` and `.memory-capacity-grid` rules from `src/renderer/src/assets/main.css`. Keep `.memory-capacity`, `.memory-capacity-track` and `.memory-capacity-fill` — `CapacityBar` still uses them.
- Task 6 (next) fixes `useLocalCommands.ts`. Do Task 6 before committing if you want a green tree at every commit.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/main/memory-contract.test.ts && npm run typecheck`
Expected: contract tests PASS; typecheck clean once Task 6 has landed.

- [ ] **Step 6: Commit**

```bash
git add src/main/memory.ts src/main/memory-session.ts src/main/ssh-remote.ts src/preload/index.ts src/preload/index.d.ts src/renderer/src/screens/Memory/ src/renderer/src/assets/main.css src/main/memory-contract.test.ts
git rm src/renderer/src/screens/Memory/CapacityCards.tsx
git commit -m "feat(memory): expand MemoryInfo to sessions and provider, drop stats"
```

---

### Task 6: Migrate the /memory slash command

**Files:**

- Modify: `src/renderer/src/screens/Chat/hooks/useLocalCommands.ts:63-77`
- Modify: `src/shared/i18n/locales/en/memory.ts`

**Interfaces:**

- Consumes: `MemoryInfo` from Task 5.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Replace the command body**

The command currently prints `mem.stats.totalSessions`, which no longer exists. Replace the `/memory` case body with:

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
          addAgentMessage(lines.join("\n"));
          return true;
        }
```

- [ ] **Step 2: Add the two new strings**

In `src/shared/i18n/locales/en/memory.ts`, inside the default export:

```ts
  sessionsUnavailable: "No sessions recorded yet",
  providerBuiltIn: "Built-in only",
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck:web`
Expected: no errors from `useLocalCommands.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/Chat/hooks/useLocalCommands.ts src/shared/i18n/locales/en/memory.ts
git commit -m "feat(memory): /memory reports all four systems"
```

---

### Task 7: Cross-agent memory summary reader and IPC

**Files:**

- Create: `src/main/agents-memory.ts`
- Modify: `src/main/ipc/register.ts` (memory IPC block, ~line 2367)
- Modify: `src/preload/index.ts`, `src/preload/index.d.ts`
- Test: `src/main/agents-memory.test.ts`

**Interfaces:**

- Consumes: `readMemory` (Task 5), `listProfiles` from `./profiles`.
- Produces: `AgentMemorySummary` (`{ id: string; name: string; isActive: boolean; memoryChars: number; memoryLimit: number; memoryEntries: number; userChars: number; userLimit: number; totalSessions: number; lastSessionAt: number | null; provider: string | null; available: boolean }`) and `readAllAgentsMemory(): Promise<AgentMemorySummary[]>`, exposed as `window.hermesAPI.readAllAgentsMemory()`. Task 10 renders it.
- **`listProfiles` is async** (`profiles.ts:176`). This reader, its IPC handler and its test mock are all async; a sync `.map()` over it does not typecheck.

- [ ] **Step 1: Write the failing test**

```ts
// src/main/agents-memory.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./profiles", () => ({
  // Mirrors the real async signature — a sync mock lets a broken impl pass.
  listProfiles: vi.fn(async () => [
    { id: "default", name: "Hermes One", isActive: true },
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
      memoryChars: 512,
      memoryEntries: 1,
      userChars: 1363,
      totalSessions: 22,
      provider: "mem0",
      available: true,
    });
  });

  it("marks an unreadable agent unavailable instead of throwing", async () => {
    const d = (await readAllAgentsMemory())[1];
    expect(d.id).toBe("myrtle");
    expect(d.available).toBe(false);
    expect(d.memoryChars).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/main/agents-memory.test.ts`
Expected: FAIL — cannot resolve `./agents-memory`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/main/agents-memory.ts
import { listProfiles } from "./profiles";
import { readMemory } from "./memory";

export interface AgentMemorySummary {
  id: string;
  name: string;
  isActive: boolean;
  memoryChars: number;
  memoryLimit: number;
  memoryEntries: number;
  userChars: number;
  userLimit: number;
  totalSessions: number;
  lastSessionAt: number | null;
  provider: string | null;
  /** False when this agent's stores could not be read at all. */
  available: boolean;
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
    const base = { id: p.id, name: p.name, isActive: p.isActive };
    try {
      const m = readMemory(p.id);
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
        available: true,
      };
    } catch (err) {
      console.error(`[memory] summary failed for ${p.id}:`, err);
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
        available: false,
      };
    }
  });
}
```

Register the IPC beside the other memory handlers in `src/main/ipc/register.ts` (import `readAllAgentsMemory`). It is local-only — the overview lists local profiles:

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
        const base = { id: p.id, name: p.name, isActive: p.isActive };
        try {
          const m = await sshReadMemory(remote, p.id);
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
            available: true,
          };
        } catch {
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
            available: false,
          };
        }
      }),
    );
  }
  return readAllAgentsMemory();
});
```

Add to `src/preload/index.ts`:

```ts
  readAllAgentsMemory: (): Promise<
    Array<{
      id: string; name: string; isActive: boolean;
      memoryChars: number; memoryLimit: number; memoryEntries: number;
      userChars: number; userLimit: number;
      totalSessions: number; lastSessionAt: number | null;
      provider: string | null; available: boolean;
    }>
  > => ipcRenderer.invoke("read-all-agents-memory"),
```

Mirror the same signature in `src/preload/index.d.ts`.

- [ ] **Step 4: Run test and typecheck**

Run: `npx vitest run src/main/agents-memory.test.ts && npm run typecheck`
Expected: PASS, 3 tests; typecheck clean. Before writing the SSH branch, confirm `sshListProfiles`'s return shape actually carries `id`/`name`/`isActive`; map it rather than assuming.

- [ ] **Step 5: Commit**

```bash
git add src/main/agents-memory.ts src/main/agents-memory.test.ts src/main/ipc/register.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat(memory): cross-agent memory summary reader and IPC"
```

---

### Task 8: The systems inventory component

**Files:**

- Create: `src/renderer/src/screens/Memory/MemorySystems.tsx`
- Create: `src/renderer/src/screens/Memory/MemorySystems.test.tsx`
- Delete: `src/renderer/src/screens/Memory/CapacityCards.tsx`
- Modify: `src/shared/i18n/locales/en/memory.ts`

**Interfaces:**

- Consumes: `MemoryData` (Task 5), existing `MemoryEntries`, `MemoryProfile`, `MemoryProviders`.
- Produces: `<MemorySystems data profile providers onRefresh />`. Task 9 mounts it. Task 10 does **not** — the overview renders its own compact rows, so there is no read-only mount and no `readOnly` prop anywhere.

- [ ] **Step 1: Add the strings**

In `src/shared/i18n/locales/en/memory.ts`:

```ts
  systemsTitle: "Memory systems",
  editable: "Editable",
  readOnly: "Read-only",
  atCapacity: "At capacity — the agent consolidates on the next write",
  configurable: "Configurable",
  nextSessionNote: "Takes effect in this agent's next session.",
  sessionSearch: "Session Search",
  sessionSearchDesc: "Every past conversation, searchable. Written automatically.",
  agentMemoryDesc: "Curated notes the agent keeps about your environment.",
  userProfileDesc: "Who you are — name, role, preferences.",
  providerDesc: "An external memory backend, running alongside built-in memory.",
  sessionsAndMessages: "{{sessions}} sessions · {{messages}} messages",
  providerBuiltIn: "Built-in only",
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/renderer/src/screens/Memory/MemorySystems.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemorySystems } from "./MemorySystems";
import type { MemoryData } from "./types";

// Matches the repo convention (see ConfigHealthBanner.test.tsx): t() returns the
// key, so assertions never depend on English copy.
vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

const data: MemoryData = {
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
};

describe("MemorySystems", () => {
  it("lists all four systems", () => {
    render(<MemorySystems data={data} onRefresh={() => {}} />);
    for (const key of ["memory", "user", "sessions", "provider"]) {
      expect(screen.getByTestId(`memory-system-${key}`)).toBeTruthy();
    }
  });

  it("badges each system by what you can actually do to it", () => {
    render(<MemorySystems data={data} onRefresh={() => {}} />);
    expect(screen.getByTestId("memory-system-memory").textContent).toContain(
      "memory.editable",
    );
    // Written entirely by the agent.
    expect(screen.getByTestId("memory-system-sessions").textContent).toContain(
      "memory.readOnly",
    );
    // You choose and configure the backend but cannot read or write its store.
    // Badging this "read-only" beside its own Activate button would be a new lie.
    expect(screen.getByTestId("memory-system-provider").textContent).toContain(
      "memory.configurable",
    );
  });

  it("captions a near-full store as consolidating and does not paint it red", () => {
    render(<MemorySystems data={data} onRefresh={() => {}} />);
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
    render(<MemorySystems data={data} onRefresh={() => {}} />);
    expect(screen.getByTestId("memory-system-sessions").textContent).toContain(
      "memory.sessionsAndMessages:22,1278",
    );
    expect(screen.getByTestId("memory-system-user").textContent).not.toContain(
      "22",
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/screens/Memory/MemorySystems.test.tsx`
Expected: FAIL — cannot resolve `./MemorySystems`.

- [ ] **Step 4: Implement**

```tsx
// src/renderer/src/screens/Memory/MemorySystems.tsx
import { useState } from "react";
import { Database, User, Search, Cloud } from "lucide-react";
import { useI18n } from "../../components/useI18n";
import { CapacityBar } from "./CapacityBar";
import { MemoryEntries } from "./MemoryEntries";
import { MemoryProfile } from "./MemoryProfile";
import { MemoryProviders } from "./MemoryProviders";
import type { MemoryData, MemoryProviderInfo } from "./types";

type SystemKey = "memory" | "user" | "sessions" | "provider";

interface Props {
  data: MemoryData;
  profile?: string;
  /**
   * From discoverMemoryProviders(profile) — Task 9 must fetch these. An empty
   * array makes MemoryProviders render "No memory providers found in this
   * installation", so this is deliberately required, not optional.
   */
  providers: MemoryProviderInfo[];
  onRefresh: () => void;
}

const NEAR_FULL = 0.9;

export function MemorySystems({
  data,
  profile,
  providers,
  onRefresh,
}: Props): React.JSX.Element {
  const { t } = useI18n();
  const [open, setOpen] = useState<SystemKey | null>("memory");

  const rows: {
    key: SystemKey;
    Icon: typeof Database;
    label: string;
    desc: string;
    /** What you can actually do to this system, already localised. */
    badge: string;
    bounded: boolean;
    used: number;
    limit: number;
    metric: React.ReactNode;
    detail: React.ReactNode;
  }[] = [
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
      metric: (
        <span>
          {data.sessions.available
            ? t("memory.sessionsAndMessages", {
                sessions: data.sessions.totalSessions,
                messages: data.sessions.totalMessages,
              })
            : t("memory.sessionsUnavailable")}
        </span>
      ),
      detail: (
        <div className="memory-system-detail-note">
          {t("memory.sessionSearchDesc")}
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
        <span>{data.provider.active ?? t("memory.providerBuiltIn")}</span>
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
  ];

  return (
    <div className="memory-systems">
      {rows.map((r) => {
        const nearFull =
          r.bounded && r.limit > 0 && r.used / r.limit >= NEAR_FULL;
        return (
          <div
            className="memory-system"
            key={r.key}
            data-testid={`memory-system-${r.key}`}
          >
            <button
              className="memory-system-head"
              onClick={() => setOpen(open === r.key ? null : r.key)}
            >
              <r.Icon size={15} />
              <span className="memory-system-label">{r.label}</span>
              <span className="memory-system-desc">{r.desc}</span>
              <span className="memory-system-badge">{r.badge}</span>
              <span className="memory-system-metric">{r.metric}</span>
            </button>
            {nearFull && (
              <div className="memory-system-note">{t("memory.atCapacity")}</div>
            )}
            {open === r.key && (
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

- [ ] **Step 5: Give CapacityBar a neutral tone**

`CapacityBar.tsx:12-14` hard-codes `pct > 90 ? "var(--error)"`, so the spec's "neutral, not a red alarm" is otherwise unimplemented — a caption under a red bar is still a red bar. Add an opt-in prop; existing callers are unchanged:

```tsx
interface CapacityBarProps {
  used: number;
  limit: number;
  label: string;
  /** "neutral" suppresses the error/warning ramp: a bounded curated store at
   *  capacity is normal, and the agent consolidates on the next write. */
  tone?: "ramp" | "neutral";
}

// inside the component, replacing the existing `color`:
const color =
  tone === "neutral"
    ? "var(--accent)"
    : pct > 90
      ? "var(--error)"
      : pct > 70
        ? "var(--warning)"
        : "var(--success)";
```

Default `tone` to `"ramp"` so no other caller changes.

- [ ] **Step 6: Style the new rows**

`grep -c "memory-system" src/renderer/src/assets/main.css` is currently **0** — every class the component uses is new, and without styles the rows render as bare `<button>`s. Add rules for `.memory-systems`, `.memory-system`, `.memory-system-head`, `.memory-system-label`, `.memory-system-desc`, `.memory-system-badge`, `.memory-system-metric`, `.memory-system-note`, `.memory-system-detail`, `.memory-system-detail-note`.

Follow the existing `.memory-tab` and `.memory-capacity-card` rules for spacing, radius and border tokens so the screen still reads as one design.

Then delete `CapacityCards.tsx` and remove its import from `Memory.tsx`.

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run src/renderer/src/screens/Memory/ && npm run typecheck:web`
Expected: PASS; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/screens/Memory/ src/shared/i18n/locales/en/memory.ts src/renderer/src/assets/main.css
git commit -m "feat(memory): systems inventory replaces the capacity cards"
```

---

### Task 9: Per-agent settings gains the missing systems

**Files:**

- Modify: `src/renderer/src/components/profile/ProfileModal.tsx:503-520`
- Modify: `src/renderer/src/components/profile/ProfileModal.test.tsx:87`
- Modify: `src/renderer/src/screens/Memory/MemoryEntries.tsx` (delete conflict handling)

**Interfaces:**

- Consumes: `MemorySystems` (Task 8), `WriteResult` (Task 2).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Fix the lying test mock**

`ProfileModal.test.tsx:87` mocks `readMemory` as `{ entries: [] }`, a shape matching no contract. Replace with the real one:

```ts
      readMemory: vi.fn().mockResolvedValue({
        memory: { content: "", exists: false, lastModified: null, entries: [], charCount: 0, charLimit: 2200 },
        user: { content: "", exists: false, lastModified: null, charCount: 0, charLimit: 1375 },
        sessions: { totalSessions: 0, totalMessages: 0, lastSessionAt: null, available: false },
        provider: { active: null, installed: false },
      }),
```

- [ ] **Step 2: Render the inventory in the agentMemory section**

Replace the `section === "agentMemory"` block's `<MemoryEntries …>` with the full inventory for that agent, so User Profile, Session Search and Provider appear alongside Agent Memory:

```tsx
{
  section === "agentMemory" && (
    <>
      {memoryLoading && !memoryData ? (
        <OrbLoader state="searching" size={48} />
      ) : memoryError ? (
        <div className="memory-error">{memoryError}</div>
      ) : memoryData ? (
        <MemorySystems
          data={memoryData}
          profile={profile.id}
          providers={memoryProviders}
          onRefresh={loadMemoryData}
        />
      ) : null}
    </>
  );
}
```

Import `MemorySystems` and drop the now-unused `MemoryEntries` import.

- [ ] **Step 3: Fetch the providers**

`ProfileModal` only calls `readMemory` today (`ProfileModal.tsx:145-156`). `MemorySystems` requires a `providers` array, and an empty one makes `MemoryProviders` render "No memory providers found in this installation" (`MemoryProviders.tsx:72-75`) for **every** agent — silently defeating the per-agent provider requirement. Fetch them alongside the memory read:

```tsx
const [memoryProviders, setMemoryProviders] = useState<MemoryProviderInfo[]>(
  [],
);

const loadMemoryData = useCallback(async (): Promise<void> => {
  if (!profile) return;
  setMemoryLoading(true);
  setMemoryError("");
  try {
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

Import `MemoryProviderInfo` from `../../screens/Memory/types`. Add `discoverMemoryProviders` to the `ProfileModal.test.tsx` `hermesAPI` mock (returning `[]`), or the section throws on mount.

- [ ] **Step 4: Surface write conflicts, and actually reload on one**

`MEMORY_CONFLICT_ERROR` tells the user "your view has been reloaded", but `handleAddEntry` and `handleSaveEdit` (`MemoryEntries.tsx:32-38,49-55`) and `MemoryProfile.handleSave` (`MemoryProfile.tsx:29-36`) call `onRefresh()` only on **success** — so today that message would be a lie. Reload on a `conflict` result in all three:

```ts
    } else {
      setError(result.error || t("memory.addFailed"));
      // The agent moved the file underneath us; reload so the view matches disk.
      if (result.conflict) onRefresh();
    }
```

`MemoryProfile` also seeds its textarea once — `useState(initialContent)` at `MemoryProfile.tsx:18` — with no resync, so a refresh would leave the stale draft on screen. Add an effect resyncing it when the prop changes and the field is not mid-edit.

`handleDeleteEntry` ignores its result — fix it, since `removeMemoryEntry` now returns a `WriteResult`:

```ts
async function handleDeleteEntry(index: number): Promise<void> {
  setError("");
  const result = await window.hermesAPI.removeMemoryEntry(index, profile);
  setConfirmDelete(null);
  if (!result.success) setError(result.error || t("memory.updateFailed"));
  onRefresh();
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/renderer/src/components/profile/ && npm run typecheck:web`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/profile/ProfileModal.tsx src/renderer/src/components/profile/ProfileModal.test.tsx src/renderer/src/screens/Memory/MemoryEntries.tsx
git commit -m "feat(memory): per-agent settings shows all four systems"
```

---

### Task 10: Memory screen becomes a cross-agent overview

**Files:**

- Modify: `src/renderer/src/screens/Memory/Memory.tsx` (rewrite)
- Delete: `src/renderer/src/screens/Memory/MemoryTabs.tsx`
- Create: `src/renderer/src/screens/Memory/Memory.test.tsx`
- Modify: `src/shared/i18n/locales/en/memory.ts`

**Interfaces:**

- Consumes: `readAllAgentsMemory` (Task 7).
- Produces: an `onOpenAgent?: (profileId: string) => void` prop, called when a row is selected.

- [ ] **Step 1: Add the strings**

```ts
  overviewSubtitle: "What each of your agents remembers.",
  agentUnavailable: "Memory could not be read",
  openAgentMemory: "Open agent memory",
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/renderer/src/screens/Memory/Memory.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Memory from "./Memory";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
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
    lastSessionAt: null,
    provider: null,
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
    available: false,
  },
];

beforeEach(() => {
  (window as unknown as { hermesAPI: unknown }).hermesAPI = {
    readAllAgentsMemory: vi.fn().mockResolvedValue(agents),
  };
});

describe("Memory overview", () => {
  it("lists every agent", async () => {
    render(<Memory />);
    await waitFor(() => expect(screen.getByText("Hermes One")).toBeTruthy());
    expect(screen.getByText("Myrtle")).toBeTruthy();
  });

  it("marks an unreadable agent without blanking the list", async () => {
    render(<Memory />);
    await waitFor(() =>
      expect(screen.getByText("memory.agentUnavailable")).toBeTruthy(),
    );
    expect(screen.getByText("Hermes One")).toBeTruthy();
  });

  it("opens the selected agent", async () => {
    const onOpenAgent = vi.fn();
    render(<Memory onOpenAgent={onOpenAgent} />);
    await waitFor(() => screen.getByText("Myrtle"));
    fireEvent.click(screen.getByTestId("memory-agent-myrtle"));
    expect(onOpenAgent).toHaveBeenCalledWith("myrtle");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/screens/Memory/Memory.test.tsx`
Expected: FAIL — `readAllAgentsMemory` is not called; the component still reads a single profile.

- [ ] **Step 4: Rewrite Memory.tsx**

It becomes read-only: load `readAllAgentsMemory()` on mount, render one row per agent with name, active marker, agent-memory and user-profile fill, session count, last activity from `lastSessionAt`, provider (or `t("memory.providerBuiltIn")`), and `t("memory.agentUnavailable")` when `available` is false. Each row has `data-testid={`memory-agent-${id}`}` and calls `onOpenAgent(id)` on click. Keep the refresh button. No editing, no tabs — delete `MemoryTabs.tsx` and its import.

Render `lastSessionAt` or drop it from `SessionMemory` — Task 4 pays for an extra `MAX(started_at)` query per profile, and a value nothing displays is not worth the round trip.

**Change the caller.** `src/renderer/src/screens/Layout/Layout.tsx:965` currently renders `<Memory profile={activeProfile} />`. The `profile` prop is gone; pass `onOpenAgent` instead, wired to the profile modal so a row opens that agent at its memory section:

```tsx
<Memory
  onOpenAgent={(id) => openProfile(id, { initialSection: "agentMemory" })}
/>
```

`initialSection` already exists on the modal (`ProfileModalContext.ts:19`, `ProfileModal.tsx:58,95,101`), so no new plumbing is needed — confirm the exact opener name in `ProfileModalContext` before wiring.

- [ ] **Step 5: Style the overview rows**

`.memory-agent*` classes do not exist in `main.css` either. Add rules for the row, its name, active marker, metrics and unavailable state, following the same tokens as the inventory rows from Task 8.

Wire `onOpenAgent` where `Memory` is mounted so it opens `ProfileModal` for that agent at the `agentMemory` section.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run src/renderer/src/screens/Memory/ && npm run typecheck:web`
Expected: PASS; typecheck clean. Typecheck will catch `Layout.tsx` if you forgot the prop change.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/screens/Memory/ src/renderer/src/screens/Layout/Layout.tsx src/shared/i18n/locales/en/memory.ts src/renderer/src/assets/main.css
git rm src/renderer/src/screens/Memory/MemoryTabs.tsx
git commit -m "feat(memory): Memory screen becomes a cross-agent overview"
```

---

### Task 11: Documentation and full verification

**Files:**

- Create: `lat.md/memory.md`
- Modify: `lat.md/lat.md` (it does index documents — add the new one)
- Modify: `lat.md/chat-commands.md` (documents `/memory`, whose output Task 6 changed)
- Modify: `lat.md/agent-sync.md` if `writeMemoryRaw`'s semantics are described there

**Interfaces:** none.

- [ ] **Step 1: Write lat.md/memory.md**

Every section needs a leading paragraph under 250 characters. Cover, one section each: the four systems and their editability boundary; the two surfaces (per-agent settings writes, overview reads) and why writing lives in exactly one place; per-agent reading and why `getDbConnection`'s active-profile cache is bypassed; the optimistic-concurrency protocol, why it is not an fcntl lock (Node has no `flock`), and that a conflict fails rather than overwrites; that Persona/`SOUL.md` is a context file, not a memory system.

Link the real symbols, e.g. `[[src/main/memory-write.ts#mutateMemoryFile]]`, `[[src/main/memory-session.ts#readSessionMemory]]`, `[[src/main/agents-memory.ts#readAllAgentsMemory]]`.

- [ ] **Step 2: Tag the new tests**

Every existing main-process test carries a `// @lat: [[section]]` comment (e.g. `config-credentials.test.ts:24`), per CLAUDE.md's test-spec convention. Add one to each new test file pointing at the `lat.md/memory.md` section it covers. Get the full id with `npx --yes lat.md locate "<Section Name>"` — a short form may not resolve.

- [ ] **Step 3: Update the docs Task 6 invalidated**

`lat.md/chat-commands.md:118` lists `/memory` among output-producing commands; its output now covers four systems. Update that description, and add `lat.md/memory.md` to the index in `lat.md/lat.md`.

- [ ] **Step 4: Validate the docs**

Run: `npx --yes lat.md check`
Expected: "All checks passed". Fix any broken link by running `npx --yes lat.md locate "<Section Name>"` for the full section id.

- [ ] **Step 5: Full verification**

Run: `npm run typecheck && npx eslint --cache . && npx vitest run`
Expected: typecheck clean, lint clean. Establish the test baseline yourself rather than trusting this document: `git stash -u && npx vitest run; git stash pop`. At the time of writing `tests/gateway-restart.test.ts` and `tests/terminal-launcher.test.ts` failed on a clean tree and appeared flaky, but that is **unverified for your checkout**. Any failure outside your measured baseline is yours.

- [ ] **Step 6: Verify in the running app**

Run `npm run dev`. The Electron window may open on a secondary display — get its bounds with:

```bash
PID=$(pgrep -f "Electron.app/Contents/MacOS/Electron \." | head -1)
osascript -e "tell application \"System Events\" to tell (first process whose unix id is $PID) to return position of window 1 & size of window 1"
```

Check: the Memory screen lists every agent; opening one shows four systems; no card shows a session count against User Profile; a near-full store reads as consolidating rather than failing.

- [ ] **Step 7: Commit**

```bash
git add lat.md/
git commit -m "docs: document the four memory systems and per-agent surfaces"
```
