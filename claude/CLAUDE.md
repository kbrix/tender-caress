# The method in Claude Code

How `METHOD.md` runs in Claude Code. Read `METHOD.md` first; this file only maps its roles and steps onto Claude Code features. The repository's `AGENTS.md` (local specifics) wins where it is stricter.

## Roles → Claude Code

| Role | In Claude Code |
|---|---|
| Lead | The main session. It writes briefs into the scratchpad, launches workflows and subagents, checks their reports against the files, and keeps the record. |
| Explorer, Critic, Drafter | Subagents (the Agent tool, or `agent()` inside a workflow). |
| Implementer + Verifier | `workflows/apply-groups.js`: one implementer agent, then one independent verifier agent, per task group, in sequence. |
| Reviewer (fresh context) | The `branch-reviewer` subagent (`agents/branch-reviewer.md`). It writes `REVIEW_NOTES.md` and edits nothing else. |
| Adversarial reviewers + Refuters | `workflows/adversarial-review.js`: one agent per lens, then one refuter per finding. |
| Breaker + Mutant | `workflows/probe.js`: a breaker and a mutant, each in its own git worktree (`isolation: 'worktree'`), then one refuter per finding. Full tier; run it alongside the reviews. |
| Fixer | `workflows/fix-and-review.js`: a fix pass, an adversarial review of the fix diff, a second pass if needed, then the re-verification task. |
| Drafter + draft review | `workflows/propose-review.js`: a draft, three lenses with refuters, a fix, a fix-diff review, and a second fix if needed. |
| Operator | You. Questions go through the AskUserQuestion tool, with the recommended option first. |

## The workflows

The five scripts in `workflows/` are plain Workflow-tool scripts. Run one by path:

```
Workflow({ scriptPath: "method/claude/workflows/propose-review.js",
           args: { change: "<change-name>", brief: "<scratchpad>/BRIEF.md", scratch: "<scratchpad>" } })
```

| Script | Args |
|---|---|
| `propose-review.js` | `change`, `brief`, `scratch`, optional `rules` |
| `apply-groups.js` | `change`, `groups` (e.g. `["1","2","3"]`), `scratch`, optional `rules` |
| `adversarial-review.js` | `change`, optional `base` (default `master`), optional `lenses` (`[{key, prompt}]`; there are three defaults), optional `known` (a file with findings already reported, e.g. `REVIEW_NOTES.md`) |
| `probe.js` | `change`, optional `base` (default `master`), optional `maxMutants` (default 15), optional `rules` |
| `fix-and-review.js` | `change`, `brief` (the fix brief), `base` (the pre-fix commit), `reverify` (the task id that re-verifies), `scratch`, optional `rules` |

- **`rules`** is a string appended to every agent's prompt. Use it for change-specific constraints ("the lead runs task 10; do not connect to the live gateway"). Repository-wide rules belong in `AGENTS.md`, which every subagent receives anyway.
- If the Workflow tool refuses a `scriptPath` outside the session directory, copy the script into the scratchpad and run it from there.
- The scripts are plain JavaScript. Watch quoting: an apostrophe inside a single-quoted string breaks the parse. `Date.now()` and `Math.random()` are unavailable.
- `probe.js` works in git worktrees, which start from the branch's last commit: commit before probing. Worktree agents build their own copy, so they do not clash with a test run in the main tree.
- A workflow returns only what its agents reported. Read the result and check the claims that matter against the files before acting on them. If an agent's result is empty, read the journal before assuming anything.

**Ultracode.** With Ultracode on, workflows are the default for every substantive step, and the operator has opted in to the token cost. With it off, describe the workflow you would run and its rough cost, and let the operator choose. A Full-tier change through these workflows typically spends a few million subagent tokens and several hours of wall-clock time; say so up front.

## Subagents

- Subagents receive the repository's `CLAUDE.md`/`AGENTS.md`, so do not paste repository rules into prompts. Name the specific rule a step needs.
- Pass long instructions as a **brief file** in the scratchpad (templates in `../templates/`), not inline.
- Use JSON schemas for structured results (findings, verdicts, status), so that results are data, not prose.
- Subagents in workflows cannot spawn further subagents. Independence comes from the workflow's separate implementer and verifier agents.
- If the repository uses OpenSpec's Claude skills (`.claude/skills/openspec-*`), tell drafting and applying agents to read the `SKILL.md` files directly. The skill text wins over a paraphrase in the prompt.
- The permission classifier may block a subagent's `git rm` or `rm -rf`. Then the lead does that step itself, after checking the paths. If an action of the lead's is blocked, stop and ask the operator. Never route around a block.

## Memory and scratchpad

- **Memory** (the persistent memory directory): one fact per file, with an index. Save durable gotchas, operator decisions and their dates, and the progress table of a multi-change plan. Do not save what the repository already records (code, git history, specs). Re-verify a remembered file, flag or function before relying on it.
- **Scratchpad**: briefs, fix briefs, helper scripts, captures, test logs, copies of workflow scripts, review-note copies. Nothing in the scratchpad is committed.
- Keep a review's `REVIEW_NOTES.md` out of commits. Copy it into the scratchpad for the record.

## Long-running work

- Workflows and background agents notify the session when they finish. Do not poll them.
- For a time-gated step (for example "after the market closes"), start a background shell loop that waits for the time and exits. Its completion wakes the session.
- Between changes, compact the session (or start a new one) with a kickoff prompt (`../templates/KICKOFF.md`) that restates the state, scope, process and rules. The repository and memory are the source of truth; the kickoff prompt says where to look.
- At an agreed checkpoint (typically a merge), send the operator a push notification.

## Wiring this into a repository

The consumer's `CLAUDE.md`:

```
@AGENTS.md
@method/METHOD.md
@method/claude/CLAUDE.md
```

Make the reviewer agent available, with a symlink committed in the consumer:

```
mkdir -p .claude/agents
ln -s ../../method/claude/agents/branch-reviewer.md .claude/agents/branch-reviewer.md
```

Run the workflows by `scriptPath` (above). Workflows discovered by name from `.claude/workflows/` through a symlink are untested; run them by path until that is confirmed.
