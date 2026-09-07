# Onboarding Chrome

The first-run screens (Welcome, Install) share one cinematic shell — a dark aurora backdrop, twinkling starfield, and an animated Hermes emblem — provided by [[src/renderer/src/components/common/OnboardHero.tsx#OnboardHero]]. Titles are upright sans; the design intentionally runs dark regardless of theme.

The `.onboard-screen` CSS scope owns `color-scheme: dark`, its dark surface and text tokens, and its background colour. It never inherits saved light-theme tokens, so the first frame and every onboarding child retain the designed contrast. [[tests/onboarding-theme.test.ts]] protects that scope.

## OnboardHero

[[src/renderer/src/components/common/OnboardHero.tsx#OnboardHero]] renders the shared `onboard-*` chrome: aurora + vignette + starfield backdrop, a glowing emblem, an uppercase `eyebrow` label, an upright `title`, and page-specific `children` inside a reveal-on-settle body.

Props: `eyebrow`, `title`, `children`, `intro` (play the full intro), `wide` (widen the column for the installing terminal). All visual tokens live under the `ONBOARDING HERO (shared)` block in `main.css`.

The screens are `user-select: none` chrome; only `input`, `textarea`, `code`, and `[data-selectable]` stay selectable (so the install path and log can still be copied).

### Intro choreography

When `intro` is set (the Welcome screen), the emblem draws itself **big in the centre**, then flies up and shrinks into its settled slot before the content cascades in.

The component holds a `phase` of `draw → settle → done`. On mount a timer at `DRAW_MS` (the stroke-draw + fill completes) measures the settled emblem's `getBoundingClientRect`, sets the flying logo's transform to translate/scale into that slot, and switches to `settle`; a second timer at `DRAW_MS + SETTLE_MS` switches to `done`, which removes the flying overlay and runs the reveal cascade via the `[data-phase="done"]` CSS rules. `prefers-reduced-motion` skips straight to `done` with no fly.

The stroke-draw itself is pure CSS: each emblem path animates `onboardDraw` (dash offset) → `onboardFill` (fill-opacity) → `onboardStrokeOut`, staggered per path via the `.onboard-fp{1..4}` classes.

## Welcome

[[src/renderer/src/screens/Welcome/Welcome.tsx#Welcome]] is the default first-run view. Its no-error state renders through `OnboardHero intro`.

The hero carries the "HERMES ONE" eyebrow, subtitle, a gradient "Get Started" pill, and glass "Connect via SSH" / "Connect to Remote Hermes" pills. The install-error state and the SSH / remote connect panels keep the legacy `.welcome-screen` layout.

## Install confirm + progress

[[src/renderer/src/screens/Install/Install.tsx#Install]] renders both the pre-install confirmation and the running progress through `OnboardHero` (no intro — the emblem fades in place).

The confirm view (eyebrow "SETUP", title "Before installing") shows the target path in an `.onboard-field`, a `.onboard-note-card` describing the fresh/update/replace state, and Install / Use-existing / Cancel actions.

The progress view (`wide`) shows a step + percent header with a progress bar, then a **fixed-size** terminal log window (`.onboard-terminal`): its body has a constant height and scrolls internally, so streaming log lines never reflow the surrounding layout. The log auto-scrolls to the newest line.

## Startup splash

The very first frame on launch is still [[src/renderer/src/screens/SplashScreen/SplashScreen.tsx]], shown by [[src/renderer/src/App.tsx#App]] while `runInstallCheck` runs. It is separate from the onboarding chrome above — see [[main-process]] for its "Switch to local mode" escape hatch.

## Setup cannot finish without a model

The first-run provider screen requires a model, chosen from the provider you just picked.

Setup previously offered a free-text model box marked *optional*, and only for the local and no-key branches — providers that need an API key had no model field at all. Continuing wrote `model.default: ""`, and the app opened straight onto the composer's "No model selected" banner. [[src/renderer/src/screens/Setup/SetupModelField.tsx#SetupModelField]] now renders in all three branches, asks `discoverProviderModels` for that provider's catalog (debounced, because the API key is typed a character at a time) and offers only those models. Continue stays disabled until one is chosen, and switching provider clears the pick, since a model id from one provider means nothing to the next.

Discovery legitimately fails — no key yet, an unreachable custom endpoint, a provider with no catalog endpoint — and a hard requirement plus a failed lookup would be a dead end, so the field degrades to the free-text box it used to be rather than trapping the user.

### Model field is scoped to the provider

The select offers exactly the models discovery returned for the chosen provider and reports a pick to its parent; a failed or rejected lookup falls back to a text input instead of leaving no way to continue.


## First agent

Setup no longer ends at the main window. A fresh install continues into [[src/renderer/src/screens/FirstAgent/FirstAgent.tsx#FirstAgent]], where the user names and shapes the agent the installer already created.

The install produces the `default` Hermes profile that every screen points at, but nobody ever introduced it: no name, a stock persona, no stated capabilities. This screen is that introduction. Setup only runs when the install has no provider key, so the path is fresh-install-only without a new marker file, and existing users never see it. Skip writes nothing and leaves the unmodified default agent.

### The screen

One `OnboardHero` page with four blocks: a name (prefilled from the preset), one line on what the agent should help with, a capability grid, and channel chips.

Capabilities are the [[src/main/tools.ts#getToolsets]] keys, labelled with the Tools screen's own strings so the two can't describe a capability differently. Everything is on except `computer_use`, which drives the real mouse and keyboard and carries a warning line — a deliberate tick, never a default. Channel chips record intent only; ids match the Gateway's platform ids so the handoff passes straight through as a filter.

A blank name reports "Give your agent a name." rather than silently disabling Continue, and a failed apply is shown inline instead of handing off.

### The general preset

[[src/shared/agent-presets.ts#GENERAL_PRESET]] is one definition shared by first-run and the Agents create modal, so "general" can only mean one thing.

[[src/shared/agent-presets.ts#buildGeneralPersona]] is plain interpolation — no model call. The persona names the agent, repeats the stated purpose (omitted when blank), and teaches the `hermes profile` commands, the per-profile layout, and how to write another agent's `SOUL.md` and `platform_toolsets`. That is what makes the general agent able to set up and manage other agents: the knowledge is in the persona and the mechanism is the terminal capability it already has. It sits in the persona rather than a bundled skill because that is one existing file write, visible and editable in the Persona tab.

### Applying it is one call

[[src/main/agent-presets.ts#applyAgentPreset]] writes the name, the persona and every capability key, in that order, behind the `apply-agent-preset` IPC handler.

One call rather than three from the renderer: a half-applied preset — named but with no persona — is reported as a failure the user can retry, instead of a silently odd agent. Each capability is written explicitly rather than relying on the engine's "no `platform_toolsets` section means everything is on" default, so the stored config states what was chosen. The three writes are the existing [[src/main/profile-meta.ts#setProfileName]], [[src/main/soul.ts#writeSoul]] and [[src/main/tools.ts#setToolsetEnabled]].

### Handoff through the Gateway into chat

With channels ticked, `Layout` opens on the Gateway filtered to exactly those platforms, with a banner whose Continue is always enabled.

Credentials stay in the Gateway screen, which already does that job properly. Continue is never blocked, so a user who cannot finish a connection now is not trapped — whatever they connected is what gets tested. On continue (or immediately, when no channels were picked) the desktop runs the same `test-messaging-platform` check the Gateway uses and composes the opening turn with [[src/renderer/src/screens/Layout/onboardingIntro.ts#buildIntroPrompt]]: deterministic test results, with the introduction left to the agent. It is sent as a normal, visible user message through `Chat`'s `autoSendPrompt`, ref-guarded because StrictMode double-invokes mount effects in dev and two sends would start two agent turns.

Panes lazy-mount on first visit, so `visitedViews` counts the initial view as visited — otherwise onboarding's Gateway would never mount.
