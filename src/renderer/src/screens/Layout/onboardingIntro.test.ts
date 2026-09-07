import { describe, expect, it } from "vitest";

import { buildIntroPrompt } from "./onboardingIntro";

describe("buildIntroPrompt", () => {
  it("asks for an introduction and repeats the stated purpose", () => {
    const prompt = buildIntroPrompt({
      agentName: "Atlas",
      purpose: "keep my inbox under control",
      channels: [],
    });
    expect(prompt).toContain("Introduce yourself");
    expect(prompt).toContain("keep my inbox under control");
  });

  it("reports each channel's test result", () => {
    const prompt = buildIntroPrompt({
      agentName: "Atlas",
      purpose: "",
      channels: [
        { id: "slack", ok: true, message: "connected" },
        { id: "email", ok: false, message: "authentication rejected" },
      ],
    });
    expect(prompt).toContain("slack: connected");
    expect(prompt).toContain("email: not working (authentication rejected)");
  });

  it("says nothing about channels when none were chosen", () => {
    const prompt = buildIntroPrompt({
      agentName: "Atlas",
      purpose: "",
      channels: [],
    });
    expect(prompt).not.toContain("channels");
  });
});
