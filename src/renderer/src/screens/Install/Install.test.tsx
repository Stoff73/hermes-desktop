import { act, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string): string => key }),
}));

vi.mock("../../components/common/OnboardHero", () => ({
  default: ({ children }: { children: React.ReactNode }): React.JSX.Element => (
    <div>{children}</div>
  ),
}));

import Install from "./Install";

function installHermesAPI(
  result: { success: boolean; error?: string } = { success: true },
): void {
  Object.defineProperty(window, "hermesAPI", {
    configurable: true,
    value: {
      inspectInstallTarget: vi.fn().mockResolvedValue({
        hermesHome: "/tmp/hermes",
        repoPath: "/tmp/hermes/hermes-agent",
        state: "fresh",
      }),
      startInstall: vi.fn().mockResolvedValue(result),
      onInstallProgress: vi.fn(() => () => {}),
      openExternal: vi.fn().mockResolvedValue(true),
      useExistingInstall: vi.fn().mockResolvedValue({ success: true }),
      selectFolder: vi.fn().mockResolvedValue(null),
    },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("Install completion", () => {
  it("opens setup on its own once the install finishes", async () => {
    installHermesAPI();
    const onComplete = vi.fn();

    render(
      <Install
        onComplete={onComplete}
        onFailed={() => {}}
        onCancel={() => {}}
      />,
    );

    // Confirm, then let the install resolve.
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      screen.getByText("install.confirmInstallBtn").click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // The completion state is shown first, and nothing has advanced yet.
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("never advances when the install failed", async () => {
    installHermesAPI({ success: false, error: "boom" });
    const onComplete = vi.fn();

    render(
      <Install
        onComplete={onComplete}
        onFailed={() => {}}
        onCancel={() => {}}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      screen.getByText("install.confirmInstallBtn").click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(10000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });
});
