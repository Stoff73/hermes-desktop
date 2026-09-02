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

// @lat: [[memory#Memory#Tests#Compare-and-swap protocol]]
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
