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
    expect((readMemory() as unknown as Record<string, unknown>).stats).toBeUndefined();
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
