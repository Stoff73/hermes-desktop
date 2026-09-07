import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./profile-meta", () => ({
  setProfileName: vi.fn(async () => ({ success: true })),
}));

vi.mock("./soul", () => ({
  writeSoul: vi.fn(() => true),
}));

vi.mock("./tools", () => ({
  setToolsetEnabled: vi.fn(() => true),
}));

import { applyAgentPreset } from "./agent-presets";
import { setProfileName } from "./profile-meta";
import { writeSoul } from "./soul";
import { setToolsetEnabled } from "./tools";

const input = {
  name: "Atlas",
  purpose: "keep my inbox under control",
  toolsets: { web: true, computer_use: false },
};

beforeEach(() => vi.clearAllMocks());

describe("applyAgentPreset", () => {
  it("writes the name, the persona and every toolset to the default agent", async () => {
    const result = await applyAgentPreset("general", input);

    expect(result).toEqual({ success: true });
    expect(setProfileName).toHaveBeenCalledWith("default", "Atlas");
    expect(vi.mocked(writeSoul).mock.calls[0][0]).toContain("You are Atlas");
    expect(vi.mocked(writeSoul).mock.calls[0][1]).toBe("default");
    expect(setToolsetEnabled).toHaveBeenCalledWith("web", true, "default");
    expect(setToolsetEnabled).toHaveBeenCalledWith(
      "computer_use",
      false,
      "default",
    );
  });

  it("applies to a named profile when one is given", async () => {
    await applyAgentPreset("general", input, "myrtle");
    expect(setProfileName).toHaveBeenCalledWith("myrtle", "Atlas");
    expect(setToolsetEnabled).toHaveBeenCalledWith("web", true, "myrtle");
  });

  it("rejects an unknown preset before writing anything", async () => {
    const result = await applyAgentPreset("nope", input);
    expect(result.success).toBe(false);
    expect(result.error).toContain("nope");
    expect(setProfileName).not.toHaveBeenCalled();
  });

  it("stops at a failed rename and names the step", async () => {
    vi.mocked(setProfileName).mockResolvedValueOnce({
      success: false,
      error: "disk full",
    });

    const result = await applyAgentPreset("general", input);

    expect(result.success).toBe(false);
    expect(result.error).toContain("name");
    expect(result.error).toContain("disk full");
    expect(writeSoul).not.toHaveBeenCalled();
  });

  it("reports which capability failed to save", async () => {
    vi.mocked(setToolsetEnabled).mockReturnValueOnce(false);
    const result = await applyAgentPreset("general", input);
    expect(result.success).toBe(false);
    expect(result.error).toContain("web");
  });
});
