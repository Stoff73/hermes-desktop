import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "fs";
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

  // The health check that drives the "Local gateway key not set" banner only
  // looks at the profile's own sources. Provisioning used to accept the
  // default profile's key as "usable" and write nothing, so every new agent
  // chatted fine (the gateway inherited the default key) while the banner
  // insisted no key was set.
  it("mints a per-profile key instead of inheriting the default profile's", () => {
    writeFileSync(envFile, "API_SERVER_KEY=default-profile-key-long-enough\n");
    const profileDir = join(home, "profiles", "poe2");
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(join(profileDir, ".env"), "# per-profile secrets\n");
    mod.invalidateSecretsCache();
    try {
      const { key, created } = mod.ensureLocalApiServerKey("poe2");
      expect(created).toBe(true);
      expect(key).not.toBe("default-profile-key-long-enough");
      expect(readFileSync(join(profileDir, ".env"), "utf-8")).toContain(
        `API_SERVER_KEY=${key}`,
      );
    } finally {
      rmSync(profileDir, { recursive: true, force: true });
    }
  });

  it("replaces a placeholder key", () => {
    writeFileSync(envFile, "API_SERVER_KEY=changeme\n");
    mod.invalidateSecretsCache();
    const { key, created } = mod.ensureLocalApiServerKey();
    expect(created).toBe(true);
    expect(key).not.toBe("changeme");
  });
});
