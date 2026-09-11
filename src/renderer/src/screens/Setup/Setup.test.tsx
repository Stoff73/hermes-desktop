import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("./SetupModelField", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (m: string) => void;
  }) => (
    <input
      data-testid="model"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
// The real modal spawns the CLI; a stub that only exposes its close button is
// enough to drive the Setup screen's reaction to the flow finishing.
vi.mock("../../components/OAuthLoginModal", () => ({
  default: ({
    provider,
    onClose,
  }: {
    provider: string;
    onClose: () => void;
  }) => (
    <div data-testid="oauth-modal" data-provider={provider}>
      <button onClick={onClose}>close-modal</button>
    </div>
  ),
}));

import Setup from "./Setup";

const statuses = vi.fn();
const setModelConfig = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { hermesAPI: unknown }).hermesAPI = {
    getOAuthProviderStatuses: statuses,
    setModelConfig,
    setEnv: vi.fn(),
    openExternal: vi.fn(),
  };
});

const continueButton = (): HTMLButtonElement =>
  screen.getByText("setup.continue").closest("button") as HTMLButtonElement;

// @lat: [[provider-setup#Provider setup#OAuth-only tiles sign in during Setup]]
describe("Setup — OAuth-only provider tile", () => {
  it("offers a sign-in and blocks Continue until credentials exist", async () => {
    statuses.mockResolvedValue({ "openai-codex": false });
    render(<Setup onComplete={() => {}} />);
    fireEvent.click(screen.getByText("constants.openaiCodexName"));
    fireEvent.change(screen.getByTestId("model"), {
      target: { value: "gpt-5.3-codex" },
    });
    await waitFor(() => expect(statuses).toHaveBeenCalled());
    expect(screen.getByText("setup.oauthSignIn")).toBeTruthy();
    expect(screen.getByText("setup.oauthNotSignedIn")).toBeTruthy();
    expect(continueButton().disabled).toBe(true);
  });

  it("unlocks Continue once the sign-in flow leaves credentials behind", async () => {
    statuses
      .mockResolvedValueOnce({ "openai-codex": false })
      .mockResolvedValue({ "openai-codex": true });
    setModelConfig.mockResolvedValue(undefined);
    const onComplete = vi.fn();
    render(<Setup onComplete={onComplete} />);
    fireEvent.click(screen.getByText("constants.openaiCodexName"));
    fireEvent.change(screen.getByTestId("model"), {
      target: { value: "gpt-5.3-codex" },
    });
    await waitFor(() => expect(continueButton().disabled).toBe(true));

    fireEvent.click(screen.getByText("setup.oauthSignIn"));
    expect(screen.getByTestId("oauth-modal").dataset.provider).toBe(
      "openai-codex",
    );
    fireEvent.click(screen.getByText("close-modal"));

    await waitFor(() => expect(continueButton().disabled).toBe(false));
    expect(screen.getByText("setup.oauthSignedIn")).toBeTruthy();
    fireEvent.click(continueButton());
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(setModelConfig).toHaveBeenCalledWith(
      "openai-codex",
      "gpt-5.3-codex",
      "",
    );
  });

  it("does not gate key-based tiles on OAuth status", async () => {
    statuses.mockResolvedValue({ "openai-codex": false });
    render(<Setup onComplete={() => {}} />);
    fireEvent.click(screen.getByText("constants.anthropicName"));
    fireEvent.change(screen.getByTestId("model"), {
      target: { value: "claude-sonnet-4" },
    });
    fireEvent.change(screen.getByPlaceholderText("sk-ant-..."), {
      target: { value: "sk-ant-test" },
    });
    expect(screen.queryByText("setup.oauthSignIn")).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });
});
