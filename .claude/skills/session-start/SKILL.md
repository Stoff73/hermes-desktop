---
name: session-start
description: Use at the start of any hermes-desktop session before other work — when CSJ says "start session", "/session-start", "where were we", "pick up", "continue from yesterday", or opens a session after /clear expecting work to resume. Reads the handover the repo-local session-end skill writes into handover/<Month>/<DD>/.
---

# Session Start — hermes-desktop

Resume from the latest handover in `handover/<Month>/<DD>/`. This is the repo-local skill: no Obsidian vault, no other repos, no legacy `*Updates` layout.

A handover is testimony from a session that has ended. Commits may have landed since. Read it, verify it, then work.

## 1. Find the latest handover

```bash
find handover -name 'handover-*.md' | sort | tail -3
```

Filenames carry ISO dates plus a session number, so sort order is date order. Read the newest.

If none exists, say so in one line and ask what CSJ wants to work on. Do not reconstruct one from git history.

## 2. Load what it points to

Read every path under **Context to load**. Read `techDebt.md` only if a priority or the handover's **Tech debt** section names an entry in it; otherwise leave it closed.

A missing path means something moved after the handover — note it, keep going.

Do not read beyond the listed paths unless answering a specific question.

## 3. Verify it is still true

```bash
git rev-parse --abbrev-ref HEAD
git log --oneline -5
git status --short
git log --oneline @{u}..HEAD 2>/dev/null
```

Flag drift in the briefing:
- Commits since the handover's HEAD — read the subject lines; open a diff only where one touches a priority. The top priority may already be done.
- Many commits and no handover covering them — brief from the stale handover anyway, say the gap is uncovered, and ask CSJ what happened rather than reconstructing it.
- Branch differs — say so before acting.
- Dirty tree when the handover said clean — show the diff, do not commit or revert it.

Do not re-run the test suite to verify. Report what the handover claimed, note if HEAD moved, offer to re-run.

## 4. Brief CSJ

```
Resuming hermes-desktop from <date>, session <N>.

<One or two sentences: where things stand.>

Priorities:
1. <task>  ← BLOCKED ON CSJ: <what> (if applicable)
2. <task>
3. <task>

<Drift from step 3, one line each. Omit if clean.>

Starting on 1 unless you'd rather go elsewhere.
```

Blocked-on-CSJ items first, with the ask written as a direct question in the task line.

## 5. Begin

Start the top unblocked priority without asking "shall I start?". If item 1 is blocked, ask the question and begin item 2 while waiting.

Treat **Decisions and dead ends** as settled. If you disagree, say so in a sentence and let CSJ decide.

## Common mistakes

- Redoing work listed under **Completed this session**.
- Trusting a green-test claim after HEAD has moved.
- Reading `techDebt.md` in full every session — it is a pointer, not a priority list.
