# First-Agent Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a fresh install, walk the user through naming and shaping their first agent, connecting any channels they want, and landing in a chat where the agent introduces itself.

**Architecture:** A new first-run screen (`FirstAgent`) collects a name, a purpose line, capability toggles and channel ticks. A shared preset definition turns those into three existing writes (profile name, `SOUL.md`, per-agent toolsets) behind one new IPC call. If channels were ticked, `Layout` opens on the Gateway screen filtered to those channels; on continue it runs the existing channel tests and mints a chat run whose first turn is auto-sent.

**Tech Stack:** Electron + React 19 + TypeScript, Vitest + @testing-library/react, electron-vite, i18next (per-key fallback to English).

**Spec:** `docs/superpowers/specs/2026-09-07-first-agent-onboarding.md`

## Global Constraints

- Target branch: `feat/first-agent-onboarding` (already created; the spec commit is on it).
- No changes to the `hermes-agent` repo. Desktop only.
- Reuse existing IPC: `set-profile-name`, `write-soul`, `set-toolset-enabled`, `test-messaging-platform`, `get-messaging-platforms`. Do not add new ways to do those things.
- New user-facing strings go under the existing `setup` i18n namespace in `src/shared/i18n/locales/en/setup.ts` **only**. `src/shared/i18n/index.ts` falls back per key to English (see `index.ts:623-625`), so other locales need no edits and no new namespace is registered.
- Toolset keys are exactly: `web`, `browser`, `file`, `terminal`, `code_execution`, `vision`, `computer_use`. These match `TOOLSET_DEFS` in `src/main/tools.ts`.
- Channel ids are exactly: `email`, `slack`, `whatsapp`, `telegram`, `discord`, `signal`. These match the platform ids in `src/shared/messaging-platforms.ts`.
- Default capability state: everything `true` except `computer_use`, which is `false`.
- The renderer never calls the three writes separately — always `window.hermesAPI.applyAgentPreset`.
- The app renders under `<StrictMode>` (`src/renderer/src/main.tsx:16`), so every "run once on mount" effect must be ref-guarded or it fires twice in dev.
- Run `npm run typecheck` before each commit. Tests: `npx vitest run <path>`.
- Commit after every task. Conventional commit prefixes, matching the repo's history (`feat:`, `docs:`, `fix:`).

---

## Execution Protocol

This plan is executed by Opus 5 inline (or by a fresh subagent per task).

1. Work tasks in order. Do not start Task N+1 until Task N's tests pass and it is committed.
2. Each task is TDD: write the failing test, watch it fail for the right reason, implement the minimum, watch it pass, commit.
3. If a step's expected output does not match reality, **stop and report** rather than adapting the plan silently. A wrong assumption here is a plan bug worth knowing about.
4. Update the Progress table below as you go — status and the commit sha.
5. Append one line per task to the Execution Log at the bottom: what was done, anything that surprised you.
6. Task 9 is not optional. `lat.md/` updates and `lat check` are required by `CLAUDE.md`.

### Skills per task

| Task | Skill to invoke first |
| --- | --- |
| 1, 2, 5, 6, 7 | `superpowers:test-driven-development` |
| 3, 4, 8 | `superpowers:test-driven-development`, then `frontend-design` guidance if visual polish is needed |
| 9 | `lat-md` |
| Any failing/unexpected behaviour | `superpowers:systematic-debugging` |
| Before declaring done | `superpowers:verification-before-completion` |

### Progress

| # | Task | Status | Commit |
| --- | --- | --- | --- |
| 1 | Shared general preset | done | 90a5bbe |
| 2 | Apply preset (main + IPC + preload) | done | 5cad639 |
| 3 | FirstAgent screen | done | 033ba84 |
| 4 | App flow wiring | done | cfc77fb (with task 7) |
| 5 | Gateway highlight + continue | done | 19e5868 |
| 6 | Chat auto-send | done | 39809dd |
| 7 | Layout onboarding handoff | done | cfc77fb |
| 8 | Preset in the Agents create modal | done | 6c2027d |
| 9 | Docs, lat check, manual run-through | docs + lat check done (eaf2279); fresh-install walkthrough pending | eaf2279 |

---

### Task 1: Shared general preset

**Files:**
- Create: `src/shared/agent-presets.ts`
- Test: `src/shared/agent-presets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface AgentPresetInput { name: string; purpose: string }`
  - `interface AgentPreset { id: string; suggestedName: string; toolsets: Record<string, boolean>; buildPersona(input: AgentPresetInput): string }`
  - `const GENERAL_PRESET_TOOLSETS: Record<string, boolean>`
  - `function buildGeneralPersona(input: AgentPresetInput): string`
  - `const GENERAL_PRESET: AgentPreset`
  - `const AGENT_PRESETS: AgentPreset[]`
  - `function getAgentPreset(id: string): AgentPreset | undefined`

- [ ] **Step 1: Verify the CLI form the persona will teach**

The persona tells the agent how to manage other agents, so the command must be one the agent's own terminal tool can actually run. Check both forms:

```bash
cd ~/.hermes/hermes-agent && ./hermes profile list
which hermes || echo "not on PATH"
```

Expected: `./hermes profile list` prints a profile table. If `hermes` is also on PATH, the persona may use the bare form; if not, it must use the `cd ~/.hermes/hermes-agent && ./hermes …` form written in Step 3. Use whichever the check supports — do not guess.

- [ ] **Step 2: Write the failing test**

```tsx
// src/shared/agent-presets.test.ts
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
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run src/shared/agent-presets.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-presets"`.

- [ ] **Step 4: Write the implementation**

