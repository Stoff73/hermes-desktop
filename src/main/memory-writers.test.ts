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

// @lat: [[memory#Memory#Tests#Writers refuse stale edits]]
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
