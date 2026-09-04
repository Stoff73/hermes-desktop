# Memory providers: render the config surface the agent already declares

Status: draft, awaiting approval
Date: 2026-09-04
Prompted by: "look at Honcho and spec how to integrate it into the Hermes agent —
but check whether it is better than what we have, and in line with what we want."

**The short answer to that question: Honcho is already integrated, and it is not
better than the built-in memory for a Hermes One user — it is a different, heavier
thing that some users will want.** This spec is therefore not a Honcho integration.
It is the desktop work that makes the eight memory providers Hermes already ships
honestly usable, with Honcho as the first and richest beneficiary.

**Product context.** Hermes One is a macOS desktop dashboard for creating,
managing and running local agents, where a non-expert is led through onboarding to
build their first agent. Two lines from that vision decide this spec: *honest
status surfaces* and *no hidden capabilities*.

## Problem

Honcho is a first-class memory provider in `hermes-agent`. It ships as a plugin
with OAuth sign-in, device-code login for headless machines, two-layer context
injection, five agent tools, and roughly forty configuration keys. Honcho's own
documentation carries a Hermes integration guide.

The desktop exposes exactly two controls for it: a password box for
`HONCHO_API_KEY`, and an Activate button.

Everything else is invisible. A user cannot see or set `recallMode`,
`dialecticCadence`, `dialecticDepth`, `writeFrequency` or `sessionStrategy`; cannot
sign in with OAuth; cannot see what Honcho has concluded about them. Activating it
from the desktop silently accepts every default, and the defaults are consequential
— `writeFrequency: "async"` sends every turn to a cloud service.

A provider with a reasoning engine and forty settings behind one Activate button is
precisely the hidden capability the product vision says not to ship.

### The framework already solved this, and we did not notice

`plugins/memory/config_schema.py` in the agent opens with:

> "A single generic renderer in the desktop UI and a single generic
> `GET/PUT /api/memory/providers/{name}/config` endpoint pair drive the whole
> experience, so adding a provider config surface is pure declaration with no
> bespoke UI components."

The contract exists and is finished on the agent side:

- Each provider declares its surface in a `config_schema.py` — field `key`, `label`,
  `kind` (`text`, `select`, `secret`, `bool`, `number`, `json`), `default`,
  `description`, `placeholder`, select `options`, and legacy `aliases`.
- `inline: true` marks the curated subset for a compact panel. Everything else
  belongs to a full-config modal, bucketed by `group`.
- Secrets are stored in the env store under `env_key` and **never read back** — the
  API returns only an `is_set` flag.
