---
name: session-end
description: Use when a hermes-desktop session is ending with work outstanding — CSJ says "session end", "/session-end", "wrap up", "let's stop here", "write a handover", or asks to hand over to the next session or inference. Writes handover/<Month>/<DD>/ and updates the root techDebt.md. The repo-local session-start reads what this writes.
---

# Session End — hermes-desktop

Write the briefing the next inference needs to continue from where this one stopped. Repo-local: no Obsidian vault, no CSJTODO.md, no other repos.

**Write the handover body yourself.** Only you have the live conversation. A subagent would guess the reasoning from git history, and guessed reasoning is worse than none.

## 1. Resolve the path

```bash
cd "$(git rev-parse --show-toplevel)"
TODAY=$(date +%Y-%m-%d); MONTH=$(date +%B); DAY=$(date +%d)
TARGET="handover/${MONTH}/${DAY}"; mkdir -p "$TARGET"
N=$(( $(find "$TARGET" -maxdepth 1 -name 'handover-*.md' | wc -l | tr -d ' ') + 1 ))
HANDOVER="${TARGET}/handover-${TODAY}-session-${N}.md"
echo "$HANDOVER"
```

`%d` is zero-padded so `05` sorts before `10`.

## 2. Snapshot the state

```bash
git status --short
git log --oneline -20
git diff --stat HEAD
git log --oneline @{u}..HEAD 2>/dev/null
```

Git says what changed. You know why, what was rejected, and what is half-done.

## 3. Commit outstanding work

If the tree is dirty, ask CSJ whether to commit unless they already said to commit freely. Then:

```bash
git add -A
git reset HEAD -- '.env' '.env.*' '*.pem' '*.key' 2>/dev/null || true
git status --short   # nothing sensitive staged
```

Commit with a real message describing the state. If a hook rejects it, surface the error and stop.

## 4. Update techDebt.md

`techDebt.md` at the repo root is the rolling debt ledger. Edit it in place:

- Add debt you created or noticed this session, each as `- [ ] **<file:line>** — <what> — <why deferred> (added <date>)`.
- Delete entries that were fixed this session. Do not tick them; remove them.
- Do not append a dated block. It is a state document, not a log.

If nothing was added or removed, leave it untouched.

## 5. Run the project gates

```bash
lat check
```

`lat check` must pass before the handover is written — CLAUDE.md requires it after every task. Record the result under **Verification state**; do not re-run the full test suite unless it already ran this session.

## 6. Write the handover

Rank outstanding tasks by what unblocks the most, what is time-sensitive, and what CSJ said matters. Anything blocked on CSJ goes first regardless of size.

Under **Context to load**, list three to six paths that change tomorrow's behaviour — the plan, the spec, the file mid-edit — each with why. Verify each exists. Never list README or the whole repo.

```markdown
---
type: handover
mode: session-end
date: <TODAY>
session: <N>
repo: hermes-desktop
branch: <branch>
---

# Session Handover — <TODAY>, Session <N>

## Where things stand

<Two or three sentences. Done, half-done, verified vs assumed.>

## Priorities for the next session

1. **<task>** — <what and why. If blocked: BLOCKED ON CSJ — <what you need>.>
2. **<task>** — <...>

<Or "Nothing outstanding." plus the natural next move.>

## Context to load

- `path/to/file` — <why it matters>

## Completed this session

- <what landed, with SHAs>

## Verification state

- `lat check`: <pass/fail> at <SHA>
- `npm test` / `npm run typecheck`: <result at SHA, or "not run">
- Not verified: <what, and why>

## Decisions and dead ends

<Approaches rejected and why. Decisions CSJ made, so they are not re-litigated.>

## Things that will bite you

<Non-obvious gotchas. Omit the section if none.>

## Tech debt

See `techDebt.md` at the repo root. <One line: what changed there this session, or "unchanged". Name any entry the next session should act on first.>

## Branch and deploy state

- Branch: <branch>
- Unpushed commits: <N or none>
- Release: <latest tag, and whether HEAD is released>
```

Write it to `$HANDOVER`.

## 7. Commit the handover

```bash
git add "handover/${MONTH}/${DAY}/" techDebt.md
git commit -m "docs(session): handover ${TODAY} session ${N}"
git push 2>&1 || echo "Push failed — local copy is authoritative"
```

An uncommitted handover leaves the tree dirty, which is the trap step 3 avoided.

## 8. Close out

```
Handover at <path>.
Next session starts with: <priority 1>.
Say "start session" to pick it up.
```

No long recap. CSJ lived the session; the handover is for the next model.

## Judgement calls

- Honesty beats tidiness: failing tests and half-done work go in the handover as such.
- Never write secret values. Reference where a credential lives.
- Empty sections are fine. Padding trains the next session to skim.
