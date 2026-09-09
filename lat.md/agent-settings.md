# Agent Settings

The profile modal is the per-agent settings screen: everything about one agent — identity, persona, model, memory, wallet, sync — is configured there, and the rest of the app links into it rather than duplicating its controls.

An agent is a Hermes profile (`~/.hermes/profiles/<id>/`, the default at `~/.hermes`) with its own `config.yaml`, `.env`, `SOUL.md`, memories and `state.db`. [[src/renderer/src/components/profile/ProfileModal.tsx#ProfileModal]] opens from the Agents screen, the profile switcher and the Memory overview, optionally at a named tab.

## Starting from a preset

A new agent can be created from a preset that writes its persona and capabilities, not just its name — see [[onboarding#First agent]].

The Agents screen's create modal offers the shared general preset (the default) or "Blank", which keeps the original create-then-clone behaviour. Picking a preset skips the clone source, since a preset and a clone are two answers to the same question.

## Tabs

Profile, Persona, Memory, Wallet, Sync, Advanced. Persona is the agent's system prompt (`SOUL.md`) and stays its own tab; Memory holds the systems inventory from [[memory]].

The openers say "Agent settings" and the modal carries an "Agent settings" kicker above the agent's name, so the screen names itself.

## Model and provider

The Profile tab pins this agent's LLM model and provider, saved to its own `config.yaml`, using the chat's model hook and picker in persist mode.

[[src/renderer/src/components/profile/ProfileModelPicker.tsx#ProfileModelPicker]] mounts the chat's picker ([[src/renderer/src/screens/Chat/ModelPicker.tsx#ModelPicker]]) driven by `useModelConfig(profile.id)`; the chat uses the same pair for its session-only override, so no new plumbing exists below the renderer. The model library is desktop-global; the pick is per agent.

The picker's dropdown opens upward in chat, where it sits at the bottom of the window. In the modal the trigger is near the top, so a scoped rule flips it down and caps it to the space below; left as-is it was clipped by the modal body.

### Credentials are per agent

Each profile has its own `.env` and `auth.json`, so a provider the agent has no key for fails at runtime; the Profile tab runs the per-profile config health check after each pick and offers an inline key field.

When the check reports `MODEL_KEY_MISSING` the field saves the reported key into this agent's `.env` through `setEnv` and re-checks. The check already accounts for OAuth credentials, credential vaults and compatible-endpoint fallbacks. OAuth providers must be connected from Providers with that agent active. A failed check never blocks the picker.

## Working folder

The Profile tab also picks the folder this agent's terminal and file tools start in, saved to `terminal.cwd` in its own `config.yaml`.

[[src/renderer/src/components/profile/ProfileWorkFolder.tsx#ProfileWorkFolder]] only reads and writes a config key that already existed and had no UI. It is a workspace setting, not a memory system, which is why it sits beside the model rather than in the Memory tab. The stored default is `.`, which means nothing to a reader, so it is shown by name and a reset writes it back.

## Tests

Renderer tests mock `useI18n`, the model hook and the picker so they assert persistence and the key flow, not dropdown mechanics.

### Model pick persists to the agent

The hook is bound to the given profile id and a selection calls `selectModel` with `persist: true`.

A clean health check shows no key field; a `MODEL_KEY_MISSING` issue shows the field and saving writes that key for that agent; a failed check still renders the picker.

### Working folder

The stored `.` default is shown by name with no reset offered; choosing a folder writes `terminal.cwd` for that profile; reset writes `.` back; a cancelled dialog writes nothing.

## Creating an agent from chat

Asking any agent to "create an agent that …" follows a bounded recipe the desktop ships as a skill: create the profile, write its persona from the request, report, stop.

The chat agent used to reach for the upstream `hermes-agent` hub skill, which documents the whole CLI and leaves the model to improvise — one session spent ten minutes fetching docs, running `--help`, creating cron jobs, installing a launchd service and symlinking credentials for a request that needed one profile and a persona. [[src/main/create-agent-skill.ts#CREATE_AGENT_SKILL]] is the desktop's own `create-agent` skill: four tool calls (create the profile cloned from the current one so it inherits providers and keys, record the display name in `profile-meta.json`, write `SOUL.md` from the same persona shape the New Agent preset uses, report with every assumption stated), at most one clarifying question and only after creation, and an explicit list of side effects it must not perform unasked — services, schedules (a cadence in the request is confirmed, not acted on), skill installs, credential or config edits, test queries, doc reading, debugging.

### Installed into every profile

[[src/main/create-agent-skill.ts#ensureCreateAgentSkill]] writes the skill into `<profile home>/skills/hermes-one/create-agent/SKILL.md`, rewriting only when the content changed.

The default profile's copy lives under the Hermes home. The install runs at app start ([[src/main/app/start.ts#startMainProcess]] — the only point guaranteed to run when the gateways were started by launchd, not the desktop), when the desktop starts a gateway, when it creates a profile, and once at gateway initialisation for every existing profile ([[src/main/create-agent-skill.ts#ensureCreateAgentSkillEverywhere]]), so gateways the desktop did not start still see it. It is best-effort: a failure to write the skill never blocks a gateway start or a profile creation.
