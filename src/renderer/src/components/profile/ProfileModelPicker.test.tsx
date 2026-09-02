import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../useI18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

vi.mock("../../screens/Chat/hooks/useModelConfig", () => ({
  useModelConfig: vi.fn(),
}));

// The real picker is a pure component; a stub that fires one selection keeps
// this test about persistence and the key check, not dropdown mechanics.
vi.mock("../../screens/Chat/ModelPicker", () => ({
  ModelPicker: ({
    displayModel,
    onSelectModel,
  }: {
    displayModel: string;
    onSelectModel: (p: string, m: string, b: string) => void;
  }) => (
    <button
      data-testid="picker"
      onClick={() => onSelectModel("xai", "grok-4", "")}
    >
      {displayModel}
    </button>
  ),
}));

import { useModelConfig } from "../../screens/Chat/hooks/useModelConfig";
import ProfileModelPicker from "./ProfileModelPicker";

const selectModel = vi.fn();
const api = {
  rerunConfigHealth: vi.fn(),
  setEnv: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (useModelConfig as Mock).mockReturnValue({
    currentModel: "gpt-5",
    currentProvider: "openai-codex",
    currentBaseUrl: "",
    modelGroups: [],
    displayModel: "gpt-5",
    reload: vi.fn(),
    selectModel,
  });
  selectModel.mockResolvedValue(undefined);
  api.rerunConfigHealth.mockResolvedValue({ issues: [] });
  api.setEnv.mockResolvedValue(true);
  (window as unknown as { hermesAPI: unknown }).hermesAPI = api;
});

describe("ProfileModelPicker", () => {
  it("binds the model hook to this agent and persists a pick to it", async () => {
    render(<ProfileModelPicker profile="myrtle" />);
    expect(useModelConfig).toHaveBeenCalledWith("myrtle");
    fireEvent.click(screen.getByTestId("picker"));
    await waitFor(() =>
      expect(selectModel).toHaveBeenCalledWith("xai", "grok-4", "", {
        persist: true,
      }),
    );
  });

  it("shows no key field when the health check is clean", async () => {
    render(<ProfileModelPicker profile="myrtle" />);
    await waitFor(() =>
      expect(api.rerunConfigHealth).toHaveBeenCalledWith("myrtle"),
    );
    expect(screen.queryByTestId("profile-model-key")).toBeNull();
  });

  it("shows an inline key field when a key is missing, and saves it to this agent", async () => {
    api.rerunConfigHealth.mockResolvedValue({
      issues: [
        {
          code: "MODEL_KEY_MISSING",
          context: { expectedKey: "XAI_API_KEY", provider: "xai" },
        },
      ],
    });
    render(<ProfileModelPicker profile="myrtle" />);
    const field = await screen.findByTestId("profile-model-key");
    expect(field.textContent).toContain("agents.modelKeyMissing:XAI_API_KEY");
    fireEvent.change(screen.getByLabelText("XAI_API_KEY"), {
      target: { value: "sk-1" },
    });
    fireEvent.click(screen.getByText("memory.save"));
    await waitFor(() =>
      expect(api.setEnv).toHaveBeenCalledWith("XAI_API_KEY", "sk-1", "myrtle"),
    );
    // Re-checked after saving.
    expect(api.rerunConfigHealth.mock.calls.length).toBeGreaterThan(1);
  });

  it("a failed health check does not block the picker", async () => {
    api.rerunConfigHealth.mockRejectedValue(new Error("boom"));
    render(<ProfileModelPicker profile="myrtle" />);
    await waitFor(() => expect(api.rerunConfigHealth).toHaveBeenCalled());
    expect(screen.getByTestId("picker")).toBeTruthy();
    expect(screen.queryByTestId("profile-model-key")).toBeNull();
  });
});
