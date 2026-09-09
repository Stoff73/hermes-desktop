import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "/tmp", getVersion: () => "0.0.0", isPackaged: false },
  ipcMain: { handle: (): void => {} },
}));
vi.mock("../src/main/updater-log", () => ({
  updaterLogger: { info: (): void => {}, error: (): void => {} },
}));

import { availableUpdateVersion } from "../src/main/app/updater";

// @lat: [[desktop-updates#Manual check offers only a newer version]]
describe("availableUpdateVersion", () => {
  it("offers the version only when electron-updater says it is newer", () => {
    expect(
      availableUpdateVersion({
        isUpdateAvailable: true,
        updateInfo: { version: "0.8.5" },
      }),
    ).toBe("0.8.5");
  });

  it("reports up to date when the latest release is the installed one", () => {
    // checkForUpdates() still resolves with updateInfo for the current
    // version — that used to be offered as an "update" to itself.
    expect(
      availableUpdateVersion({
        isUpdateAvailable: false,
        updateInfo: { version: "0.8.4" },
      }),
    ).toBeNull();
    expect(availableUpdateVersion(null)).toBeNull();
  });
});