```ts
// src/shared/agent-presets.ts
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

Run these from \`~/.hermes/hermes-agent\`:

- \`./hermes profile list\` — every agent, its model and whether it is running
- \`./hermes profile create <id>\` — a new agent; add \`--clone-from <source>\`
  to copy an existing agent's config, keys and skills
- \`./hermes profile use <id>\` — switch the active agent

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
```

If Step 1 showed `hermes` resolves on PATH, replace the three `./hermes` lines with `hermes` and drop the "Run these from" sentence.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run src/shared/agent-presets.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/shared/agent-presets.ts src/shared/agent-presets.test.ts
git commit -m "feat(agents): add the shared general agent preset"
```

---

### Task 2: Apply the preset (main process + IPC + preload)

**Files:**
- Create: `src/main/agent-presets.ts`
- Test: `src/main/agent-presets.test.ts`
- Modify: `src/main/ipc/register.ts` (one handler, near the existing `set-profile-name` handler around line 2328)
- Modify: `src/preload/index.ts` (one method, after `resetSoul` around line 1119)

**Interfaces:**
- Consumes: `getAgentPreset` from Task 1; `setProfileName(name, agentName)` from `src/main/profile-meta.ts` (async, returns `{ success, error? }`); `writeSoul(content, profile?)` from `src/main/soul.ts` (returns `boolean`); `setToolsetEnabled(key, enabled, profile?)` from `src/main/tools.ts` (returns `boolean`).
- Produces:
  - `interface ApplyAgentPresetInput { name: string; purpose: string; toolsets: Record<string, boolean> }`
  - `interface ApplyAgentPresetResult { success: boolean; error?: string }`
  - `applyAgentPreset(presetId: string, input: ApplyAgentPresetInput, profile?: string): Promise<ApplyAgentPresetResult>`
  - IPC channel `apply-agent-preset`
  - `window.hermesAPI.applyAgentPreset(presetId, input, profile?)`

- [ ] **Step 1: Write the failing test**

```ts
// src/main/agent-presets.test.ts
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
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/main/agent-presets.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-presets"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/main/agent-presets.ts
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
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/main/agent-presets.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Register the IPC handler**

In `src/main/ipc/register.ts`, add to the imports at the top:

```ts
import {
  applyAgentPreset,
  type ApplyAgentPresetInput,
} from "../agent-presets";
```

and register the handler immediately after the existing `set-profile-name` handler:

```ts
  ipcMain.handle(
    "apply-agent-preset",
    (
      _event,
      presetId: string,
      input: ApplyAgentPresetInput,
      profile?: string,
    ) => applyAgentPreset(presetId, input, profile),
  );
```

- [ ] **Step 6: Expose it in preload**

In `src/preload/index.ts`, after the `resetSoul` entry:

```ts
  // Agent presets
  applyAgentPreset: (
    presetId: string,
    input: { name: string; purpose: string; toolsets: Record<string, boolean> },
    profile?: string,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("apply-agent-preset", presetId, input, profile),
```

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck
git add src/main/agent-presets.ts src/main/agent-presets.test.ts src/main/ipc/register.ts src/preload/index.ts
git commit -m "feat(agents): apply an agent preset in one call"
```

---

### Task 3: The "Meet your agent" screen

**Files:**
- Create: `src/renderer/src/screens/FirstAgent/FirstAgent.tsx`
- Test: `src/renderer/src/screens/FirstAgent/FirstAgent.test.tsx`
- Modify: `src/shared/i18n/locales/en/setup.ts` (new `firstAgent` block)
- Modify: `src/renderer/src/assets/main.css` (styles inside the existing `ONBOARDING HERO (shared)` block)

**Interfaces:**
- Consumes: `GENERAL_PRESET` (Task 1), `window.hermesAPI.applyAgentPreset` (Task 2), `OnboardHero` from `src/renderer/src/components/common/OnboardHero.tsx`.
- Produces:
  - `interface FirstAgentHandoff { agentName: string; purpose: string; channels: string[] }`
  - `interface FirstAgentProps { onComplete(handoff: FirstAgentHandoff): void; onSkip(): void }`
  - `const ONBOARDING_CHANNELS: { id: string; labelKey: string }[]`
  - default export `FirstAgent`

- [ ] **Step 1: Add the English strings**

In `src/shared/i18n/locales/en/setup.ts`, add a `firstAgent` key to the exported object:

```ts
  firstAgent: {
    eyebrow: "YOUR AGENT",
    title: "Meet your agent",
    subtitle:
      "It runs on this machine, with real tools. Give it a name and tell it what you need.",
    nameLabel: "Name",
    namePlaceholder: "Hermes",
    purposeLabel: "What should it help you with?",
    purposePlaceholder: "e.g. keep my inbox under control and draft replies",
    purposeHint: "Optional — you can change this any time in Persona.",
    capabilitiesLabel: "What it can do",
    computerUseWarning: "Controls your actual mouse and keyboard.",
    channelsLabel: "Where you want to reach it",
    channelsHint: "You'll connect these next. Skip any you're not sure about.",
    continue: "Continue",
    skip: "Skip for now",
    saving: "Setting up…",
    nameRequired: "Give your agent a name.",
  },
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/renderer/src/screens/FirstAgent/FirstAgent.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({
    t: (key: string): string => key,
  }),
}));

// The hero animates on timers and measures layout; the screen's own content is
// what these tests are about.
vi.mock("../../components/common/OnboardHero", () => ({
  default: ({ children }: { children: React.ReactNode }): React.JSX.Element => (
    <div>{children}</div>
  ),
}));

import FirstAgent from "./FirstAgent";

function installHermesAPI(): { applyAgentPreset: ReturnType<typeof vi.fn> } {
  const api = {
    applyAgentPreset: vi.fn().mockResolvedValue({ success: true }),
  };
  Object.defineProperty(window, "hermesAPI", { configurable: true, value: api });
  return api;
}

