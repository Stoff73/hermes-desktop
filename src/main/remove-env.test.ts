import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const home = mkdtempSync(join(tmpdir(), "hermes-rmenv-"));
process.env.HERMES_HOME = home;
const envFile = join(home, ".env");
const seed = "A=1\nOBSIDIAN_VAULT_PATH=/v\n# OBSIDIAN_VAULT_PATH=old\nB=2\n";

let mod: typeof import("./config");
beforeAll(async () => {
  mod = await import("./config");
});
beforeEach(() => writeFileSync(envFile, seed));
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("removeEnvValue", () => {
  it("removes the variable's lines (active and commented) and leaves the rest untouched", () => {
    mod.removeEnvValue("OBSIDIAN_VAULT_PATH");
    expect(readFileSync(envFile, "utf-8")).toBe("A=1\nB=2\n");
    expect(mod.readEnv().OBSIDIAN_VAULT_PATH).toBeUndefined();
  });

  it("is a no-op when the variable is absent or the file is missing", () => {
    mod.removeEnvValue("NOPE");
    expect(readFileSync(envFile, "utf-8")).toBe(seed);
    rmSync(envFile);
    expect(() => mod.removeEnvValue("A")).not.toThrow();
  });
});
