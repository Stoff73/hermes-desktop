import { describe, expect, it } from "vitest";

import {
  AGENT_PRESETS,
  GENERAL_PRESET,
  buildGeneralPersona,
  getAgentPreset,
} from "./agent-presets";

describe("general agent preset", () => {
  it("enables every capability except computer use", () => {
    expect(GENERAL_PRESET.toolsets).toEqual({
      web: true,
      browser: true,
      file: true,
      terminal: true,
      code_execution: true,
      vision: true,
      computer_use: false,
    });
  });

  it("names the agent and repeats the stated purpose", () => {
    const persona = buildGeneralPersona({
      name: "Atlas",
      purpose: "keep my inbox under control",
    });
    expect(persona).toContain("You are Atlas");
    expect(persona).toContain("keep my inbox under control");
  });

  it("omits the purpose section when no purpose was given", () => {
    const persona = buildGeneralPersona({ name: "Atlas", purpose: "   " });
    expect(persona).not.toContain("What you were asked to help with");
    expect(persona).toContain("You are Atlas");
  });

  it("teaches the commands that manage other agents", () => {
    const persona = buildGeneralPersona({ name: "Atlas", purpose: "" });
    expect(persona).toContain("hermes profile list");
    expect(persona).toContain("hermes profile create");
    expect(persona).toContain("SOUL.md");
    expect(persona).toContain("platform_toolsets");
  });

  it("looks a preset up by id", () => {
    expect(getAgentPreset("general")).toBe(GENERAL_PRESET);
    expect(getAgentPreset("nope")).toBeUndefined();
    expect(AGENT_PRESETS).toContain(GENERAL_PRESET);
  });
});
