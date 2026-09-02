import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const home = mkdtempSync(join(tmpdir(), "hermes-sess-"));
process.env.HERMES_HOME = home;

// better-sqlite3 is built against Electron's ABI in this repo, so vitest cannot
// load the real module — every db-touching test mocks it (see tests/db.test.ts).
// The fake serves one row per database path, which is all the reader asks for.
const { rows, opened, closed } = vi.hoisted(() => ({
  rows: new Map<string, { s: number; m: number; t: number | null }>(),
  opened: [] as { path: string; options: unknown }[],
  closed: { count: 0 },
}));

vi.mock("better-sqlite3", () => ({
  default: vi
    .fn()
    .mockImplementation(function (path: string, options: unknown) {
      opened.push({ path, options });
      return {
        prepare: () => ({ get: () => rows.get(path) }),
        close: () => {
          closed.count += 1;
        },
      };
    }),
}));

function seed(
  dbPath: string,
  sessions: number,
  messages: number,
  last: number,
): void {
  writeFileSync(dbPath, ""); // existsSync gates the read
  // started_at is REAL (unix seconds, possibly fractional) in the real schema.
  rows.set(dbPath, { s: sessions, m: messages, t: last + 0.5 });
}

let readSessionMemory: typeof import("./memory-session").readSessionMemory;

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
    // The named profile's own database, not the active profile's cached one.
    expect(opened.at(-1)?.path).toBe(
      join(home, "profiles", "myrtle", "state.db"),
    );
  });

  it("opens read-only and closes the handle", () => {
    const before = closed.count;
    readSessionMemory("myrtle");
    expect(opened.at(-1)?.options).toEqual({ readonly: true });
    expect(closed.count).toBe(before + 1);
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