- `storage` picks the write backend (`flat_json`, or Honcho's host-block form).
- `GET /api/memory/providers/{name}/config?surface=declared&profile=…` returns the
  schema; `PUT` writes values; `POST …/setup` installs pip dependencies and runs
  the provider's setup. All three are profile-scoped.

Honcho declares 324 lines of schema. Hindsight declares 76. The other six declare
none and must render as nothing.

**So the desktop is not missing a Honcho screen. It is missing the generic renderer
the agent was built to feed.** Building a Honcho-specific settings UI would be the
same mistake in a new place.

## Is Honcho better than the built-in memory?

Recorded because it is the question that produced this spec, and because the
answer is the reason Honcho stays opt-in.

| | Built-in five systems | Honcho |
| --- | --- | --- |
| What it is | 2,200 chars of `MEMORY.md`, 1,375 of `USER.md`, FTS over `state.db` | evolving psychological model of each peer, derived asynchronously |
| Install cost | none | cloud account, **or** Docker + Postgres/pgvector + Redis |
| Where data lives | the user's disk | Honcho's cloud unless self-hosted |
| Running cost | none | LLM calls per dialectic cycle, on top of the agent's own spend |
| Freshness | immediate | asynchronous; new messages take a moment to appear |
| Licence | — | AGPL-3.0 |

On capability it is not a close contest — Honcho does something our markdown files
cannot pretend to. On fit for a local-first macOS app that a non-expert installs
and runs, the built-in wins on every row that decides whether onboarding works.

They are not competing. Built-in memory is the floor that always works; Honcho is a
ceiling some users will pay for. That is what "provider" already means, and the
existing architecture is right.

## Goals

- One generic panel that renders any provider's declared schema, so a new provider
  is pure declaration in the agent with no desktop change.
- The curated `inline` fields visible where the user activates a provider; the rest
  behind a full-config modal grouped by `group`.
- Secrets write-only, matching the API: show set/not-set, never a value.
- OAuth sign-in for providers that support it, so Honcho Cloud does not require
  pasting a key.
- Show what an external provider knows, not just how it is configured.
- Providers with no declared schema render exactly as they do today.

## Non-goals

- **Honcho does not become the default.** Onboarding never mentions it. Decided
  with CSJ, 2026-09-04.
- **No bespoke Honcho components.** If Honcho needs something the schema cannot
  express, the fix is a new field kind in the agent, not a special case here.
- **The desktop does not manage infrastructure.** No Docker, no Postgres, no
  starting a local Honcho. A `baseUrl` field for users who already run one is the
  whole of self-hosting support. Decided with CSJ, 2026-09-04.
- **No gateway peer-identity editor.** `pinUserPeer`, `userPeerAliases` and
  `runtimePeerPrefix` are non-inline, so they appear in the full modal as plain
  fields. The CLI wizard's decision tree is not reproduced.
- **No migration between providers.** Switching does not move memory, and the UI
  must not imply it does.
- Nothing in `hermes-agent` changes. If the schema proves insufficient, that is a
  separate change with its own spec.

## Design

### The provider card gains its inline fields

`MemorySystems.tsx`'s External memory providers card renders `MemoryProviders`.
Each provider card today shows name, description, an external link, a password
field per `envVars`, and Activate/Deactivate.

The `envVars` loop is replaced by the declared schema. For a provider with a
schema, the card shows its `inline` fields rendered by kind, plus a **Configure…**
link opening the full modal. For a provider without one, the card is unchanged.

Fields render by kind: `text` and `number` as inputs, `select` as a native select
from `options`, `bool` as a checkbox, `secret` as a write-only password field
showing "Set" or "Not set", `json` as a textarea validated on blur.

### The full-config modal

**Configure…** opens a modal listing every non-inline field, bucketed under its
`group` heading in declaration order, with `description` as help text. Honcho's
groups today are Connection, Memory & Recall, Write Behavior, Session Resolution
and the identity keys.

The modal saves through the same `PUT`. There is no local schema copy: an agent
that adds a field gets it here on next fetch.

### Reading the schema

The desktop already reaches the agent's HTTP API in all three connection modes —
`dashboard-launch.ts` locally, `withRemoteDashboard` for remote, and
`sshEnsureDashboard` over SSH. The provider-config endpoints go through that same
path, so the panel works remotely for free and no new transport is invented.

`discoverMemoryProviders` keeps reading the plugins directory for the provider
*list* — it is a cheap filesystem read that must work with no gateway running. The
schema fetch is separate and may fail; a provider whose schema cannot be fetched
renders as if it declared none, so a stopped gateway degrades to today's behaviour
rather than an error.

### Sign in, don't paste a key

Honcho's plugin ships OAuth and device-code flows, and its README already claims
"the desktop app offers the browser flow as a Connect link next to the
memory-provider dropdown". **We do not have that link** — the claim describes an
affordance hermes-desktop never built.

Where a provider's manifest declares an OAuth flow, the card shows **Connect**
beside the key field, running the flow through the existing setup endpoint and
opening the URL with `openExternal`. The key field stays for users who prefer one.

### What the provider knows

Configuration is the smaller half. The reason to run Honcho is what it concludes
about you, and a memory screen that shows settings but not memory is not a memory
screen.

Where the agent can report it, the card's detail shows the current peer
representation and recent conclusions, read-only, with the same "could not be read"
degradation the built-in systems use. **This is the one part of the spec with no
existing endpoint**, and it is deliberately last: if exposing it needs agent-side
work, ship the config panel without it and treat the read surface as a follow-up
rather than blocking on the agent.

### Activation states the cost

Activating an external provider currently writes `memory.provider` silently.
Because the defaults send conversation to a third party, activation first states
plainly what will happen — that turns are sent to that provider, that it runs
alongside built-in memory rather than replacing it, and where the data goes — with
a link to the provider's docs. One confirmation, not a wizard.

## Error handling

- Schema fetch fails → provider renders with no config surface, as today. No error
  toast; the gateway may simply be stopped.
- `PUT` fails → the field reverts and the message is shown inline on that field.
- Invalid JSON in a `json` field → refuse to save, mark the field, keep the text.
- Provider not installed → the existing "not installed" warning stands, and setup
  is offered through `POST …/setup` rather than a manual pip instruction.
- Secrets never round-trip. Rendering a value the API did not return would be a lie
  about what is stored.

## Testing

Renderer tests mock `useI18n` so `t()` returns the key, per repo convention.

- A schema with one field of each kind renders the matching control.
- Only `inline` fields appear on the card; the rest appear in the modal grouped by
  `group`.
- A provider with no schema renders exactly as before.
- A failed schema fetch degrades to no config surface, not an error state.
- A secret shows set/not-set and never its value; saving writes through `setEnv`.
- Invalid JSON blocks the save and keeps the user's text.
- Saving sends only changed values, scoped to the active profile.
- Activation shows the confirmation before writing `memory.provider`.

## Documentation

`lat.md/memory.md` gains a section on the declared-schema contract and why the
desktop holds no per-provider knowledge. The comparison table above belongs in
`lat.md` too — the reason Honcho is not the default should not live only in a spec.

## Open questions

1. **The read surface has no endpoint.** Peer representation and conclusions are
   reachable from the agent's tools but not over HTTP. Confirm before scoping.
2. **Two providers declare schemas; six do not.** Whether the other six ever get
   one is an agent-side decision. This spec works either way.
3. **AGPL-3.0.** Talking to Honcho over a network API is unaffected. It would
   matter if hermes-desktop ever bundled or derived from Honcho itself — which the
   non-goals rule out, but it should be a conscious rule rather than an accident.
