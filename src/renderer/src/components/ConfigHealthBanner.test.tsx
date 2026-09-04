import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONFIG_HEALTH_UPDATED_EVENT,
  ConfigHealthBanner,
} from "./ConfigHealthBanner";

vi.mock("./useI18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, number>) =>
      vars?.count !== undefined ? `${key}:${vars.count}` : key,
  }),
}));

function report(
  issues: Array<{ severity: "error" | "warning" | "info" }>,
  profile = "default",
): {
  ranAt: number;
  profile: string;
  issues: Array<{ severity: "error" | "warning" | "info" }>;
  summary: { errors: number; warnings: number; infos: number };
} {
  return {
    ranAt: Date.now(),
    profile,
    issues,
    summary: {
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      infos: issues.filter((issue) => issue.severity === "info").length,
    },
  };
}

describe("ConfigHealthBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "hermesAPI", {
      configurable: true,
      value: {
        getConfigHealth: vi
          .fn()
          .mockResolvedValue(report([{ severity: "warning" }])),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("hides when Settings publishes a clean config-health report", async () => {
    render(<ConfigHealthBanner profile="default" />);

    expect(await screen.findByTestId("config-health-banner")).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(CONFIG_HEALTH_UPDATED_EVENT, {
          detail: report([], "default"),
        }),
      );
    });

    expect(screen.queryByTestId("config-health-banner")).toBeNull();
  });

  it("hides when the report only contains info-level issues", async () => {
    Object.defineProperty(window, "hermesAPI", {
      configurable: true,
      value: {
        getConfigHealth: vi
          .fn()
          .mockResolvedValue(report([{ severity: "info" }])),
      },
    });

    render(<ConfigHealthBanner profile="default" />);

    await act(async () => {
      await new Promise((r) => window.setTimeout(r, 10));
    });

    expect(screen.queryByTestId("config-health-banner")).toBeNull();
  });

  it("ignores config-health updates for another profile", async () => {
    render(<ConfigHealthBanner profile="default" />);

    expect(await screen.findByTestId("config-health-banner")).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(CONFIG_HEALTH_UPDATED_EVENT, {
          detail: report([], "other-profile"),
        }),
      );
    });

    expect(screen.getByTestId("config-health-banner")).toBeTruthy();
  });

  // @lat: [[provider-setup#Provider setup#Getting from a broken config back to a working one#Diagnose link opens the pane showing the issues]]
  it("opens Settings at the pane that actually shows the issues", async () => {
    const onOpenDiagnose = vi.fn();
    render(
      <ConfigHealthBanner profile="default" onOpenDiagnose={onOpenDiagnose} />,
    );
    await screen.findByTestId("config-health-banner");

    fireEvent.click(screen.getByText("diagnose.banner.showDetails"));

    // Passing the handler straight to onClick used to send a MouseEvent as
    // `section`, which resolveSection called .trim() on and threw. Naming the
    // section matters too: Diagnose has no nav entry, so no argument resolved
    // to Appearance and the link showed nothing about the problem.
    expect(onOpenDiagnose).toHaveBeenCalledTimes(1);
    expect(onOpenDiagnose.mock.calls[0]).toEqual(["about"]);
  });
});
