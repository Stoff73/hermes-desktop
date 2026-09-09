import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const home = mkdtempSync(join(tmpdir(), "hermes-skill-"));
process.env.HERMES_HOME = home;

let mod: typeof import("./create-agent-skill");

beforeAll(async () => {
  mod = await import("./create-agent-skill");
});

afterAll(() => {
  rmSync(home, { recursive: true, force: true });
});

// @lat: [[agent-settings#Creating an agent from chat#Installed into every profile]]
describe("ensureCreateAgentSkill", () => {
  it("writes the skill into a named profile's skills folder, once", () => {
    mkdirSync(join(home, "profiles", "poe2"), { recursive: true });
    expect(mod.ensureCreateAgentSkill("poe2")).toBe(true);
    const file = join(
      home,
      "profiles",
      "poe2",
      "skills",
      "hermes-one",
      "create-agent",
      "SKILL.md",
    );
    expect(readFileSync(file, "utf-8")).toBe(mod.CREATE_AGENT_SKILL);
    expect(readFileSync(file, "utf-8")).toMatch(/^---\nname: create-agent\n/);
    // Already current — nothing rewritten.
    expect(mod.ensureCreateAgentSkill("poe2")).toBe(false);
  });

  it("installs for the default profile and every named profile, skipping tombstones", () => {
    mkdirSync(join(home, "profiles", ".deleted"), { recursive: true });
    mkdirSync(join(home, "profiles", "myrtle"), { recursive: true });
    mod.ensureCreateAgentSkillEverywhere();
    expect(
      existsSync(
        join(home, "skills", "hermes-one", "create-agent", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          home,
          "profiles",
          "myrtle",
          "skills",
          "hermes-one",
          "create-agent",
          "SKILL.md",
        ),
      ),
    ).toBe(true);
    expect(existsSync(join(home, "profiles", ".deleted", "skills"))).toBe(
      false,
    );
  });
});
