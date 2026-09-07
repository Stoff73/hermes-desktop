import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({
    t: (key: string): string => key,
  }),
}));

// The hero animates on timers and measures layout; the screen's own content is
// what these tests are about.
vi.mock("../../components/common/OnboardHero", () => ({
  default: ({ children }: { children: React.ReactNode }): React.JSX.Element => (
    <div>{children}</div>
  ),
}));

import FirstAgent from "./FirstAgent";

function installHermesAPI(): { applyAgentPreset: ReturnType<typeof vi.fn> } {
  const api = {
    applyAgentPreset: vi.fn().mockResolvedValue({ success: true }),
  };
  Object.defineProperty(window, "hermesAPI", { configurable: true, value: api });
  return api;
}

describe("FirstAgent", () => {
  it("has computer use off and the rest on by default", () => {
    installHermesAPI();
    render(<FirstAgent onComplete={() => {}} onSkip={() => {}} />);

    expect(
      (screen.getByLabelText("tools.computer_use.label") as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      (screen.getByLabelText("tools.web.label") as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("refuses to continue without a name", async () => {
    const api = installHermesAPI();
    render(<FirstAgent onComplete={() => {}} onSkip={() => {}} />);

    fireEvent.change(screen.getByLabelText("setup.firstAgent.nameLabel"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByText("setup.firstAgent.continue"));

    expect(
      await screen.findByText("setup.firstAgent.nameRequired"),
    ).toBeTruthy();
    expect(api.applyAgentPreset).not.toHaveBeenCalled();
  });

  it("applies the preset and hands off the ticked channels", async () => {
    const api = installHermesAPI();
    const onComplete = vi.fn();
    render(<FirstAgent onComplete={onComplete} onSkip={() => {}} />);

    fireEvent.change(screen.getByLabelText("setup.firstAgent.nameLabel"), {
      target: { value: "Atlas" },
    });
    fireEvent.change(screen.getByLabelText("setup.firstAgent.purposeLabel"), {
      target: { value: "watch my inbox" },
    });
    fireEvent.click(screen.getByLabelText("tools.computer_use.label"));
    fireEvent.click(screen.getByLabelText("setup.firstAgent.channels.slack"));
    fireEvent.click(screen.getByText("setup.firstAgent.continue"));

    await waitFor(() => expect(api.applyAgentPreset).toHaveBeenCalled());
    expect(api.applyAgentPreset).toHaveBeenCalledWith("general", {
      name: "Atlas",
      purpose: "watch my inbox",
      toolsets: {
        web: true,
        browser: true,
        file: true,
        terminal: true,
        code_execution: true,
        vision: true,
        computer_use: true,
      },
    });
    expect(onComplete).toHaveBeenCalledWith({
      agentName: "Atlas",
      purpose: "watch my inbox",
      channels: ["slack"],
    });
  });

  it("surfaces a failed apply and does not hand off", async () => {
    const api = installHermesAPI();
    api.applyAgentPreset.mockResolvedValue({
      success: false,
      error: "Could not save the agent's persona.",
    });
    const onComplete = vi.fn();
    render(<FirstAgent onComplete={onComplete} onSkip={() => {}} />);

    fireEvent.change(screen.getByLabelText("setup.firstAgent.nameLabel"), {
      target: { value: "Atlas" },
    });
    fireEvent.click(screen.getByText("setup.firstAgent.continue"));

    expect(
      await screen.findByText("Could not save the agent's persona."),
    ).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("skips without writing anything", () => {
    const api = installHermesAPI();
    const onSkip = vi.fn();
    render(<FirstAgent onComplete={() => {}} onSkip={onSkip} />);

    fireEvent.click(screen.getByText("setup.firstAgent.skip"));

    expect(onSkip).toHaveBeenCalled();
    expect(api.applyAgentPreset).not.toHaveBeenCalled();
  });
});
