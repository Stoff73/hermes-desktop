# Agent Settings

The profile modal is the per-agent settings screen: everything about one agent — identity, persona, model, memory, wallet, sync — is configured there, and the rest of the app links into it rather than duplicating its controls.

An agent is a Hermes profile (`~/.hermes/profiles/<id>/`, the default at `~/.hermes`) with its own `config.yaml`, `.env`, `SOUL.md`, memories and `state.db`. [[src/renderer/src/components/profile/ProfileModal.tsx#ProfileModal]] opens from the Agents screen, the profile switcher and the Memory overview, optionally at a named tab.

## Tabs

Profile, Persona, Memory, Wallet, Sync, Advanced. Persona is the agent's system prompt (`SOUL.md`) and stays its own tab; Memory holds the five-system inventory from [[memory]].

The openers say "Agent settings" and the modal carries an "Agent settings" kicker above the agent's name, so the screen names itself.

## Model and provider

The Profile tab pins this agent's LLM model and provider, saved to its own `config.yaml`, using the chat's model hook and picker in persist mode.

[[src/renderer/src/components/profile/ProfileModelPicker.tsx#ProfileModelPicker]] mounts the chat's picker ([[src/renderer/src/screens/Chat/ModelPicker.tsx#ModelPicker]]) driven by `useModelConfig(profile.id)`; the chat uses the same pair for its session-only override, so no new plumbing exists below the renderer. The model library is desktop-global; the pick is per agent.

### Credentials are per agent

Each profile has its own `.env` and `auth.json`, so a provider the agent has no key for fails at runtime; the Profile tab runs the per-profile config health check after each pick and offers an inline key field.

When the check reports `MODEL_KEY_MISSING` the field saves the reported key into this agent's `.env` through `setEnv` and re-checks. The check already accounts for OAuth credentials, credential vaults and compatible-endpoint fallbacks. OAuth providers must be connected from Providers with that agent active. A failed check never blocks the picker.

## Tests

Renderer tests mock `useI18n`, the model hook and the picker so they assert persistence and the key flow, not dropdown mechanics.

### Model pick persists to the agent

The hook is bound to the given profile id and a selection calls `selectModel` with `persist: true`.

A clean health check shows no key field; a `MODEL_KEY_MISSING` issue shows the field and saving writes that key for that agent; a failed check still renders the picker.
