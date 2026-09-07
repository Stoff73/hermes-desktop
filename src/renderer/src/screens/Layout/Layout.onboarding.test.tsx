import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string): string => key }),
}));

vi.mock("../../components/profile/ProfileModalContext", () => ({
  useProfileModal: () => ({ openProfile: vi.fn(), closeProfile: vi.fn() }),
}));

vi.mock("../../components/settings/SettingsModalContext", () => ({
  useSettingsModal: () => ({ openSettings: vi.fn(), closeSettings: vi.fn() }),
}));

// The two panes under test are stubbed so the assertions are about the handoff,
// not about either screen's own behaviour.
vi.mock("../Gateway/Gateway", () => ({
  default: ({
    highlightPlatforms,
    onContinue,
  }: {
    highlightPlatforms?: string[];
    onContinue?: () => void;
  }) => (
    <div
      data-testid="gateway"
      data-highlight={(highlightPlatforms ?? []).join(",")}
    >
      {onContinue && (
        <button data-testid="gateway-continue" onClick={onContinue}>
          continue
        </button>
      )}
    </div>
  ),
}));

vi.mock("../Chat/Chat", () => ({
  default: ({ autoSendPrompt }: { autoSendPrompt?: string }) => (
    <div data-testid="chat" data-auto={autoSendPrompt ?? ""} />
  ),
}));

// Sidebar furniture that talks to IPC on mount and has nothing to do with this.
vi.mock("./ProfileSwitcher", () => ({ default: () => <div /> }));
vi.mock("./SidebarRecentSessions", () => ({ default: () => <div /> }));
vi.mock("./StatusBar", () => ({ StatusBar: () => <div /> }));
vi.mock("./ActiveSessionsBar", () => ({ ActiveSessionsBar: () => <div /> }));

import Layout from "./Layout";

// jsdom has no ResizeObserver; the sidebar's scrollbar tracker constructs one.
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver =
  NoopResizeObserver as unknown as typeof ResizeObserver;

function installHermesAPI(): {
  testMessagingPlatform: ReturnType<typeof vi.fn>;
} {
  const noopCleanup = (): void => {};
  const api = {
    testMessagingPlatform: vi
      .fn()
      .mockResolvedValue({ ok: true, message: "connected" }),
    isRemoteOnlyMode: vi.fn().mockResolvedValue(false),
    listProfiles: vi.fn().mockResolvedValue([]),
    abortChat: vi.fn().mockResolvedValue(true),
    getSessionMessages: vi.fn().mockResolvedValue([]),
    onMenuNewChat: vi.fn(() => noopCleanup),
    onMenuSearchSessions: vi.fn(() => noopCleanup),
    onUpdateAvailable: vi.fn(() => noopCleanup),
    onUpdateDownloaded: vi.fn(() => noopCleanup),
    onUpdateDownloadProgress: vi.fn(() => noopCleanup),
    onUpdateError: vi.fn(() => noopCleanup),
    downloadUpdate: vi.fn().mockResolvedValue(true),
    installUpdate: vi.fn().mockResolvedValue(true),
  };
  Object.defineProperty(window, "hermesAPI", {
    configurable: true,
    value: api,
  });
  return api;
}

function autoPrompts(): string[] {
  return screen
    .getAllByTestId("chat")
    .map((node) => node.getAttribute("data-auto") ?? "")
    .filter(Boolean);
}

beforeEach(() => {
  installHermesAPI();
});

describe("Layout onboarding handoff", () => {
  it("opens the Gateway on the chosen channels and sends nothing yet", async () => {
    render(
      <Layout
        onboarding={{ agentName: "Atlas", purpose: "", channels: ["slack"] }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("gateway").getAttribute("data-highlight")).toBe(
      "slack",
    );
    expect(autoPrompts()).toHaveLength(0);
  });

  it("tests the channels on continue and opens one chat that introduces the agent", async () => {
    const api = installHermesAPI();

    render(
      <Layout
        onboarding={{ agentName: "Atlas", purpose: "", channels: ["slack"] }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("gateway-continue"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.testMessagingPlatform).toHaveBeenCalledWith("slack");
    const prompts = autoPrompts();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("slack: connected");
  });

  it("goes straight to a chat when no channels were chosen", async () => {
    render(
      <Layout
        onboarding={{
          agentName: "Atlas",
          purpose: "watch my inbox",
          channels: [],
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("gateway-continue")).toBeNull();
    const prompts = autoPrompts();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("watch my inbox");
  });

  it("sends nothing when there was no onboarding", async () => {
    render(<Layout />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(autoPrompts()).toHaveLength(0);
  });
});
