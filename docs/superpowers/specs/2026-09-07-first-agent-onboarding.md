# First-agent onboarding: meet the general agent

Status: approved 2026-09-07; plan at `docs/superpowers/plans/2026-09-07-first-agent-onboarding.md`
Date: 2026-09-07
Prompted by: "if it is a fresh install, we do need to run the user through creating
their first agent, we should have a general agent preset, one that can do everything
and also set up other agents as well as manage if need be."

**Product context.** Hermes One is a desktop dashboard for creating, managing and
launching local agents, where a non-expert is led through onboarding to build their
first agent. This spec covers the last missing step of that path: the moment the
user meets, names and shapes the agent the installer already gave them.

## Problem

A fresh install today ends one step early. The user is walked through downloading
the app, installing the agent, and choosing a model provider — and is then dropped
into an empty main window with no agent they recognise, no idea what it can do, and
no reason to type anything.

The agent is in fact already there: the install creates the `default` Hermes profile,
which every screen points at. Nobody ever introduces it. It has no name, a stock
persona, and no stated capabilities. Creating a *second* agent, from the Agents
screen, is a bare modal asking for a name and offering to copy an existing agent —
no preset, no persona, no capability choice.

The result is an app that finishes setup by presenting a blank page.

## What already exists

The implementation is mostly wiring, because every underlying operation is built:

| Need | Existing API |
| --- | --- |
| Name an agent | `set-profile-name` IPC → `src/main/profile-meta.ts#setProfileName` |
| Write a persona | `write-soul` IPC → `src/main/soul.ts#writeSoul` |
| Read/set capabilities per agent | `get-toolsets` / `set-toolset-enabled` → `src/main/tools.ts#getToolsets`, `src/main/tools.ts#setToolsetEnabled` |
| Connect a channel (Slack, WhatsApp, email, Telegram, Discord, Signal…) | The Gateway screen, `get-messaging-platforms` / `update-messaging-platform` |
| Test a channel connection | `test-messaging-platform` IPC |
| Create further agents | `create-profile` IPC → `src/main/profiles.ts#createProfile`, and the `hermes profile` CLI |
| First-run screen chrome | `src/renderer/src/components/common/OnboardHero.tsx#OnboardHero` |

Nothing in the agent engine changes. The `hermes profile` CLI is confirmed working
from the desktop's own install (`./hermes profile list` inside
`~/.hermes/hermes-agent` lists profiles, models and gateway state).

## Design

### Flow

```text
Welcome → Install → Setup → Meet your agent → [Gateway: connect channels] → Chat
```

"Meet your agent" is a new screen in `App.tsx`'s `Screen` union, entered when Setup
completes. Setup itself only runs when the install has no provider key, so this path
is naturally fresh-install-only — existing users never see it and no new
"has-onboarded" marker file is introduced.

The Gateway step is conditional: it appears only if the user ticked at least one
channel. With no channels ticked, Finish goes straight to chat.

### Screen: Meet your agent

One screen inside `OnboardHero` (eyebrow "YOUR AGENT"), four blocks:

1. **Name** — text field, prefilled with the preset's suggested name, editable.
   Required: Continue with a blank name shows "Give your agent a name." rather
   than a silently disabled button, and nothing is written.
2. **What should it help you with?** — a single line of free text, optional. It is
   interpolated into the persona; empty means the persona omits that section.
3. **Capabilities** — a grid of toggles over the curated toolset keys below.
4. **Channels** — chips for Email, Slack, WhatsApp, Telegram, Discord, Signal. These
   record intent only; no credential fields appear here.

Skip is available and writes nothing — the user lands in the app with today's
unmodified default agent.

#### Capability defaults

| Key | Default | Why |
| --- | --- | --- |
| `web` | on | Internet search is what a general agent is expected to do. |
| `browser` | on | Browsing pages follows from search. |
| `file` | on | Reading and writing local files. |
| `terminal` | on | Also the mechanism for managing other agents. |
| `code_execution` | on | Running code it writes. |
| `vision` | on | Reading images and screenshots. |
| `computer_use` | **off** | It drives the real mouse and keyboard. A deliberate tick, with a one-line warning under it. |

The engine treats a config with no `platform_toolsets.cli` section as "everything
enabled", so applying the preset always writes the section explicitly rather than
relying on that default — otherwise switching `computer_use` off would be the only
write and the stored state would be misleading.

### The general preset

A single shared definition in `src/shared/agent-presets.ts`, used by both entry
points:

```ts
export interface AgentPreset {
  id: string;                    // "general"
  suggestedName: string;         // prefills the name field
  toolsets: Record<string, boolean>;
  buildPersona(input: { name: string; purpose: string }): string;
}
```

`buildPersona` is plain string interpolation — no model call. It produces a persona
with three parts: who the agent is, what the user said they want help with (omitted
when blank), and a section on managing other agents.

