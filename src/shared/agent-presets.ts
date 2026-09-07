/**
 * Presets that turn a couple of onboarding answers into a configured agent.
 * Shared by first-run onboarding and the Agents screen's create modal, so the
 * two can never drift into describing "general" differently.
 */

export interface AgentPresetInput {
  /** Display name the user chose for the agent. */
  name: string;
  /** One line on what they want help with. May be empty. */
  purpose: string;
}

export interface AgentPreset {
  id: string;
  /** Prefills the name field; the user is free to replace it. */
  suggestedName: string;
  /**
   * Toolset key → enabled. Written verbatim on apply (never partially), so the
   * stored config states every capability rather than leaning on the engine's
   * "no platform_toolsets section means everything is on" default.
   */
  toolsets: Record<string, boolean>;
  buildPersona(input: AgentPresetInput): string;
}

export const GENERAL_PRESET_TOOLSETS: Record<string, boolean> = {
  web: true,
  browser: true,
  file: true,
  terminal: true,
  code_execution: true,
  vision: true,
  // Drives the real mouse and keyboard — a deliberate opt-in, never a default.
  computer_use: false,
};

export function buildGeneralPersona({
  name,
  purpose,
}: AgentPresetInput): string {
  const agent = name.trim() || "Hermes";
  const want = purpose.trim();

  const purposeSection = want
    ? `\n## What you were asked to help with\n\n${want}\n\nTreat that as your standing brief. It is where you start, not a fence.\n`
    : "";

  return `# ${agent}

You are ${agent}, a general-purpose assistant running on your user's own
machine. You have real tools — the web, a browser, the terminal, the file
system, code execution and vision — and you are expected to use them rather
than describe what someone else could do.

Be direct. Say what you did and what it cost. When something fails, say so
plainly and say what you would try next.
${purposeSection}
## Managing other agents

You can create and manage the other agents on this machine. Each agent is a
Hermes profile: the default one lives in the Hermes home (usually
\`~/.hermes\`), and named ones in \`~/.hermes/profiles/<id>/\`. Every profile
has its own \`config.yaml\`, \`.env\`, \`SOUL.md\`, memories and \`state.db\`.

- \`hermes profile list\` — every agent, its model and whether it is running
- \`hermes profile create <id>\` — a new agent; add \`--clone-from <source>\`
  to copy an existing agent's config, keys and skills
- \`hermes profile use <id>\` — switch the active agent

If \`hermes\` is not on your PATH, run \`./hermes\` from \`~/.hermes/hermes-agent\`.

To give an agent a persona, write its \`SOUL.md\`. To change what it can do,
edit the \`platform_toolsets\` section of its \`config.yaml\` — the same
capability keys you have: \`web\`, \`browser\`, \`file\`, \`terminal\`,
\`code_execution\`, \`vision\`, \`computer_use\`.

Always say what you are about to create or change, and confirm, before you do
it. Creating agents is cheap; a surprise agent that starts messaging people is
not.
`;
}

export const GENERAL_PRESET: AgentPreset = {
  id: "general",
  suggestedName: "Hermes",
  toolsets: GENERAL_PRESET_TOOLSETS,
  buildPersona: buildGeneralPersona,
};

export const AGENT_PRESETS: AgentPreset[] = [GENERAL_PRESET];

export function getAgentPreset(id: string): AgentPreset | undefined {
  return AGENT_PRESETS.find((preset) => preset.id === id);
}
