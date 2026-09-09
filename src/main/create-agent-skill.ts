import { existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { HERMES_HOME } from "./installer";
import { isValidNamedProfileName, profileHome, safeWriteFile } from "./utils";

// @lat: [[agent-settings#Creating an agent from chat]]

/**
 * The skill the chat agent follows when asked to create another agent: create
 * the profile, write its persona from the request, stop. Shipped by the
 * desktop into every profile's skills folder so it is found whichever agent
 * the user is talking to — the upstream hub skill it would otherwise read
 * describes the whole CLI and leaves the model to improvise (ten minutes of
 * doc fetches, `--help` calls, cron jobs and launchd services, unasked).
 */
export const CREATE_AGENT_SKILL = `---
name: create-agent
description: "Create a new Hermes agent from a request: create the profile, write its persona from what was asked, stop. Ask at most one question, only if the name or purpose is missing."
version: 0.1.0
author: Hermes One
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Agents, Profiles, Persona, Hermes One]
---

# Create an agent

Turn "create an agent that …" into a working agent in one short pass: create
the profile, give it a persona built from the specialisations in the request,
then hand it to the user. Everything you need is in this file — do not read
docs, run \`--help\`, or explore the CLI first.

## When to use

- "Create an agent that …" / "Make me an assistant for …"
- "Set up a specialist agent to …"
- "I want a bot that …"

## Procedure — four tool calls, under a minute

1. **Derive the identity from the request.** Display name: what the user
   called it, else a short role name ("Concierge", "Inbox Triage").
   Profile id: the display name lowercased, letters/digits/hyphens only
   (\`concierge\`, \`inbox-triage\`). Purpose: the request's specialisations —
   what it watches, what it produces, what it must never do on its own.
2. **Create the profile**, cloned from the agent you are running as so it
   inherits the user's providers and keys. Run from \`~/.hermes/hermes-agent\`
   (use \`./hermes\` if \`hermes\` is not on PATH):

   \`\`\`bash
   hermes profile create <id> --clone-from <your-profile-id-or-default>
   \`\`\`

   Then record the display name the desktop shows, and empty the memory
   files the clone copied from the source agent — a new agent must not
   inherit another agent's notes about repos, backups or workflows:

   \`\`\`bash
   printf '{"name": "<Display Name>"}\\n' > ~/.hermes/profiles/<id>/profile-meta.json
   : > ~/.hermes/profiles/<id>/memories/MEMORY.md
   : > ~/.hermes/profiles/<id>/memories/USER.md
   \`\`\`
3. **Write the persona** to \`~/.hermes/profiles/<id>/SOUL.md\` (overwrite the
   cloned one) using the template below, filled from the request.
4. **Report and stop.** Reply with: the name and id, what it will do, and every
   assumption you made ("drafts replies for your review; never sends"). Tell
   the user to open it from the profile switcher at the bottom of the sidebar
   and start a chat. If the request gave no usable name or purpose, ask ONE
   question now — after creating, not before.

## Persona template

\`\`\`markdown
# <Display Name>

You are <Display Name>, a specialist assistant running on your user's own
machine.

## What you were asked to help with

<The request's specialisations rewritten as a standing brief: what to watch,
what to produce, for whom. Two to six lines.>

## How you work

- Draft, propose and report. Do not send messages, change calendars, or act
  outside this machine without the user's explicit approval in the current
  conversation.
- Say what you are about to do before doing anything with side effects.
- Match the length of your reply to the weight of the ask.

## Boundaries

<Anything the request excluded or flagged, e.g. "mark suspected spam for
deletion — never delete it yourself".>
\`\`\`

## Do NOT do any of these unless the user asked for it in so many words

- Install, start or restart gateways or launchd/systemd services.
- Create cron or scheduled jobs. A cadence in the request ("check every
  15 minutes") is a *schedule request to confirm*: create the agent, then ask
  "Want me to schedule it to run every 15 minutes?" and stop.
- Install skills, or copy, symlink or edit credentials, tokens, \`.env\` or
  \`config.yaml\`.
- Run test queries against the user's mail, calendar, files or accounts.
- Read hermes-agent source or documentation, or run \`--help\`.
- Debug: if a step fails, report the exact error and stop.

Creating an agent is cheap. A surprise service that starts touching the
user's inbox is not.
`;

const SKILL_RELATIVE_PATH = join(
  "skills",
  "hermes-one",
  "create-agent",
  "SKILL.md",
);

/**
 * Write the create-agent skill into a profile's skills folder (the default
 * profile's lives directly under the Hermes home). Returns true when the file
 * was written, false when it was already current or could not be written.
 */
export function ensureCreateAgentSkill(profile?: string): boolean {
  // Never let a skill install take a gateway start or profile creation down.
  try {
    const file = join(profileHome(profile), SKILL_RELATIVE_PATH);
    if (
      existsSync(file) &&
      readFileSync(file, "utf-8") === CREATE_AGENT_SKILL
    ) {
      return false;
    }
    mkdirSync(join(file, ".."), { recursive: true });
    safeWriteFile(file, CREATE_AGENT_SKILL);
    return true;
  } catch {
    return false;
  }
}

/** Install the skill for the default profile and every named profile. */
export function ensureCreateAgentSkillEverywhere(): void {
  ensureCreateAgentSkill();
  const dir = join(HERMES_HOME, "profiles");
  if (!existsSync(dir)) return;
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    try {
      if (isValidNamedProfileName(name)) ensureCreateAgentSkill(name);
    } catch {
      // best-effort per profile
    }
  }
}
