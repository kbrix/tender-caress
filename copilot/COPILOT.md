# The method in GitHub Copilot CLI

How `METHOD.md` runs in GitHub Copilot CLI. Read `METHOD.md` first; this file maps its roles and steps onto Copilot CLI tools, the session SQLite DAG, custom agents, and dynamic workflows. The repository's `AGENTS.md` (local specifics) wins where it is stricter.

## Roles → Copilot CLI

| Role | In Copilot CLI |
|---|---|
| Lead | The main session. Manages the session SQLite DAG (`sql` tool: `todos` and `todo_deps`), writes briefs and reports into `<session_folder>/files/tender-caress/`, dispatches subagents via `task` (or `run_dynamic_workflow`), verifies claims against files on disk, and gates with `ask_user`. |
| Explorer | `task(agent_type="explore" \| "general-purpose", mode="background")` — read-only on repository files; writes structured findings with `file:line` evidence to `<session_folder>/files/tender-caress/explore-<area>.md`. |
| Critic | Consolidates Explorer reports into `<session_folder>/files/tender-caress/critic-report.md` with numbered Open Questions (`OQ1`, `OQ2`…) and recommendations, then presents decisions to the Operator via `ask_user` (with `default` set to the recommended option). |
| Drafter | `task(agent_type="general-purpose")` writing OpenSpec artifacts from `<session_folder>/files/tender-caress/BRIEF.md` (or `copilot/workflows/propose-review.js`). |
| Implementer + Verifier | Partitioned by strictly disjoint file ownership (`impl-<group>` → `verify-<group>` linked in `todo_deps`), or orchestrated via `copilot/workflows/apply-groups.js`. Never the same agent instance. |
| Reviewer (fresh context) | Custom agent `.github/agents/branch-reviewer.agent.md` (symlinked from `method/copilot/agents/branch-reviewer.agent.md`) or `task(agent_type="code-review")`. Writes `REVIEW_NOTES.md` and edits nothing else. |
| Adversarial reviewers + Refuters | Parallel lens subagents (`lens-1`, `lens-2`, `lens-3`) writing to `<session_folder>/files/tender-caress/adv-lens*.md`, followed by one Refuter subagent per finding verifying the claim against `file:line` before any Fixer acts (`copilot/workflows/adversarial-review.js`). |
| Breaker + Mutant | Isolated worktree agents (under `<repo>/build/worktrees/`, never `/tmp`) or sequential mutation/revert checks verified by an independent Verifier (`copilot/workflows/probe.js`). |
| Fixer | `task(agent_type="general-purpose")` applying `<session_folder>/files/tender-caress/FIX-BRIEF.md`, followed by adversarial review of the fix diff and independent re-verification (`copilot/workflows/fix-and-review.js`). |
| Operator | You. Answers structured `ask_user` prompts, or delegates autonomous execution via `/fleet` and `/autopilot`. |

## Orchestration via the session SQLite DAG (`sql` tool)

Every Copilot CLI session provides a built-in SQLite database with `todos` and `todo_deps`. Before launching subagents, the Lead encodes the `METHOD.md` lifecycle as an explicit dependency graph so `/fleet` and parallel `task` waves only dispatch nodes whose prerequisites are `done`:

```sql
INSERT INTO todos (id, title, description, status) VALUES
  ('explore-c1', 'Exploring cluster C1', 'Read-only Explorer for C1; write findings to <session_folder>/files/tender-caress/explore-c1.md', 'pending'),
  ('explore-c2', 'Exploring cluster C2', 'Read-only Explorer for C2; write findings to <session_folder>/files/tender-caress/explore-c2.md', 'pending'),
  ('critic', 'Consolidating Explorer reports', 'Synthesize explore-*.md into critic-report.md with OQ1..OQn and recommendations', 'pending'),
  ('impl-g1', 'Implementing group G1', 'Test-first implementation of G1; record measured values', 'pending'),
  ('verify-g1', 'Verifying group G1', 'Independent Verifier for G1; re-run assertions and inspect diff', 'pending'),
  ('adv-lens-code', 'Adversarial review: code correctness', 'Lens 1 review of branch diff; write to adv-lens-code.md', 'pending'),
  ('adv-lens-compat', 'Adversarial review: caller regimes', 'Lens 2 review of shared-helper caller regimes; write to adv-lens-compat.md', 'pending'),
  ('adv-lens-quality', 'Adversarial review: quality and specs', 'Lens 3 review of spec truth and conventions; write to adv-lens-quality.md', 'pending'),
  ('refute-and-fix', 'Refuting findings, fixing, and re-verifying', 'Challenge every finding against file:line, apply confirmed fixes, re-verify', 'pending'),
  ('branch-reviewer', 'Reviewing branch with fresh context', 'Run branch-reviewer custom agent over the branch diff', 'pending');

INSERT INTO todo_deps (todo_id, depends_on) VALUES
  ('critic', 'explore-c1'),
  ('critic', 'explore-c2'),
  ('impl-g1', 'critic'),
  ('verify-g1', 'impl-g1'),
  ('adv-lens-code', 'verify-g1'),
  ('adv-lens-compat', 'verify-g1'),
  ('adv-lens-quality', 'verify-g1'),
  ('refute-and-fix', 'adv-lens-code'),
  ('refute-and-fix', 'adv-lens-compat'),
  ('refute-and-fix', 'adv-lens-quality'),
  ('branch-reviewer', 'refute-and-fix');

-- Query ready tasks (no unfinished dependencies):
SELECT t.id, t.title FROM todos t
WHERE t.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM todo_deps td
    JOIN todos dep ON td.depends_on = dep.id
    WHERE td.todo_id = t.id AND dep.status != 'done'
  );
```