describe("FirstAgent", () => {
  it("has computer use off and the rest on by default", () => {
    installHermesAPI();
    render(<FirstAgent onComplete={() => {}} onSkip={() => {}} />);

    expect(
      (screen.getByLabelText("tools.computer_use.label") as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      (screen.getByLabelText("tools.web.label") as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("refuses to continue without a name", async () => {
    const api = installHermesAPI();
    render(<FirstAgent onComplete={() => {}} onSkip={() => {}} />);

    fireEvent.change(screen.getByLabelText("setup.firstAgent.nameLabel"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByText("setup.firstAgent.continue"));

    expect(await screen.findByText("setup.firstAgent.nameRequired")).toBeTruthy();
    expect(api.applyAgentPreset).not.toHaveBeenCalled();
  });

  it("applies the preset and hands off the ticked channels", async () => {
    const api = installHermesAPI();
    const onComplete = vi.fn();
    render(<FirstAgent onComplete={onComplete} onSkip={() => {}} />);

    fireEvent.change(screen.getByLabelText("setup.firstAgent.nameLabel"), {
      target: { value: "Atlas" },
    });
    fireEvent.change(screen.getByLabelText("setup.firstAgent.purposeLabel"), {
      target: { value: "watch my inbox" },
    });
    fireEvent.click(screen.getByLabelText("tools.computer_use.label"));
    fireEvent.click(screen.getByLabelText("gateway.platforms.slack"));
    fireEvent.click(screen.getByText("setup.firstAgent.continue"));

    await waitFor(() => expect(api.applyAgentPreset).toHaveBeenCalled());
    expect(api.applyAgentPreset).toHaveBeenCalledWith("general", {
      name: "Atlas",
      purpose: "watch my inbox",
      toolsets: {
        web: true,
        browser: true,
        file: true,
        terminal: true,
        code_execution: true,
        vision: true,
        computer_use: true,
      },
    });
    expect(onComplete).toHaveBeenCalledWith({
      agentName: "Atlas",
      purpose: "watch my inbox",
      channels: ["slack"],
    });
  });

  it("surfaces a failed apply and does not hand off", async () => {
    const api = installHermesAPI();
    api.applyAgentPreset.mockResolvedValue({
      success: false,
      error: "Could not save the agent's persona.",
    });
    const onComplete = vi.fn();
    render(<FirstAgent onComplete={onComplete} onSkip={() => {}} />);

    fireEvent.change(screen.getByLabelText("setup.firstAgent.nameLabel"), {
      target: { value: "Atlas" },
    });
    fireEvent.click(screen.getByText("setup.firstAgent.continue"));

    expect(
      await screen.findByText("Could not save the agent's persona."),
    ).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("skips without writing anything", () => {
    const api = installHermesAPI();
    const onSkip = vi.fn();
    render(<FirstAgent onComplete={() => {}} onSkip={onSkip} />);

    fireEvent.click(screen.getByText("setup.firstAgent.skip"));

    expect(onSkip).toHaveBeenCalled();
    expect(api.applyAgentPreset).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run src/renderer/src/screens/FirstAgent/FirstAgent.test.tsx`
Expected: FAIL — `Failed to resolve import "./FirstAgent"`.

- [ ] **Step 4: Write the screen**

```tsx
// src/renderer/src/screens/FirstAgent/FirstAgent.tsx
import { useState } from "react";
import { ArrowRight } from "../../assets/icons";
import OnboardHero from "../../components/common/OnboardHero";
import { useI18n } from "../../components/useI18n";
import { GENERAL_PRESET } from "../../../../shared/agent-presets";

export interface FirstAgentHandoff {
  agentName: string;
  purpose: string;
  channels: string[];
}

interface FirstAgentProps {
  onComplete: (handoff: FirstAgentHandoff) => void;
  onSkip: () => void;
}

/** Capability keys in the order they are shown. Labels reuse the Tools screen's
 *  existing strings so the two screens can't describe a capability differently. */
const CAPABILITY_KEYS = [
  "web",
  "browser",
  "file",
  "terminal",
  "code_execution",
  "vision",
  "computer_use",
] as const;

/** Channels offered at first run. Ids match the platform ids the Gateway
 *  screen uses, so the handoff can be passed straight through as a filter. */
export const ONBOARDING_CHANNELS = [
  { id: "email", labelKey: "gateway.platforms.email" },
  { id: "slack", labelKey: "gateway.platforms.slack" },
  { id: "whatsapp", labelKey: "gateway.platforms.whatsapp" },
  { id: "telegram", labelKey: "gateway.platforms.telegram" },
  { id: "discord", labelKey: "gateway.platforms.discord" },
  { id: "signal", labelKey: "gateway.platforms.signal" },
];

function FirstAgent({ onComplete, onSkip }: FirstAgentProps): React.JSX.Element {
  const { t } = useI18n();
  const [name, setName] = useState(GENERAL_PRESET.suggestedName);
  const [purpose, setPurpose] = useState("");
  const [toolsets, setToolsets] = useState<Record<string, boolean>>({
    ...GENERAL_PRESET.toolsets,
  });
  const [channels, setChannels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleCapability(key: string): void {
    setToolsets((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleChannel(id: string): void {
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleContinue(): Promise<void> {
    const agentName = name.trim();
    if (!agentName) {
      setError(t("setup.firstAgent.nameRequired"));
      return;
    }

    setSaving(true);
    setError("");

    const result = await window.hermesAPI.applyAgentPreset(GENERAL_PRESET.id, {
      name: agentName,
      purpose: purpose.trim(),
      toolsets,
    });

    if (!result.success) {
      setError(result.error || t("setup.firstAgent.nameRequired"));
      setSaving(false);
      return;
    }

    onComplete({ agentName, purpose: purpose.trim(), channels });
  }

  return (
    <OnboardHero
      eyebrow={t("setup.firstAgent.eyebrow")}
      title={t("setup.firstAgent.title")}
    >
      <p className="onboard-subtitle">{t("setup.firstAgent.subtitle")}</p>

      <label className="onboard-field-label" htmlFor="first-agent-name">
        {t("setup.firstAgent.nameLabel")}
      </label>
      <input
        id="first-agent-name"
        className="onboard-input"
        value={name}
        placeholder={t("setup.firstAgent.namePlaceholder")}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="onboard-field-label" htmlFor="first-agent-purpose">
        {t("setup.firstAgent.purposeLabel")}
      </label>
      <input
        id="first-agent-purpose"
        className="onboard-input"
        value={purpose}
        placeholder={t("setup.firstAgent.purposePlaceholder")}
        onChange={(e) => setPurpose(e.target.value)}
      />
      <p className="onboard-note">{t("setup.firstAgent.purposeHint")}</p>

      <p className="onboard-field-label">
        {t("setup.firstAgent.capabilitiesLabel")}
      </p>
      <div className="onboard-capability-grid">
        {CAPABILITY_KEYS.map((key) => (
          <label className="onboard-capability" key={key}>
            <input
              type="checkbox"
              aria-label={t(`tools.${key}.label`)}
              checked={Boolean(toolsets[key])}
              onChange={() => toggleCapability(key)}
            />
            <span>{t(`tools.${key}.label`)}</span>
            {key === "computer_use" && (
              <span className="onboard-capability-warning">
                {t("setup.firstAgent.computerUseWarning")}
              </span>
            )}
          </label>
        ))}
      </div>

      <p className="onboard-field-label">
        {t("setup.firstAgent.channelsLabel")}
      </p>
      <div className="onboard-channel-row">
        {ONBOARDING_CHANNELS.map((channel) => (
          <label className="onboard-channel-chip" key={channel.id}>
            <input
              type="checkbox"
              aria-label={t(channel.labelKey)}
              checked={channels.includes(channel.id)}
              onChange={() => toggleChannel(channel.id)}
            />
            <span>{t(channel.labelKey)}</span>
          </label>
        ))}
      </div>
      <p className="onboard-note">{t("setup.firstAgent.channelsHint")}</p>

      {error && <p className="onboard-error">{error}</p>}

      <div className="onboard-actions">
        <button
          className="onboard-btn onboard-btn-primary"
          disabled={saving}
          onClick={handleContinue}
        >
          <span>
            {saving
              ? t("setup.firstAgent.saving")
              : t("setup.firstAgent.continue")}
          </span>
          <ArrowRight size={16} />
        </button>
        <button className="onboard-btn" onClick={onSkip}>
          {t("setup.firstAgent.skip")}
        </button>
      </div>
    </OnboardHero>
  );
}

export default FirstAgent;
```

If `gateway.platforms.<id>` keys do not exist in `src/shared/i18n/locales/en/gateway.ts`, add the six of them there (`Email`, `Slack`, `WhatsApp`, `Telegram`, `Discord`, `Signal`) rather than hard-coding English in the component.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run src/renderer/src/screens/FirstAgent/FirstAgent.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Style the new elements**

In `src/renderer/src/assets/main.css`, inside the `ONBOARDING HERO (shared)` block, add rules for `.onboard-field-label`, `.onboard-input`, `.onboard-capability-grid`, `.onboard-capability`, `.onboard-capability-warning`, `.onboard-channel-row`, `.onboard-channel-chip`, `.onboard-error` and `.onboard-actions`, reusing the existing `onboard-*` tokens (they already define the dark surface, text and accent colours). The capability grid is a two-column grid on wide windows and one column under 520px; channel chips are an inline wrap row. Do not introduce new colour values — use the block's existing custom properties.

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck
git add src/renderer/src/screens/FirstAgent src/shared/i18n/locales/en/setup.ts src/shared/i18n/locales/en/gateway.ts src/renderer/src/assets/main.css
git commit -m "feat(onboarding): add the meet-your-agent screen"
```

---

### Task 4: Put the screen in the first-run flow

**Files:**
- Modify: `src/renderer/src/App.tsx` (`Screen` union at line 16, `handleInstallComplete` around line 148, `renderScreen` around line 183)

**Interfaces:**
- Consumes: `FirstAgent`, `FirstAgentHandoff` (Task 3).
- Produces: `Layout` receives a new optional `onboarding?: FirstAgentHandoff` prop (implemented in Task 7; passing it now is harmless because the prop is optional).

- [ ] **Step 1: Write the failing test**

There is no `App.test.tsx` today and App is mostly IPC orchestration, so this task is verified by the Layout test in Task 7 plus the manual run-through in Task 9. Skip straight to the implementation, and do not invent a heavyweight App test harness for it.

- [ ] **Step 2: Add the screen to the union and the flow**

In `src/renderer/src/App.tsx`:

```tsx
type Screen = "splash" | "welcome" | "installing" | "setup" | "first-agent" | "main";
```

Add the import and state:

```tsx
import FirstAgent, {
  type FirstAgentHandoff,
} from "./screens/FirstAgent/FirstAgent";
```

```tsx
  // Carried from the first-agent screen into Layout: which channels to open
  // the Gateway on, and what the agent should say hello about.
  const [onboarding, setOnboarding] = useState<FirstAgentHandoff | null>(null);
```

Point Setup at the new screen — change `Setup`'s `onComplete` in `renderScreen` from `() => setScreen("main")` to `() => setScreen("first-agent")`, and add the case:

```tsx
      case "first-agent":
        return (
          <FirstAgent
            onComplete={(handoff) => {
              setOnboarding(handoff);
              setScreen("main");
            }}
            onSkip={() => setScreen("main")}
          />
        );
```

Pass it through in the `main` case:

```tsx
      case "main":
        return (
          <Layout
            onboarding={onboarding ?? undefined}
            verifyWarning={verifyWarning}
            onReinstall={handleVerifyReinstall}
            onDismissVerifyWarning={handleDismissVerifyWarning}
          />
        );
```

- [ ] **Step 3: Check the analytics screen-view still works**

`captureScreenView(screen)` is called for every screen value; `"first-agent"` flows through unchanged. No edit needed — confirm by reading `src/renderer/src/utils/analytics.ts` that it takes an arbitrary string.

- [ ] **Step 4: Typecheck and commit**

```bash
npm run typecheck
git add src/renderer/src/App.tsx
git commit -m "feat(onboarding): run the first-agent screen after setup"
```

---

### Task 5: Gateway — highlight the chosen channels and offer continue

**Files:**
- Modify: `src/renderer/src/screens/Gateway/Gateway.tsx` (props at line 30, `filteredPlatforms` at lines 102-120, list render around line 480)
- Test: `src/renderer/src/screens/Gateway/Gateway.test.tsx` (add a describe block; keep the existing ones untouched)
- Modify: `src/shared/i18n/locales/en/setup.ts` (two strings)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Gateway` accepts `{ profile?: string; highlightPlatforms?: string[]; onContinue?: () => void }`.

- [ ] **Step 1: Add the strings**

In the `firstAgent` block from Task 3:

```ts
    gatewayBanner:
      "Connect the channels you picked. You can finish any of them later.",
    gatewayContinue: "Continue to chat",
```

- [ ] **Step 2: Write the failing test**

Add to `src/renderer/src/screens/Gateway/Gateway.test.tsx`. Copy the `hermesAPI` stub from that file's existing `beforeEach` (lines 17-45) verbatim into a `beforeEach` for this describe block, changing only `getMessagingPlatforms` to resolve `{ platforms, message: null }` with the two platforms below. Keep `vi.useFakeTimers()` and the matching `afterEach` the existing tests use.

```tsx
describe("Gateway onboarding mode", () => {
  const platforms = [
    {
      id: "slack",
      name: "Slack",
      description: "",
      enabled: false,
      configured: false,
      env_vars: [],
      toolsets: [],
      docs_url: "",
    },
    {
      id: "discord",
      name: "Discord",
      description: "",
      enabled: false,
      configured: false,
      env_vars: [],
      toolsets: [],
      docs_url: "",
    },
  ];

  it("shows only the highlighted platforms and a continue action", async () => {
    // ...install the same hermesAPI stub as the existing tests, with
    // getMessagingPlatforms resolving to { platforms, message: null }
    const onContinue = vi.fn();
    render(
      <Gateway highlightPlatforms={["slack"]} onContinue={onContinue} />,
    );

    expect(await screen.findByText("Slack")).toBeTruthy();
    expect(screen.queryByText("Discord")).toBeNull();

    fireEvent.click(screen.getByText("setup.firstAgent.gatewayContinue"));
    expect(onContinue).toHaveBeenCalled();
  });

  it("shows every platform and no continue action normally", async () => {
    render(<Gateway />);
    expect(await screen.findByText("Slack")).toBeTruthy();
    expect(screen.getByText("Discord")).toBeTruthy();
    expect(screen.queryByText("setup.firstAgent.gatewayContinue")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run src/renderer/src/screens/Gateway/Gateway.test.tsx`
Expected: FAIL — both new tests fail (the continue action does not exist; Discord is still rendered).

- [ ] **Step 4: Implement**

Change the signature:

```tsx
function Gateway({
  profile,
  highlightPlatforms,
  onContinue,
}: {
  profile?: string;
  /** When set, show only these platform ids — used by first-run onboarding so
   *  the user sees the channels they asked for, not the full catalogue. */
  highlightPlatforms?: string[];
  /** Present only in onboarding: finishes the connect step. */
  onContinue?: () => void;
}): React.JSX.Element {
```

Narrow the list before the existing search filter:

```tsx
  const platforms = useMemo(() => {
    const all = catalog?.platforms ?? [];
    if (!highlightPlatforms?.length) return all;
    return all.filter((platform) => highlightPlatforms.includes(platform.id));
  }, [catalog, highlightPlatforms]);
```

(`filteredPlatforms` keeps its existing body and dependency list — it already depends on `platforms`.)

Render the banner directly above the platform list, only when `onContinue` is set:

```tsx
      {onContinue && (
        <div className="gateway-onboard-banner">
          <span>{t("setup.firstAgent.gatewayBanner")}</span>
          <button className="btn btn-primary btn-sm" onClick={onContinue}>
            {t("setup.firstAgent.gatewayContinue")}
          </button>
        </div>
      )}
```

Style `.gateway-onboard-banner` in `main.css` beside the other `gateway-*` rules.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run src/renderer/src/screens/Gateway/Gateway.test.tsx`
Expected: PASS — new tests plus all existing ones.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/renderer/src/screens/Gateway src/shared/i18n/locales/en/setup.ts src/renderer/src/assets/main.css
git commit -m "feat(gateway): filter to onboarding channels and offer continue"
```

---

### Task 6: Chat auto-sends the first turn

**Files:**
- Modify: `src/renderer/src/screens/Chat/Chat.tsx` (`ChatProps` at lines 86-114, destructure at 116, new effect near `handleSubmitOrQueue` at line 785)

**Interfaces:**
- Consumes: the existing `handleSubmitOrQueue(text, attachments)`.
- Produces: `Chat` accepts `autoSendPrompt?: string`.

- [ ] **Step 1: Add the prop**

In `ChatProps`:

```tsx
  /** Sent once, automatically, when this run mounts — the onboarding handoff's
   *  opening turn. Ref-guarded because StrictMode double-invokes mount effects
   *  in dev, and a double send would start two agent turns. */
  autoSendPrompt?: string;
```

Add `autoSendPrompt` to the destructured parameters.

- [ ] **Step 2: Send it once**

Place this after `handleSubmitOrQueue` is defined (it must be in scope):

```tsx
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (!autoSendPrompt || autoSentRef.current) return;
    autoSentRef.current = true;
    handleSubmitOrQueue(autoSendPrompt, []);
  }, [autoSendPrompt, handleSubmitOrQueue]);
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

There is no `Chat.test.tsx` in this repo — `Chat` is covered through its extracted helpers, and standing up a full harness for a five-line effect is not worth it. The double-send risk is covered by the ref guard plus the manual dev run-through in Task 9, and the Layout test in Task 7 asserts exactly one run carries a prompt.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/Chat/Chat.tsx
git commit -m "feat(chat): allow a run to auto-send its first turn"
```

---

### Task 7: Layout onboarding handoff

**Files:**
- Create: `src/renderer/src/screens/Layout/onboardingIntro.ts`
- Test: `src/renderer/src/screens/Layout/onboardingIntro.test.ts`
- Modify: `src/renderer/src/screens/Layout/chatRuns.ts` (`ChatRun` at lines 9-21)
- Modify: `src/renderer/src/screens/Layout/Layout.tsx` (`LayoutProps` at line 90, view state at line 104, the `<Gateway>` and `<Chat>` render sites)

**Interfaces:**
- Consumes: `FirstAgentHandoff` (Task 3), `Gateway`'s `highlightPlatforms` / `onContinue` (Task 5), `Chat`'s `autoSendPrompt` (Task 6), `window.hermesAPI.testMessagingPlatform(platform, profile?)` returning `{ ok: boolean; message: string; state?: string | null }`.
- Produces:
  - `interface ChannelTestResult { id: string; ok: boolean; message: string }`
  - `function buildIntroPrompt(input: { agentName: string; purpose: string; channels: ChannelTestResult[] }): string`
  - `ChatRun` gains `autoPrompt?: string`
  - `Layout` accepts `onboarding?: FirstAgentHandoff`

- [ ] **Step 1: Write the failing test for the prompt builder**

```ts
// src/renderer/src/screens/Layout/onboardingIntro.test.ts
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/renderer/src/screens/Layout/onboardingIntro.test.ts`
Expected: FAIL — `Failed to resolve import "./onboardingIntro"`.

- [ ] **Step 3: Implement the builder**

```ts
// src/renderer/src/screens/Layout/onboardingIntro.ts
/**
 * Composes the first chat turn after onboarding.
 *
 * The channel checks are run desktop-side (the same test the Gateway screen
 * uses) so their results are facts, not the model's guesswork; the
 * introduction itself is left to the agent. It is a normal, visible user
 * message — nothing about the transcript is hidden from the user.
 */

export interface ChannelTestResult {
  id: string;
  ok: boolean;
  message: string;
}

export function buildIntroPrompt({
  purpose,
  channels,
}: {
  agentName: string;
  purpose: string;
  channels: ChannelTestResult[];
}): string {
  const parts = [
    "I've just set you up. Introduce yourself briefly and tell me what you can help with.",
  ];

  const want = purpose.trim();
  if (want) parts.push(`What I want help with: ${want}.`);

  if (channels.length) {
    const summary = channels
      .map((channel) =>
        channel.ok
          ? `${channel.id}: connected`
          : `${channel.id}: not working (${channel.message})`,
      )
      .join(", ");
    parts.push(`Confirm my channels — ${summary}.`);
  }

  return parts.join(" ");
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/renderer/src/screens/Layout/onboardingIntro.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Let a run carry a prompt**

In `src/renderer/src/screens/Layout/chatRuns.ts`, add to `ChatRun`:

```ts
  /** First turn to send automatically when this run mounts (onboarding). */
  autoPrompt?: string;
```

`mintRun` is unchanged — callers set `autoPrompt` on the returned object.

- [ ] **Step 6: Wire Layout**

Add the import (`import type { FirstAgentHandoff } from "../FirstAgent/FirstAgent";`) and the prop:

```tsx
interface LayoutProps {
  /** Set only on the first run after onboarding: opens the Gateway on the
   *  chosen channels, then hands off to a chat that introduces the agent. */
  onboarding?: FirstAgentHandoff;
  verifyWarning?: boolean;
  onReinstall?: () => void;
  onDismissVerifyWarning?: () => void;
}
```

Start on Gateway when there are channels to connect:

```tsx
  const [view, setView] = useState<View>(
    onboarding?.channels.length ? "gateway" : "chat",
  );
  // Cleared once the handoff has been consumed, so switching back to the
  // Gateway later is an ordinary visit.
  const [onboardingActive, setOnboardingActive] = useState(
    Boolean(onboarding),
  );
```

Add the handoff, and run it immediately when no channels were picked:

```tsx
  const finishOnboarding = useCallback(async () => {
    if (!onboarding) return;
    setOnboardingActive(false);

    const results = await Promise.all(
      onboarding.channels.map(async (id) => {
        try {
          const test = await window.hermesAPI.testMessagingPlatform(id);
          return { id, ok: test.ok, message: test.message };
        } catch (err) {
          return { id, ok: false, message: (err as Error).message };
        }
      }),
    );

    const prompt = buildIntroPrompt({
      agentName: onboarding.agentName,
      purpose: onboarding.purpose,
      channels: results,
    });

    setRuns((prev) => {
      const run = { ...mintRun(activeProfile), autoPrompt: prompt };
      setActiveRunId(run.runId);
      return [...prev, run];
    });
    setView("chat");
  }, [onboarding, activeProfile]);

  const onboardingRanRef = useRef(false);
  useEffect(() => {
    if (!onboarding || onboardingRanRef.current) return;
    if (onboarding.channels.length) return; // waits for the Gateway continue
    onboardingRanRef.current = true;
    void finishOnboarding();
  }, [onboarding, finishOnboarding]);
```

Pass the onboarding props to `<Gateway>`:

```tsx
<Gateway
  profile={activeProfile}
  highlightPlatforms={
    onboardingActive ? onboarding?.channels : undefined
  }
  onContinue={
    onboardingActive
      ? () => {
          onboardingRanRef.current = true;
          void finishOnboarding();
        }
      : undefined
  }
/>
```

and the prompt to `<Chat>`, alongside the existing props:

```tsx
  autoSendPrompt={run.autoPrompt}
```

- [ ] **Step 7: Write the failing Layout test**

Create `src/renderer/src/screens/Layout/Layout.onboarding.test.tsx` (a focused file rather than a general Layout harness). Mock `useI18n`, `useProfileModal`, `useSettingsModal`, `Gateway` and `Chat` with stubs that echo their props:

```tsx
vi.mock("../Gateway/Gateway", () => ({
  default: ({
    highlightPlatforms,
    onContinue,
  }: {
    highlightPlatforms?: string[];
    onContinue?: () => void;
  }) => (
    <div data-testid="gateway" data-highlight={(highlightPlatforms ?? []).join(",")}>
      {onContinue && (
        <button onClick={onContinue} data-testid="gateway-continue">
          continue
        </button>
      )}
    </div>
  ),
}));

vi.mock("../Chat/Chat", () => ({
  default: ({ autoSendPrompt }: { autoSendPrompt?: string }) => (
    <div data-testid="chat" data-auto={autoSendPrompt ?? ""} />
  ),
}));
```

Assert three behaviours:

1. With `onboarding={{ agentName: "Atlas", purpose: "", channels: ["slack"] }}`, the Gateway stub renders with `data-highlight="slack"` and no chat prompt yet.
2. Clicking `gateway-continue` calls `testMessagingPlatform("slack")` and then renders a chat whose `data-auto` contains `slack: connected`.
3. With `channels: []`, no Gateway step appears and a chat with a non-empty `data-auto` is rendered without any click.

Exactly one rendered chat may carry a non-empty `data-auto` — assert that, since it is the double-send guard's real contract.

- [ ] **Step 8: Run the tests and watch them pass**

Run: `npx vitest run src/renderer/src/screens/Layout/`
Expected: PASS — the new file plus the existing `chatRuns`, `ProfileSwitcher`, `ActiveSessionsBar` and `SidebarSessionMenu` tests.

- [ ] **Step 9: Typecheck and commit**

```bash
npm run typecheck
git add src/renderer/src/screens/Layout
git commit -m "feat(onboarding): hand off from channels to an introducing chat"
```

---

### Task 8: Offer the preset in the Agents create modal

**Files:**
- Modify: `src/renderer/src/screens/Agents/Agents.tsx` (`openCreate` at line 189, `handleCreate` at line 202, the modal body around lines 308-380)
- Modify: `src/renderer/src/screens/Agents/Agents.test.tsx` (one new test)
- Modify: `src/shared/i18n/locales/en/agents.ts` (three strings)

**Interfaces:**
- Consumes: `AGENT_PRESETS`, `GENERAL_PRESET` (Task 1), `window.hermesAPI.applyAgentPreset` (Task 2), the existing `createProfile` which returns `{ success: boolean; id?: string; error?: string }`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the strings**

In `src/shared/i18n/locales/en/agents.ts`:

```ts
  presetLabel: "Start from",
  presetGeneral: "General — can do everything, and set up other agents",
  presetBlank: "Blank",
```

- [ ] **Step 2: Write the failing test**

Add to `src/renderer/src/screens/Agents/Agents.test.tsx` (the file's `installHermesAPI` helper needs `applyAgentPreset: vi.fn()` added to its stub object and return type):

```tsx
  it("applies the general preset to a newly created agent", async () => {
    const api = installHermesAPI();
    api.listProfiles.mockResolvedValue([profile("default", true)]);
    api.createProfile.mockResolvedValue({ success: true, id: "atlas" });
    api.applyAgentPreset.mockResolvedValue({ success: true });

    render(
      <Agents
        activeProfile="default"
        onSelectProfile={() => {}}
        onChatWith={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText("default")).toBeTruthy());

    fireEvent.click(screen.getByText("agents.newAgent"));
    fireEvent.change(screen.getByPlaceholderText("agents.namePlaceholder"), {
      target: { value: "Atlas" },
    });
    fireEvent.click(screen.getByText("agents.create"));

    await waitFor(() => expect(api.applyAgentPreset).toHaveBeenCalled());
    expect(api.applyAgentPreset).toHaveBeenCalledWith(
      "general",
      {
        name: "Atlas",
        purpose: "",
        toolsets: {
          web: true,
          browser: true,
          file: true,
          terminal: true,
          code_execution: true,
          vision: true,
          computer_use: false,
        },
      },
      "atlas",
    );
  });
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/renderer/src/screens/Agents/Agents.test.tsx`
Expected: FAIL — `applyAgentPreset` is never called.

- [ ] **Step 4: Implement**

Add `const [preset, setPreset] = useState(GENERAL_PRESET.id);`, reset it to `GENERAL_PRESET.id` in `openCreate`, and render a `<select>` above the name field listing `AGENT_PRESETS` plus a `blank` option (`t("agents.presetBlank")`). When `preset !== "blank"`, hide the clone-config controls — a preset and a clone source are two different answers to the same question.

In `handleCreate`, after a successful `createProfile`:

```tsx
    if (result.success && preset !== "blank" && result.id) {
      const chosen = getAgentPreset(preset);
      if (chosen) {
        const applied = await window.hermesAPI.applyAgentPreset(
          chosen.id,
          { name, purpose: "", toolsets: chosen.toolsets },
          result.id,
        );
        if (!applied.success) {
          setError(applied.error || t("agents.createFailed"));
        }
      }
    }
```

Keep the existing clone path for `blank`: pass `cloneConfig ? cloneSource : null` exactly as today.

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run src/renderer/src/screens/Agents/Agents.test.tsx`
Expected: PASS — the new test plus the existing ones.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/renderer/src/screens/Agents src/shared/i18n/locales/en/agents.ts
git commit -m "feat(agents): create an agent from the general preset"
```

---

### Task 9: Documentation, lat check and a real run-through

**Files:**
- Modify: `lat.md/onboarding.md` (new "First agent" section)
- Modify: `lat.md/agent-settings.md` (note that creation can start from a preset)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS. Investigate any failure before writing docs — a broken neighbour is more important than the documentation.

- [ ] **Step 2: Document the flow**

Add to `lat.md/onboarding.md`, after the "Setup cannot finish without a model" section, a `## First agent` section with a leading paragraph of at most 250 characters, then subsections covering: the screen and its four blocks, the shared preset, the single-call apply, and the Gateway → chat handoff. Link the new symbols as wiki links, for example `[[src/renderer/src/screens/FirstAgent/FirstAgent.tsx#FirstAgent]]`, `[[src/shared/agent-presets.ts#buildGeneralPersona]]`, `[[src/main/agent-presets.ts#applyAgentPreset]]` and `[[src/renderer/src/screens/Layout/onboardingIntro.ts#buildIntroPrompt]]`.

Add one paragraph to `lat.md/agent-settings.md` noting that a new agent can start from a preset that writes its persona and capabilities, linking `[[onboarding#First agent]]`.

Every section needs a leading paragraph — `lat check` enforces it.

- [ ] **Step 3: Run lat check**

Run: `npx --yes lat.md check`
Expected: all wiki links and code refs pass. (The `lat` binary is not on this machine's PATH; `npx lat.md` fetches it. If the check reports a missing symbol, fix the link — do not delete the reference.)

- [ ] **Step 4: Run the app and walk the flow**

```bash
npm run dev
```

The dev server hot-reloads the renderer only — restart it after any main-process or preload change, or you are testing a stale build. Task 2 changed both, so a restart is required here.

To reach a genuine first run without touching your real install:

```bash
HERMES_HOME=$(mktemp -d -t hermes-fresh) npm run dev
```

(the repo's `dev:fresh` script does exactly this). Walk: Welcome → Install → Setup → Meet your agent → Gateway → chat. Confirm by eye:

1. The capability grid shows computer use off.
2. Finishing writes the name into the sidebar and the persona into the Persona tab.
3. Only the ticked channels appear on the Gateway step.
4. The chat opens with **exactly one** auto-sent turn — the StrictMode double-send guard is what this checks — and the agent's reply names its channels.

- [ ] **Step 5: Commit**

```bash
git add lat.md
git commit -m "docs(lat): document first-agent onboarding"
```

- [ ] **Step 6: Open the PR**

```bash
git push -u origin feat/first-agent-onboarding
gh pr create --title "First-agent onboarding with a general preset" --body "$(cat <<'EOF'
## Summary

A fresh install now ends by introducing the agent it just created, rather than
dropping the user into an empty window.

- New "Meet your agent" screen after Setup: name, purpose, capabilities, channels
- A shared general preset — everything on except computer use — that also teaches
  the agent to create and manage other agents
- Ticked channels open the Gateway filtered to them, then hand off to a chat where
  the agent introduces itself and confirms the channel tests
- The same preset is offered in the Agents create modal

## Testing

- `npm test`
- Manual first-run walkthrough against a temporary `HERMES_HOME`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01L9QoTWtc3WgVSH4sHQ6Msp
EOF
)"
```

---

## Execution Log

| Task | Date | Notes |
| --- | --- | --- |
| 1 | 2026-09-07 | `hermes` resolves on PATH *and* `./hermes` works, so the persona names the bare command with the repo-dir fallback. |
| 2 | 2026-09-07 | `HermesAPI` in `src/preload/index.d.ts` also needed the new method — the plan listed only `src/preload/index.ts`. |
| 3 | 2026-09-07 | Plan bug: `gateway.platforms` is already a plain string, so `gateway.platforms.<id>` keys would have collided. Channel labels live under `setup.firstAgent.channels.*` instead. |
| 4 | 2026-09-07 | Committed with task 7 — App passes Layout's new prop, so the two do not typecheck apart. |
| 5 | 2026-09-07 | Implementation written before the test (out of TDD order); the assertions still fail without it. |
| 6 | 2026-09-07 | As planned: ref-guarded effect, no new Chat harness. |
| 7 | 2026-09-07 | The test caught a real bug: panes lazy-mount on first visit, so the initial view had to be seeded into `visitedViews` or onboarding's Gateway never mounted. Also needed a jsdom `ResizeObserver` stub. |
| 8 | 2026-09-07 | The existing clone test encoded the old default; updated to pick "Blank", which is what it was actually testing. |
| 9 | 2026-09-07 | `lat check` passes. Suite: 2012 passed, 10 failed in `gateway-restart`, `terminal-launcher`, `AgentMarkdown` — all pre-existing and flaky (they fail on `main` too, with counts that vary per run). Fresh-install walkthrough not yet run: it needs a real install and an admin password. |
