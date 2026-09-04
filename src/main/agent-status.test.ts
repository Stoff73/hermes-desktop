import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Real files in a temp dir: this module does nothing but read one small JSON,
// so faking fs would test the fake.
const root = mkdtempSync(join(tmpdir(), "agent-status-"));

// The factory is hoisted above `root`, but only ever called after the module
// body has run, so the reference resolves.
vi.mock("./utils", () => ({
  profileHome: (profile?: string) => (profile ? join(root, profile) : root),
}));

import { readAgentRunStatus } from "./agent-status";

function state(profile: string, body: unknown): void {
  const dir = join(root, profile);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "gateway_state.json"), JSON.stringify(body));
}

let livePids: number[] = [];

beforeEach(() => {
  livePids = [];
  vi.spyOn(process, "kill").mockImplementation(((pid: number) => {
    if (!livePids.includes(pid)) throw new Error("ESRCH");
    return true;
  }) as unknown as typeof process.kill);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

// @lat: [[memory#Memory#Tests#Agent run status]]
describe("readAgentRunStatus", () => {
  it("is running only when the recorded pid is still alive", () => {
    state("alive", { gateway_state: "running", pid: 42 });
    livePids = [42];
    expect(readAgentRunStatus("alive")).toEqual({
      state: "running",
      issue: null,
    });
  });

  it("does not believe a running state whose process is gone", () => {
    state("stale", { gateway_state: "running", pid: 42 });
    const status = readAgentRunStatus("stale");
    expect(status.state).toBe("stopped");
    expect(status.issue).toContain("process is gone");
  });

  it("reports the gateway's own exit reason when it stopped", () => {
    state("exited", { gateway_state: "exited", exit_reason: "port in use" });
    expect(readAgentRunStatus("exited")).toEqual({
      state: "stopped",
      issue: "port in use",
    });
  });

  it("treats an agent that never started as stopped, not broken", () => {
    expect(readAgentRunStatus("never")).toEqual({
      state: "stopped",
      issue: null,
    });
  });

  it("says nothing about an agent whose state file is unreadable", () => {
    const dir = join(root, "broken");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "gateway_state.json"), "{ half-written");
    expect(readAgentRunStatus("broken")).toEqual({
      state: "unknown",
      issue: null,
    });
  });
});
