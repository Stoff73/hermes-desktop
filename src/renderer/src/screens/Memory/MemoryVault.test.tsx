import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryVault } from "./MemoryVault";

// Repo convention (ConfigHealthBanner.test.tsx): t() returns the key.
vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const api = {
  selectFolder: vi.fn(),
  setEnv: vi.fn(),
  removeEnv: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  api.selectFolder.mockResolvedValue("/Users/me/Vault");
  api.setEnv.mockResolvedValue(true);
  api.removeEnv.mockResolvedValue(true);
  (window as unknown as { hermesAPI: unknown }).hermesAPI = api;
});

describe("MemoryVault", () => {
  it("shows Not linked and no unlink button when there is no path", () => {
    render(
      <MemoryVault
        path={null}
        exists={false}
        profile="p"
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByTestId("memory-vault-path").textContent).toContain(
      "memory.vaultNotLinked",
    );
    expect(screen.queryByText("memory.vaultClear")).toBeNull();
  });

  it("shows the path and a missing-folder warning when the folder is absent", () => {
    render(
      <MemoryVault
        path="/gone/Vault"
        exists={false}
        profile="p"
        onRefresh={() => {}}
      />,
    );
    const el = screen.getByTestId("memory-vault-path");
    expect(el.textContent).toContain("/gone/Vault");
    expect(el.textContent).toContain("memory.vaultMissing");
  });

  it("choosing a folder writes OBSIDIAN_VAULT_PATH for that agent and refreshes", async () => {
    const onRefresh = vi.fn();
    render(
      <MemoryVault
        path={null}
        exists={false}
        profile="p"
        onRefresh={onRefresh}
      />,
    );
    fireEvent.click(screen.getByText("memory.vaultChoose"));
    await waitFor(() =>
      expect(api.setEnv).toHaveBeenCalledWith(
        "OBSIDIAN_VAULT_PATH",
        "/Users/me/Vault",
        "p",
      ),
    );
    expect(onRefresh).toHaveBeenCalled();
  });

  it("does nothing when the folder dialog is cancelled", async () => {
    api.selectFolder.mockResolvedValue(null);
    render(
      <MemoryVault
        path={null}
        exists={false}
        profile="p"
        onRefresh={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("memory.vaultChoose"));
    await waitFor(() => expect(api.selectFolder).toHaveBeenCalled());
    expect(api.setEnv).not.toHaveBeenCalled();
  });

  it("unlinking removes the variable from this agent's .env, and refreshes", async () => {
    const onRefresh = vi.fn();
    render(
      <MemoryVault path="/v" exists={true} profile="p" onRefresh={onRefresh} />,
    );
    fireEvent.click(screen.getByText("memory.vaultClear"));
    await waitFor(() =>
      expect(api.removeEnv).toHaveBeenCalledWith("OBSIDIAN_VAULT_PATH", "p"),
    );
    expect(api.setEnv).not.toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalled();
  });
});
