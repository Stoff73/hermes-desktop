---
type: handover
mode: session-end
date: 2026-09-07
session: 1
repo: hermes-desktop
branch: main
---

# Session Handover — 2026-09-07, Session 1

## Where things stand

Hermes One is publicly downloadable for the first time. **v0.8.1 is released, signed with CSJ's Developer ID and notarised by Apple**, and <https://csjones.co/hermes> serves it. A new user can now go from that page to a working agent: install the app, it installs the Hermes Agent, and onboarding names their first agent and hands off into a chat.

Two strands landed. First, the **first-agent onboarding flow** (PR #3, 18 commits) — a "Meet your agent" screen after Setup that applies a shared general preset, then routes through the Gateway connect step into a chat where the agent introduces itself. Second, **distribution**: a download page, the release pipeline repointed off upstream and onto this fork, macOS signing set up end to end, and two releases cut.

Verified rather than assumed: the published `.dmg` was downloaded and checked (`spctl` → *accepted, Notarized Developer ID*, `Identifier=co.csjones.hermes`), and the packaged app was launched and quit cleanly. **Not** verified: onboarding walked through the *packaged* build (that path was only exercised in dev mode), and auto-update, which is wired but has never run.

## Priorities for the next session

1. **Windows code signing — BLOCKED ON CSJ.** Windows builds ship unsigned and users get a SmartScreen warning. Needs a paid OV or EV code-signing certificate: OV takes days to issue, EV needs a hardware token. This is a purchase decision, not a code one — ask before anything else, since the lead time is external.
2. **Verify auto-update 0.8.0 → 0.8.1.** The feed now points at `Stoff73/hermes-desktop` and `latest-mac.yml` / `latest.yml` published correctly, but the update path has never been exercised. Install the 0.8.0 `.dmg` from the release page and confirm it offers 0.8.1. This is free now and gets harder to test later, once 0.8.0 is nobody's version.
3. **Walk onboarding on the packaged build.** Today's full walkthrough ran against `npm run dev`; the packaged app only got a launch-and-quit smoke test. The code is identical, the packaging is not — asar packing, notarised entitlements and the hardened runtime can all break subprocess spawning, which onboarding depends on completely (it shells out to install the agent).
4. **Patch the agent's silent npm install (upstream repo).** `hermes_cli/main_web_build.py` runs its first install with `--silent`, which sets npm's loglevel to silent, so a failure emits zero bytes and gets reported as a bare `✗ Web UI npm install failed`. That is what made today's `EBADENGINE` root cause invisible. Lives in `NousResearch/hermes-agent`, not here.
5. **Optional: staple the notarisation ticket to the `.dmg` itself.** The app inside is stapled (that is what Gatekeeper checks), but the dmg is not, so the very first open needs a network round-trip to Apple.

## Context to load

- `docs/superpowers/specs/2026-09-07-first-agent-onboarding.md` — why onboarding is shaped this way: shaping the `default` profile rather than creating a second agent, and why the preset's knowledge lives in `SOUL.md`. Read before changing onboarding.
- `docs/superpowers/plans/2026-09-07-first-agent-onboarding.md` — the 9-task plan, all complete, with an execution log recording what surprised each task. The log is the useful part now.
- `docs/RELEASING.md` — **read before cutting any release.** Written today: the `--ff-only` procedure, the five signing secrets, how to verify them locally, and why the mac jobs are pinned to `macos-15`.
- `site/README.md` — how the download page works and the exact `scp` to deploy it.
- `lat.md/onboarding.md` — the "First agent" section documents the shipped flow and links the source symbols.

## Completed this session

**Onboarding** (PR #3, merged `6af66d3`)
- `src/shared/agent-presets.ts` — the general preset and its persona builder, shared by first-run and the Agents create modal (`90a5bbe`)
- `src/main/agent-presets.ts` + `apply-agent-preset` IPC — name, persona and capabilities in one call, so a half-applied preset is a reportable failure (`5cad639`)
- `src/renderer/src/screens/FirstAgent/FirstAgent.tsx` — the screen (`033ba84`)
- Gateway channel filter + continue banner (`19e5868`), Chat `autoSendPrompt` (`39809dd`), Layout handoff + intro prompt builder (`cfc77fb`), Agents preset selector (`6c2027d`)
- `lat.md` documentation (`eaf2279`)

**Fixes found by actually running a fresh install** — none of these were visible from reading the code
- `d6212a9` — the onboarding form was 977px tall in an 850px `overflow:hidden` window. Continue and Skip were **unreachable**: onboarding could not be completed at the default window size.
- `2d50ceb` — a finished install sat on a "Continue to setup" button; it now advances itself after a 2s beat.
- `c48c1ea` — `getEnhancedPath()` prepended nvm/volta/asdf/fnm dirs, so every spawned subprocess used that node even when PATH had a newer one. On this machine (nvm default node 20, PATH node 22) the agent's web-UI build died with `EBADENGINE`.

**Distribution**
- `e7a32b4` — `site/download/index.html`, deployed to `csjones.co/hermes`
- `e4538e4` — stopped dispatching a deploy to the upstream author's landing-page repo
- `885964c` — **repointed the update feed**: `electron-builder.yml` still named `owner: fathah`, so every installed build's auto-updater would have checked another project's releases
- `53c650a` — pinned mac builds to `macos-15`
- `e8fdbe9` — CI guard refusing a release branch that has drifted from `main`, plus `docs/RELEASING.md`
- `dcd96a0` — bundle id `com.nousresearch.hermes` → `co.csjones.hermes`, version 0.8.1
- Releases **v0.8.0** and **v0.8.1** published: macOS arm64/x64 (signed + notarised), Windows installer + portable, Linux AppImage/deb/rpm
- Five GitHub Actions secrets set: `CSC_LINK`, `CSC_KEY_PASSWORD`, `ASC_API_KEY`, `ASC_KEY_ID`, `ASC_ISSUER_ID`

## Verification state

- Touched test suites: **47 passing** at `dcd96a0` (agent-presets shared + main, FirstAgent, Gateway, Layout, Agents, Install)
- Installer suites: **62 passing**
- `npx lat.md check`: **all checks passed**
- Fresh-install walkthrough: install → setup → meet-your-agent → Gateway → chat with **exactly one** auto-sent turn; name, persona and toolsets confirmed on disk. Ran against a temporary `HERMES_HOME`, since deleted.
- Published v0.8.1 `.dmg` downloaded and checked: `Identifier=co.csjones.hermes`, `Authority=Developer ID Application: CHRISTOPHER JOHN SLATER-JONES (99S3M8JLLF)`, `spctl` → accepted, Notarized Developer ID
- Packaged v0.8.0 x64 app: launched, wrote real app state, quit cleanly, no crash reports
- **Full suite: 2012 pass, 10 fail.** The failures are in `tests/gateway-restart.test.ts`, `tests/terminal-launcher.test.ts` and `AgentMarkdown.test.tsx`. They are **pre-existing and flaky** — confirmed failing on `main` in a clean worktree before any of today's changes, with counts that vary run to run (6 then 5). Not caused by this work, not fixed by it.
- **Not verified:** onboarding through the packaged build; auto-update; any Windows or Linux build (never launched); the notarised app's behaviour under the hardened runtime when spawning the agent installer.

## Decisions and dead ends

**Onboarding design** (CSJ chose each of these)
- Shape the existing `default` profile rather than create a second agent — the install already produces a working agent, and an untouched `default` sitting beside a new one confuses people.
- The agent's ability to manage other agents lives in the **persona (`SOUL.md`)**, not a bundled skill: one existing file write, visible and editable in the Persona tab, no new plumbing. Move it to a skill only if it grows unwieldy.
- One screen, plus capability toggles and channel chips (CSJ asked for the tool/channel options on top of the two fields).
- Channels route to the **Gateway screen** filtered to the picks, with an always-enabled Continue, then into a chat. Credentials stay in the Gateway screen, which already does that job.
- The chat's opening turn is a **normal visible user message**; the channel tests run desktop-side (deterministic) and the introduction is left to the agent.

**Distribution**
- Files live on **GitHub Releases**; the page reads the releases API at load. Consequence: **the page never needs redeploying for a new version.** Self-hosting was rejected because it also breaks the auto-updater.
- Static page at `csjones.co/hermes`, not a route in the fynla Laravel app — no coupling to fynla's deploy cycle.
- Page offers macOS + Windows. Linux is published but deliberately not listed.

**Dead ends, each disproved by testing rather than argument**
- `npm_config_local_prefix` leaking from `npm run dev` into a nested `npm ci` — tested, `npm ci` succeeded with it set.
- The installer's `npm install` followed by a git-restored lockfile confusing the later `npm ci` — tested, exit 0.
- Both were plausible and both were wrong; the real cause was the PATH ordering above.

**The signing saga — three hours, worth reading before touching signing again**
- `openssl` 3.x **cannot read Keychain-exported `.p12` files** without `-legacy` and reports it as `Mac verify error: invalid password?`. It told CSJ his correct password was wrong. **Use `security import` into a throwaway keychain to test a `.p12` password.**
- `macos-latest` is now **macOS 26**, where electron-builder's signing fails with `SecKeychainUnlock: The user name or passphrase you entered is not correct`. That message is a lie about the password: `app-builder-lib` creates its temp keychain with a **random** password (`macCodeSign.js:138`) but then calls `security set-key-partition-list -k <the .p12 password>` (line 169). Harmless while the keychain is unlocked, fatal once it locks. Reproduced locally both ways. Fixed by pinning `macos-15`; **do not chase the password if this recurs.**
- `ASC_ISSUER_ID` must be the **UUID** from App Store Connect → Users and Access → Integrations → Keys, shown *above* the table. A **Team Key is the correct kind** (individual keys are unnecessary), and the key's name is cosmetic — CSJ's is named "Fynla" and works fine for this app.
- Apple's **"Apple Distribution" certificate is not usable for direct downloads.** Direct `.dmg` distribution needs **Developer ID Application**, created via Xcode → Settings → Accounts → Manage Certificates → **+**.

## Things that will bite you

- **A second Hermes install hijacks the global `hermes` command.** `install.sh` writes shims into `~/.local/bin` (`hermes`, `hermes-acp`, `hermes-agent`) pointing at whichever install ran last. Today's temp install repointed them, and deleting it left the CLI broken. Repaired by pointing the `exec` lines back at `/Users/CSJ/.hermes`. **If `hermes` ever says "No such file or directory", check those three files first.**
- **Two installs collide on gateway port 8642.** The launchd-supervised gateway owns it, so a second install's app talks to the first one's gateway and fails with `Invalid gateway API key (API_SERVER_KEY)`. Looks like a credentials bug; is not one.
- **Signing key location:** `~/hermes-signing/developer-id.p12` (mode 600). Its password is not recorded anywhere — CSJ holds it. **Back both up:** Developer ID certificates are limited per team and the private key exists only in the keychain that made it.
- **Dev server hot-reloads the renderer only.** Restart after any main-process or preload edit. Worse: an HMR reload resets `App`'s screen state, which will bounce you out of a half-walked onboarding flow.
- **SiteGround caches `csjones.co`.** After deploying the page, verify with `curl "https://csjones.co/hermes/?v=$(date +%s)"` — a plain `curl` served stale content for several minutes today.
- **Keychain Access moved** on macOS 15: `/System/Library/CoreServices/Applications/`, no longer under Utilities.
- **`osascript` has no assistive access on this machine**, so UI automation via System Events fails. The workaround that worked: launch Electron with `--remote-debugging-port` and drive the renderer over CDP (`Runtime.evaluate`).
- **This Mac is Intel (x86_64).** The arm64 `.dmg` fails with "incorrect executable format" — grab the x64 build when testing locally.
- **CSJ's `~/.hermes/hermes-agent` is not clean:** on an Aug 31 commit, `ahead 1 / behind 1` of origin, with a modified `hermes_cli/web_server.py` and a stray `web_server.py.orig`. Untouched today; worth asking about before any agent update.

## Tech debt deferred

The `tech-debt-session` skill is **not installed** on this machine (`~/.claude/skills/` has only context-handover, session-end, session-start), so no automated audit ran over the changed files. Known debt from the session itself:

- `src/renderer/src/screens/Chat/Chat.tsx` — `autoSendPrompt` is a ref-guarded mount effect with **no test**; `Chat` has no test file in this repo and standing one up for a five-line effect was judged not worth it. The double-send contract is asserted indirectly in `Layout.onboarding.test.tsx`.
- Release workflow: mac matrix is fail-fast, so an x64 failure cancels arm64 and hides whether arm64 would also have failed. Cost a debugging cycle today.
- The `.dmg` is not stapled (the app inside is).
- Pre-existing flaky tests in `gateway-restart`, `terminal-launcher`, `AgentMarkdown` — see Verification state.
- `src/renderer/src/screens/Install/Install.tsx` — `INSTALL_DONE_ADVANCE_MS` is a bare 2s constant; fine, but it is a timing assumption no test pins beyond the one it was written with.

## Branch and deploy state

- Branch: `main`, clean tree
- `main` and `release` both at `dcd96a0` — the CI drift guard enforces this from now on
- Unpushed commits: none
- Deployed: <https://csjones.co/hermes> (SiteGround, `~/www/csjones.co/public_html/hermes/index.html`, over `ssh -p 18765 -i ~/.ssh/fynlaDev u163-ptanegf9edny@ssh.csjones.co`)
- Released: <https://github.com/Stoff73/hermes-desktop/releases/tag/v0.8.1>
