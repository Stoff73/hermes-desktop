import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./profiles", () => ({
  // Mirrors the real async signature — a sync mock lets a broken impl pass.
  listProfiles: vi.fn(async () => [
    { id: "default", name: "Hermes One", isActive: true, color: "#123456" },
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
      vault: { path: "/v", exists: true },
    };
  }),
}));

import { readAllAgentsMemory } from "./agents-memory";

beforeEach(() => vi.clearAllMocks());

// @lat: [[memory#Memory#Tests#Cross-agent summary]]
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
      color: "#123456",
      memoryChars: 512,
      memoryLimit: 2200,
      memoryEntries: 1,
      userChars: 1363,
      userLimit: 1375,
      totalSessions: 22,
      lastSessionAt: 99,
      provider: "mem0",
      vaultLinked: true,
      available: true,
    });
  });

  it("marks an unreadable agent unavailable instead of throwing", async () => {
    const d = (await readAllAgentsMemory())[1];
    expect(d.id).toBe("myrtle");
    expect(d.available).toBe(false);
    expect(d.memoryChars).toBe(0);
    expect(d.vaultLinked).toBe(false);
  });
});
