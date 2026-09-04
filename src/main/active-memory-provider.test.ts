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

// @lat: [[memory#Memory#Tests#Provider path is read, not scanned]]
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
