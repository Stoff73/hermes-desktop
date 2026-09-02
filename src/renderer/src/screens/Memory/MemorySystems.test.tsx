import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemorySystems } from "./MemorySystems";
import type { MemoryData } from "./types";

// Repo convention (ConfigHealthBanner.test.tsx): t() returns the key, so
// assertions never depend on English copy. Interpolations are appended so a
// test can check the values a string was given.
vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

function data(overrides: Partial<MemoryData> = {}): MemoryData {
  return {
    memory: {
      content: "a",
      exists: true,
      lastModified: null,
      entries: [{ index: 0, content: "a" }],
      charCount: 512,
      charLimit: 2200,
    },
    user: {
      content: "u",
      exists: true,
      lastModified: null,
      charCount: 1363,
      charLimit: 1375,
    },
    sessions: {
      totalSessions: 22,
      totalMessages: 1278,
      lastSessionAt: null,
      available: true,
    },
    provider: { active: null, installed: false },
    vault: { path: null, exists: false },
    ...overrides,
  };
}

function renderSystems(d: MemoryData = data()): void {
  render(
    <MemorySystems data={d} profile="p" providers={[]} onRefresh={() => {}} />,
  );
}

describe("MemorySystems", () => {
  it("lists all five systems", () => {
    renderSystems();
    for (const key of ["memory", "user", "sessions", "provider", "vault"]) {
      expect(screen.getByTestId(`memory-system-${key}`)).toBeTruthy();
    }
  });

  it("badges each system by what you can actually do to it", () => {
    renderSystems();
    const text = (key: string): string =>
      screen.getByTestId(`memory-system-${key}`).textContent ?? "";
    expect(text("memory")).toContain("memory.editable");
    expect(text("user")).toContain("memory.editable");
    // Written entirely by the agent.
    expect(text("sessions")).toContain("memory.readOnly");
    // You choose and configure the backend or folder but cannot read or write
    // its store. "Read-only" beside an Activate button would be a new lie.
    expect(text("provider")).toContain("memory.configurable");
    expect(text("vault")).toContain("memory.configurable");
  });

  it("captions a near-full store as consolidating and does not paint it red", () => {
    renderSystems();
    // user is 1363/1375 = 99%
    const row = screen.getByTestId("memory-system-user");
    expect(row.textContent).toContain("memory.atCapacity");
    // CapacityBar sets the colour inline; assert the real style rather than a
    // class name that does not exist anywhere in main.css.
    const fill = row.querySelector(".memory-capacity-fill") as HTMLElement;
    expect(fill.style.background).not.toContain("--error");
    // Unbounded systems get no bar at all.
    expect(
      screen
        .getByTestId("memory-system-sessions")
        .querySelector(".memory-capacity-fill"),
    ).toBeNull();
  });

  it("shows sessions on Session Search, never on User Profile", () => {
    renderSystems();
    expect(screen.getByTestId("memory-system-sessions").textContent).toContain(
      "memory.sessionsAndMessages:22,1278",
    );
    expect(screen.getByTestId("memory-system-user").textContent).not.toContain(
      "22",
    );
  });

  it("shows last activity when a session time is known, and the empty state when none are recorded", () => {
    renderSystems(
      data({
        sessions: {
          totalSessions: 1,
          totalMessages: 1,
          lastSessionAt: Math.floor(Date.now() / 1000) - 3600,
          available: true,
        },
      }),
    );
    expect(screen.getByTestId("memory-system-sessions").textContent).toContain(
      "memory.lastActive:",
    );
    renderSystems(
      data({
        sessions: {
          totalSessions: 0,
          totalMessages: 0,
          lastSessionAt: null,
          available: false,
        },
      }),
    );
    expect(
      screen.getAllByTestId("memory-system-sessions")[1].textContent,
    ).toContain("memory.sessionsUnavailable");
  });

  it("warns when the active provider's plugin is not installed", () => {
    renderSystems(data({ provider: { active: "mem0", installed: false } }));
    const row = screen.getByTestId("memory-system-provider");
    expect(row.textContent).toContain("mem0");
    expect(row.textContent).toContain("memory.providerNotInstalled");
  });

  it("shows the vault folder name, or Not linked, and warns when the folder is missing", () => {
    renderSystems();
    expect(screen.getByTestId("memory-system-vault").textContent).toContain(
      "memory.vaultNotLinked",
    );
    renderSystems(
      data({ vault: { path: "/Users/me/My Vault", exists: false } }),
    );
    const row = screen.getAllByTestId("memory-system-vault")[1];
    expect(row.textContent).toContain("My Vault");
    expect(row.textContent).toContain("memory.vaultMissing");
  });

  it("opens Agent Memory by default and toggles details on click", () => {
    renderSystems();
    const memory = screen.getByTestId("memory-system-memory");
    expect(memory.querySelector(".memory-system-detail")).not.toBeNull();
    const sessions = screen.getByTestId("memory-system-sessions");
    expect(sessions.querySelector(".memory-system-detail")).toBeNull();
    fireEvent.click(sessions.querySelector(".memory-system-head")!);
    expect(sessions.querySelector(".memory-system-detail")).not.toBeNull();
    expect(memory.querySelector(".memory-system-detail")).toBeNull();
  });
});
