import { getAgentPreset } from "../shared/agent-presets";
import { setProfileName } from "./profile-meta";
import { writeSoul } from "./soul";
import { setToolsetEnabled } from "./tools";

export interface ApplyAgentPresetInput {
  name: string;
  purpose: string;
  toolsets: Record<string, boolean>;
}

export interface ApplyAgentPresetResult {
  success: boolean;
  error?: string;
}

/**
 * Apply a preset to one agent: name, persona, capabilities.
 *
 * Deliberately one call rather than three from the renderer — a half-applied
 * preset (named but no persona) is reported as a failure the user can retry,
 * not left as a silently odd agent.
 */
export async function applyAgentPreset(
  presetId: string,
  input: ApplyAgentPresetInput,
  profile = "default",
): Promise<ApplyAgentPresetResult> {
  const preset = getAgentPreset(presetId);
  if (!preset) {
    return { success: false, error: `Unknown agent preset "${presetId}"` };
  }

  const named = await setProfileName(profile, input.name);
  if (!named.success) {
    return {
      success: false,
      error: `Could not save the agent name: ${named.error ?? "unknown error"}`,
    };
  }

  const persona = preset.buildPersona({
    name: input.name,
    purpose: input.purpose,
  });
  if (!writeSoul(persona, profile)) {
    return { success: false, error: "Could not save the agent's persona." };
  }

  for (const [key, enabled] of Object.entries(input.toolsets)) {
    if (!setToolsetEnabled(key, enabled, profile)) {
      return {
        success: false,
        error: `Could not save the "${key}" capability.`,
      };
    }
  }

  return { success: true };
}
