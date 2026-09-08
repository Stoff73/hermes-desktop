import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory model of each profile's configured api_server port. `undefined`
// profile is the default. Tests mutate this to set up scenarios.
const { configuredPorts, dirEntries } = vi.hoisted(() => ({
  configuredPorts: new Map<string, string | null>(),
  dirEntries: [] as string[],
}));

vi.mock("../src/main/installer", () => ({
  HERMES_HOME: "/tmp/hermes-test-home",
}));

vi.mock("../src/main/utils", () => {
  const PROFILE_NAME_RE = /^[a-z0-9_][a-z0-9_-]*$/;
  return {
    isValidNamedProfileName: (p: unknown) =>
      typeof p === "string" && PROFILE_NAME_RE.test(p),
    // Mirror the real helper: an invalid name throws, which is exactly what
    // a stray non-profile directory used to trigger.
    normalizeProfileName: (p?: string) => {
      if (p === undefined || p === "" || p === "default") return undefined;
      if (!PROFILE_NAME_RE.test(p)) throw new Error("invalid profile name");
      return p;
    },
  };
});

const setConfigValueSpy = vi.fn(
  (key: string, value: string, profile?: string) => {
    configuredPorts.set(profile ?? "default", value);
  },
);

vi.mock("../src/main/config", () => ({
  // The real getConfigValue resolves the profile home first, which throws
  // on an invalid profile name — keep that behaviour so the mock can't hide
  // a stray non-profile directory reaching it.
  getConfigValue: (_key: string, profile?: string) => {
    if (profile !== undefined && !/^[a-z0-9_][a-z0-9_-]*$/.test(profile))
      throw new Error("invalid profile name");
    return configuredPorts.get(profile ?? "default") ?? null;
  },
  setConfigValue: (key: string, value: string, profile?: string) =>
    setConfigValueSpy(key, value, profile),
}));

vi.mock("fs", () => {
  const fns = {
    existsSync: () => true,
    readdirSync: () => dirEntries,
    statSync: () => ({ isDirectory: () => true }),
  };
  return { ...fns, default: fns };
});

import {
  getProfilePort,
  DEFAULT_API_SERVER_PORT,
} from "../src/main/gateway-ports";

describe("getProfilePort", () => {
  beforeEach(() => {
    configuredPorts.clear();
    dirEntries.length = 0;
    setConfigValueSpy.mockClear();
  });

  it("pins the default profile to 8642 without touching config", () => {
    expect(getProfilePort(undefined)).toBe(DEFAULT_API_SERVER_PORT);
    expect(getProfilePort("default")).toBe(DEFAULT_API_SERVER_PORT);
    expect(setConfigValueSpy).not.toHaveBeenCalled();
  });

  // @lat: [[main-process#Per-profile api_server ports#Ignores non-profile entries]]
  it("ignores non-profile entries such as the CLI's .deleted tombstone dir", () => {
    dirEntries.push(".deleted", ".DS_Store", "coder");
    expect(() => getProfilePort("coder")).not.toThrow();
    expect(getProfilePort("coder")).toBe(DEFAULT_API_SERVER_PORT + 1);
  });

  it("allocates the first free port for a named profile with no configured port", () => {
    dirEntries.push("coder");
    expect(getProfilePort("coder")).toBe(8643);
  });

  it("reassigns a cloned profile that inherited the default's 8642", () => {
    dirEntries.push("coder");
    configuredPorts.set("coder", "8642");
    const port = getProfilePort("coder");
    expect(port).toBe(8643);
    expect(setConfigValueSpy).toHaveBeenCalledWith(
      "platforms.api_server.extra.port",
      "8643",
      "coder",
    );
  });

  it("keeps an already-unique configured port and does not rewrite it", () => {
    dirEntries.push("coder");
    configuredPorts.set("coder", "8650");
    expect(getProfilePort("coder")).toBe(8650);
    expect(setConfigValueSpy).not.toHaveBeenCalled();
  });

  it("avoids collisions across multiple named profiles", () => {
    dirEntries.push("a", "b");
    configuredPorts.set("a", "8643");
    // b has no port yet → must skip 8642 (default) and 8643 (a) → 8644
    expect(getProfilePort("b")).toBe(8644);
  });
});
