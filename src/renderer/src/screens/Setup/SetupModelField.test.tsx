import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import SetupModelField from "./SetupModelField";

const discover = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { hermesAPI: unknown }).hermesAPI = {
    discoverProviderModels: discover,
  };
});

// @lat: [[onboarding#Onboarding Chrome#Setup cannot finish without a model#Model field is scoped to the provider]]
describe("SetupModelField", () => {
  it("offers only the chosen provider's models", async () => {
    discover.mockResolvedValue({
      models: ["claude-sonnet-4", "claude-opus-4"],
      status: "ok",
      cached: false,
    });
    render(
      <SetupModelField provider="anthropic" value="" onChange={() => {}} />,
    );
    const select = (await screen.findByTestId(
      "setup-model-select",
    )) as HTMLSelectElement;
    expect(discover).toHaveBeenCalledWith("anthropic", undefined, undefined);
    // The placeholder plus exactly the two models this provider returned.
    expect([...select.options].map((o) => o.value)).toEqual([
      "",
      "claude-sonnet-4",
      "claude-opus-4",
    ]);
  });

  it("reports the pick to its parent", async () => {
    discover.mockResolvedValue({
      models: ["gpt-5-codex"],
      status: "ok",
      cached: false,
    });
    const onChange = vi.fn();
    render(
      <SetupModelField provider="openai-codex" value="" onChange={onChange} />,
    );
    const select = await screen.findByTestId("setup-model-select");
    fireEvent.change(select, { target: { value: "gpt-5-codex" } });
    expect(onChange).toHaveBeenCalledWith("gpt-5-codex");
  });

  it("falls back to a text box rather than a dead end when discovery fails", async () => {
    // no-key / error / unsupported must never block setup, which now refuses
    // to finish without a model.
    discover.mockResolvedValue({ models: [], status: "no-key", cached: false });
    render(
      <SetupModelField provider="anthropic" value="" onChange={() => {}} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("setup-model-input")).toBeTruthy(),
    );
    expect(screen.queryByTestId("setup-model-select")).toBeNull();
  });

  it("survives a discovery call that rejects", async () => {
    discover.mockRejectedValue(new Error("offline"));
    render(<SetupModelField provider="openai" value="" onChange={() => {}} />);
    await waitFor(() =>
      expect(screen.getByTestId("setup-model-input")).toBeTruthy(),
    );
  });
});