When multiple `impl-*` groups edit strictly disjoint files in a single working tree whose build tool holds a checkout-wide lock (for example, Gradle with codegen), run the file edits in parallel with `DO NOT COMMIT; DO NOT RUN BUILD` in each Implementer's brief, then serialize the build and test verification under a single Verifier (`Build mutex`, `METHOD.md` step 8).

## Dynamic workflows (`dynamic_workflows_manage` & `run_dynamic_workflow`)

The five scripts in `copilot/workflows/` mirror `claude/workflows/` in Copilot CLI's `defineWorkflow` format (`meta` + self-contained `async (ctx) => { ... }` using `ctx.agent`, `ctx.parallel`, `ctx.step`, `ctx.phase`, and `ctx.log`):

| Script | Args |
|---|---|
| `propose-review.js` | `change`, `brief`, `scratch`, optional `rules` |
| `apply-groups.js` | `change`, `groups` (`["1","2",...]`), `scratch`, optional `rules` |
| `adversarial-review.js` | `change`, optional `base` (default `master`), optional `lenses`, optional `known`, optional `rules` |
| `probe.js` | `change`, optional `base` (default `master`), optional `maxMutants` (default 15), optional `worktreeRoot` (default `./build/worktrees`), optional `rules` |
| `fix-and-review.js` | `change`, `brief`, `base`, `reverify`, `scratch`, optional `rules` |

- **When dynamic workflow extensions are enabled:** register a script with `dynamic_workflows_manage({ operation: "author", meta, run })` (define all schemas, constants and helpers inside `run`) and launch it with `run_dynamic_workflow({ name: meta.name, args })`.
- **When workflow extensions are not enabled in the session:** the Lead executes the exact same phases directly using `sql` (`todos` / `todo_deps`) and parallel `task(...)` calls, reading the prompts and JSON schemas from `copilot/workflows/*.js`.

## Subagents

- Subagents automatically receive the repository's `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`. Do not paste repository-wide rules into prompts; name only the step-specific rules and file ownership boundaries.
- Pass long instructions as a brief file in `<session_folder>/files/tender-caress/` (`BRIEF.md`, `FIX-BRIEF.md`), not inline.
- When launching multiple background agents (`task(..., mode="background")`), launch the entire wave in a single response. Copilot CLI notifies the session as background agents complete; use `read_agent(agent_id, wait=true)` only when you are ready to join on their output, and never call `list_agents` merely to rediscover a known `agent_id`.
- If the repository has OpenSpec skills (`.agents/skills/openspec-*` or `.claude/skills/openspec-*`), tell drafting and applying agents to invoke or read the matching `SKILL.md` first.

## Scratchpad, memory, and sandbox rules

- **Session scratchpad (`<session_folder>/files/tender-caress/`)**: store briefs (`BRIEF.md`, `FIX-BRIEF.md`), Explorer reports (`explore-<area>.md`), the Critic synthesis (`critic-report.md`), Verifier outputs, and Adversarial Review matrices here. Files in `<session_folder>/files/` persist across `/compact` checkpoints and never pollute `git status`.
- **Never write to `/tmp` or `/var/tmp`**: Copilot CLI's macOS/Linux sandbox blocks file writes and shell redirects outside the repository and session directory. Put temporary build outputs, logs, or detached git worktrees under `<repo>/build/` (gitignored) or `<session_folder>/files/`, never `/tmp` or `mktemp`.
- **Keep `REVIEW_NOTES.md` out of commits**: copy it into `<session_folder>/files/tender-caress/REVIEW_NOTES.md` before cleaning up the working tree.
- **Cross-session memory**: use `session_store_sql` to query prior sessions, decisions, and PR references, and store durable repository facts according to `METHOD.md` section 8.

## Long-running work and CI watching

- Start long-running checks (such as `gh run watch <run-id> --compact --interval 30`) with `bash(..., mode="async")` and **end your turn immediately**.
- Copilot CLI wakes the session automatically with a `<system_notification>` when the background command exits. Never poll `read_bash` or `gh run view` in a sleep loop while idle.
- Between changes, use `/compact` (or start a fresh session) with a kickoff prompt (`../templates/KICKOFF.md`) pointing to `<session_folder>/files/tender-caress/` and the repository state.

## Wiring this into a repository

In the consumer's `AGENTS.md` or `.github/copilot-instructions.md`:

```markdown
@AGENTS.md
@method/METHOD.md
@method/copilot/COPILOT.md
```

Make the fresh-context branch reviewer available as a Copilot custom agent:

```bash
mkdir -p .github/agents
ln -s ../../method/copilot/agents/branch-reviewer.agent.md .github/agents/branch-reviewer.agent.md
```
