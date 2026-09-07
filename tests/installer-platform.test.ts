import { describe, expect, it } from "vitest";
import { delimiter } from "path";
import {
  getEnhancedPath,
  hermesCliArgs,
  HERMES_PYTHON,
  HERMES_SCRIPT,
} from "../src/main/installer";

describe("installer platform wiring", () => {
  it("uses the platform path delimiter in the enhanced PATH", () => {
    const enhancedPath = getEnhancedPath();

    expect(enhancedPath).toContain(process.env.PATH || "");
    expect(enhancedPath.split(delimiter).length).toBeGreaterThan(1);
  });

  it("builds platform-specific Hermes CLI invocation args", () => {
    const args = hermesCliArgs(["--version"]);

    if (process.platform === "win32") {
      expect(args).toEqual(["-m", "hermes_cli.main", "--version"]);
      // Use `pythonw.exe` (Windows-subsystem) instead of `python.exe` so
      // child spawns don't flash a blank console window before
      // `windowsHide`/CREATE_NO_WINDOW takes effect — see issue #342.
      expect(HERMES_PYTHON).toMatch(/venv[\\/]Scripts[\\/]pythonw\.exe$/);
      expect(HERMES_SCRIPT).toMatch(/venv[\\/]Scripts[\\/]hermes\.exe$/);
      return;
    }

    expect(args).toEqual([HERMES_SCRIPT, "--version"]);
    expect(HERMES_PYTHON).toMatch(/venv[\\/]bin[\\/]python$/);
  });
});

describe("enhanced PATH ordering", () => {
  // A node-version-manager directory used to be prepended, so every
  // subprocess ran that node even when the user's own PATH provided a newer
  // one. On a machine whose nvm default was node 20 and whose PATH had node
  // 22, the agent's web-UI build died with EBADENGINE (it requires >=22.22)
  // — reported only as "✗ Web UI npm install failed", because the install
  // runs `--silent` and npm prints nothing at that log level.
  it("keeps the user's own PATH ahead of node version manager directories", () => {
    const entries = getEnhancedPath().split(delimiter);
    const userEntries = (process.env.PATH || "").split(delimiter).filter(Boolean);
    if (userEntries.length === 0) return;

    const versionManager = entries.findIndex((entry) =>
      /[\\/](\.nvm|\.volta|\.asdf|\.fnm|fnm)[\\/]/.test(entry),
    );
    if (versionManager === -1) return; // no version manager on this machine

    const firstUserEntry = entries.indexOf(userEntries[0]);
    expect(firstUserEntry).toBeGreaterThanOrEqual(0);
    expect(firstUserEntry).toBeLessThan(versionManager);
  });
});
