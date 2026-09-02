import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const home = mkdtempSync(join(tmpdir(), "hermes-apikey-"));
process.env.HERMES_HOME = home;
// getApiServerKey resolves process.env first — a stray value would mask .env.
delete process.env.API_SERVER_KEY;

let mod: typeof import("./config");
const envFile = join(home, ".env");

beforeAll(async () => {
  mod = await import("./config");
});

afterEach(() => {
  writeFileSync(envFile, "");
  mod.invalidateSecretsCache();
});

afterAll(() => {
  rmSync(home, { recursive: true, force: true });
});

// @lat: [[main-process#Local api_server key provisioning]]
describe("ensureLocalApiServerKey", () => {
  it("rejects short and placeholder keys", () => {
    expect(mod.isUsableApiServerKey("")).toBe(false);
    expect(mod.isUsableApiServerKey("0123456789abcde")).toBe(false); // 15
    expect(mod.isUsableApiServerKey("changeme")).toBe(false);
    expect(mod.isUsableApiServerKey("0123456789abcdef")).toBe(true); // 16
  });

  it("mints and persists a key when the profile has none", () => {
    const { key, created } = mod.ensureLocalApiServerKey();
    expect(created).toBe(true);
    expect(mod.isUsableApiServerKey(key)).toBe(true);
    expect(readFileSync(envFile, "utf-8")).toContain(`API_SERVER_KEY=${key}`);
  });

  it("keeps an existing usable key untouched", () => {
    writeFileSync(envFile, "API_SERVER_KEY=already-a-good-long-key-here\n");
    mod.invalidateSecretsCache();
    const { key, created } = mod.ensureLocalApiServerKey();
    expect(created).toBe(false);
    expect(key).toBe("already-a-good-long-key-here");
  });

  it("replaces a placeholder key", () => {
    writeFileSync(envFile, "API_SERVER_KEY=changeme\n");
    mod.invalidateSecretsCache();
    const { key, created } = mod.ensureLocalApiServerKey();
    expect(created).toBe(true);
    expect(key).not.toBe("changeme");
  });
});
