import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../useI18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

import ProfileWorkFolder from "./ProfileWorkFolder";

const api = {
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  selectFolder: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getConfig.mockResolvedValue(".");
  api.setConfig.mockResolvedValue(true);
  api.selectFolder.mockResolvedValue("/Users/me/work");
  (window as unknown as { hermesAPI: unknown }).hermesAPI = api;
});

const path = (): string =>
  screen.getByTestId("profile-work-folder-path").textContent ?? "";

// @lat: [[agent-settings#Agent Settings#Tests#Working folder]]
describe("ProfileWorkFolder", () => {
  it("names the '.' default rather than showing a bare dot", async () => {
    render(<ProfileWorkFolder profile="myrtle" />);
    await waitFor(() => expect(path()).toBe("agents.workFolderDefault"));
    expect(api.getConfig).toHaveBeenCalledWith("terminal.cwd", "myrtle");
    // Nothing to reset to while it is already the default.
    expect(screen.queryByText("agents.workFolderReset")).toBeNull();
  });

  it("writes the chosen folder to this agent's own config", async () => {
    render(<ProfileWorkFolder profile="myrtle" />);
    await waitFor(() => expect(path()).toBe("agents.workFolderDefault"));
    fireEvent.click(screen.getByText("agents.workFolderChoose"));
    await waitFor(() => expect(path()).toBe("/Users/me/work"));
    expect(api.setConfig).toHaveBeenCalledWith(
      "terminal.cwd",
      "/Users/me/work",
      "myrtle",
    );
  });

  it("resets back to the default", async () => {
    api.getConfig.mockResolvedValue("/Users/me/work");
    render(<ProfileWorkFolder profile="myrtle" />);
    await waitFor(() => expect(path()).toBe("/Users/me/work"));
    fireEvent.click(screen.getByText("agents.workFolderReset"));
    await waitFor(() => expect(path()).toBe("agents.workFolderDefault"));
    expect(api.setConfig).toHaveBeenCalledWith("terminal.cwd", ".", "myrtle");
  });

  it("leaves the config alone when the folder dialog is cancelled", async () => {
    api.selectFolder.mockResolvedValue(null);
    render(<ProfileWorkFolder profile="myrtle" />);
    await waitFor(() => expect(path()).toBe("agents.workFolderDefault"));
    fireEvent.click(screen.getByText("agents.workFolderChoose"));
    await waitFor(() => expect(api.selectFolder).toHaveBeenCalled());
    expect(api.setConfig).not.toHaveBeenCalled();
  });
});
