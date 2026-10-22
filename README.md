# Tender caress, then your love profess

**Verified Spec-Driven Development**

A working method for building software with AI agents: every behavior change is a spec change first, and every claim about the work is checked by someone other than the one who made it, with a command whose output proves it. Explore, decide, specify and verify (the tender caress); then merge (the love profess).

| File | What |
|---|---|
| [`METHOD.md`](METHOD.md) | The method itself. Tool-agnostic: principles, roles, process tiers, the lifecycle, verification and spec discipline, safety rails, the autonomy contract. |
| [`claude/CLAUDE.md`](claude/CLAUDE.md) | How the method runs in Claude Code: subagents, workflows, Ultracode, memory. |
| [`claude/workflows/`](claude/workflows) | Five Claude Code Workflow-tool scripts: `propose-review`, `apply-groups`, `adversarial-review`, `probe` (breaker + mutant), `fix-and-review`. |
| [`claude/agents/branch-reviewer.md`](claude/agents/branch-reviewer.md) | A fresh-context branch reviewer for Claude Code that writes `REVIEW_NOTES.md`. |
| [`copilot/COPILOT.md`](copilot/COPILOT.md) | How the method runs in GitHub Copilot CLI: session SQLite DAG (`todos`/`todo_deps`), parallel `task` waves, `/fleet` and `/autopilot`, dynamic workflows, sandbox-safe scratchpad. |
| [`copilot/workflows/`](copilot/workflows) | Five Copilot CLI `defineWorkflow` scripts (`propose-review`, `apply-groups`, `adversarial-review`, `probe`, `fix-and-review`). |
| [`copilot/agents/branch-reviewer.agent.md`](copilot/agents/branch-reviewer.agent.md) | A fresh-context branch reviewer custom agent for GitHub Copilot CLI that writes `REVIEW_NOTES.md`. |
| [`templates/`](templates) | `AGENTS.local.md` (a repository's local specifics), `BRIEF.md`, `FIX-BRIEF.md`, `KICKOFF.md`. |

## Adopting it in a repository

```bash
git submodule add https://github.com/kbrix/tender-caress.git method
cp method/templates/AGENTS.local.md AGENTS.md      # then fill it in
```

### Claude Code

In the repository's `CLAUDE.md`:

```
@AGENTS.md
@method/METHOD.md
@method/claude/CLAUDE.md
```

And make the reviewer agent available:

```bash
mkdir -p .claude/agents
ln -s ../../method/claude/agents/branch-reviewer.md .claude/agents/branch-reviewer.md
```

### GitHub Copilot CLI

In the repository's `AGENTS.md` or `.github/copilot-instructions.md`:

```
@AGENTS.md
@method/METHOD.md
@method/copilot/COPILOT.md
```

And make the reviewer custom agent available:

```bash
mkdir -p .github/agents
ln -s ../../method/copilot/agents/branch-reviewer.agent.md .github/agents/branch-reviewer.agent.md
```

Clone the consuming repository with `git clone --recursive`, or run `git submodule update --init` after a plain clone. Update the method with `git submodule update --remote method`, then commit the new pointer.

**Precedence:** the repository's own `AGENTS.md` wins over `METHOD.md` wherever they disagree. Never edit files inside `method/` from a consuming repository; change this repository instead.

The method assumes [OpenSpec](https://github.com/Fission-AI/OpenSpec) for the spec layer at the Standard and Full tiers.

## License

MIT. See [`LICENSE`](LICENSE).