The Agents screen's create modal gains a preset selector using the same definition
("General" or "Blank / clone", the latter being today's behaviour), so the preset
is not onboarding-only code.

### Persona: managing other agents

The preset's persona teaches the agent, in prose, how the local agent estate works
and which commands operate on it:

- Each agent is a Hermes profile: `~/.hermes` is `default`; named ones live in
  `~/.hermes/profiles/<id>/`, each with its own `config.yaml`, `.env`, `SOUL.md`,
  memories and `state.db`.
- List, create, clone and switch with `hermes profile list|create|use`, run from
  `~/.hermes/hermes-agent`.
- Give a new agent a persona by writing its `SOUL.md`; change its capabilities by
  editing `platform_toolsets.cli` in its `config.yaml`.
- Say what it is about to create or change, and confirm, before doing it.

**Implementation note:** the exact invocation must be verified from inside the
agent's own terminal tool before the persona text is finalised — whether `hermes`
resolves on its PATH or must be called as `./hermes` from the repo directory. Both
were confirmed to work from a normal shell; the agent's terminal environment is what
the persona has to be correct about.

This lives in the persona rather than a bundled skill because the persona is one
existing file write, is visible and editable in the Persona tab, and needs no new
plumbing. If it grows unwieldy it moves to a skill later — the skill system
(`src/main/skills.ts`, bundled skills under `~/.hermes/hermes-agent/skills/`) is
already there.

### Applying the preset

A new `src/main/agent-presets.ts` exposes `applyAgentPreset(presetId, { name,
purpose, toolsets }, profile?)`, registered as one IPC handler. It performs three
writes in order — name, persona, each toolset key — and returns
`{ success: true }` or `{ success: false, error }` naming the step that failed.

One call rather than three from the renderer, so a half-applied preset is reported
as a failure the user can retry instead of silently leaving an agent named but
without its persona.

### Gateway step

Layout accepts an optional `onboarding` prop: `{ agentName, purpose, channels }`.
When present and `channels` is non-empty it opens on the Gateway view instead of
chat, and passes to `Gateway`:

- `highlightPlatforms: string[]` — filters the platform list to the chosen channels,
  so the user sees six fields rather than twenty-odd platforms.
- An onboarding banner above the list: what this step is for, and a **Continue to
  chat** action, always enabled. A user who cannot finish a connection now is never
  trapped; whatever they connected is what gets tested.

### Chat handoff

On Continue (or immediately, when no channels were chosen), Layout switches to the
chat view and mints a run whose `autoSendPrompt` is a composed first user turn.

Before sending, Layout calls the existing `test-messaging-platform` IPC once per
chosen channel and folds the results into the prompt text. The tests are
deterministic desktop-side checks; the introduction is the agent's own words. The
prompt reads as something the user plausibly said, for example:

> I've just set you up. Introduce yourself briefly, tell me what you can help with,
> and confirm my connected channels — Slack: connected, Email: failed
> (authentication rejected).

It is a normal, visible user message in the transcript. Nothing is hidden from the
user, and no new message role or transcript concept is introduced.

`Chat` gains `autoSendPrompt?: string`, sent exactly once on mount, guarded by a ref
so a re-render or a background-run remount cannot send it twice.

## Non-goals

- No credential fields in onboarding — channel connection stays in the Gateway
  screen, which already does it properly.
- No Hermes One account sign-in in first run. Still Providers-screen only.
- No second, third or themed preset. One general preset, with the shape in place for
  more.
- No guided tour of the app's other screens.
- No changes to the `hermes-agent` repo.

## Edge cases

- **Quit during the Gateway step.** The preset is already applied, so the agent is
  named and shaped; only the intro chat turn is lost. Next launch is a normal launch.
- **Preset apply fails.** Inline error on the screen naming the failed step, with
  retry and skip. Never a silent continue.
- **Channel test fails or times out.** Reported in the prompt as failed; it never
  blocks the handoff to chat.
- **Name collides / is invalid.** Rejected inline by the same validation the profile
  layer uses, before any write.
- **Skip.** No writes at all. The user gets exactly today's behaviour.

## Testing

Following the existing patterns in each folder (renderer tests mock `useI18n` and
the `hermesAPI` surface; main-process tests hit real temp dirs).

- `src/shared/agent-presets.test.ts` — persona interpolation with and without a
  purpose line, and the default toolset map.
- `src/main/agent-presets.test.ts` — a successful apply writes name, persona and
  every toolset key; a failing step returns `{ success: false }` naming it.
- `src/renderer/src/screens/FirstAgent/FirstAgent.test.tsx` — defaults (computer use
  off), Continue disabled on an empty name, Skip writes nothing, Finish sends the
  expected payload.
- `src/renderer/src/screens/Gateway/Gateway.test.tsx` — `highlightPlatforms` filters
  the list; the continue banner appears only in onboarding mode.
- `Chat` has no test file in this repo (it is covered through its extracted
  helpers), so the auto-send is a ref-guarded effect verified by the Layout test
  below — exactly one run carries a prompt — plus the manual first-run walkthrough.
  Standing up a full `Chat` harness for a five-line effect is not worth it.
- `src/renderer/src/screens/Layout/Layout.test.tsx` — onboarding with channels opens
  Gateway then chat; onboarding without channels opens chat directly.

## Documentation

`lat.md/onboarding.md` gains a "First agent" section covering the screen, the
preset and the Gateway → chat handoff; `lat.md/agent-settings.md` gains a note that
agent creation can start from a preset. Both reference the new source symbols, and
`lat check` must pass.

## Files

New:

- `src/shared/agent-presets.ts` (+ test)
- `src/main/agent-presets.ts` (+ test)
- `src/renderer/src/screens/FirstAgent/FirstAgent.tsx` (+ test)

Modified:

- `src/main/ipc/register.ts` — one handler
- `src/preload/index.ts` — one method
- `src/renderer/src/App.tsx` — new screen in the flow, carries the onboarding
  handoff into Layout
- `src/renderer/src/screens/Layout/Layout.tsx` — `onboarding` prop, initial view,
  channel tests, seeded run
- `src/renderer/src/screens/Gateway/Gateway.tsx` — `highlightPlatforms`, onboarding
  banner
- `src/renderer/src/screens/Chat/Chat.tsx` — `autoSendPrompt`
- `src/renderer/src/screens/Agents/Agents.tsx` — preset selector in the create modal
- i18n locale files — new strings
- `main.css` — screen styles within the existing `.onboard-*` scope
