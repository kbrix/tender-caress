export const meta = {
  name: 'apply-groups',
  description: 'Apply an OpenSpec change task group by task group (test first), with an independent verifier after each group',
  phases: [
    { title: 'Apply', detail: 'an implementer, then an independent verifier, per task group, in sequence' },
  ],
  argsSchema: {
    type: 'object',
    properties: {
      change: { type: 'string' },
      groups: { type: 'array', items: { type: 'string' } },
      scratch: { type: 'string' },
      rules: { type: 'string' },
    },
    required: ['change', 'groups', 'scratch'],
  },
}

export const run = async (ctx) => {
  const args = ctx?.args ?? globalThis.args ?? {}
  const callAgent = ctx?.agent ? (prompt, opts) => ctx.agent(prompt, opts) : (prompt, opts) => globalThis.agent(prompt, opts)
  const setPhase = ctx?.phase ? (p) => ctx.phase(p) : (p) => globalThis.phase?.(p)
  const log = ctx?.log ? (m) => ctx.log(m) : (m) => globalThis.log?.(m)

  const { change, groups, scratch } = args
  const DIR = `openspec/changes/${change}`
  const RULES = `Work in the current repository, on branch ${change} (checked out). Never switch branches, never commit to the default branch, never git stash/clean/reset --hard/rebase/amend, and never write to /tmp or /var/tmp. Follow the repository's AGENTS.md (commit conventions, provenance links, build mutex, safety rails, side-effect checks, live-system rules); where it is stricter than this prompt, it wins. Never read or print secrets. Never delete repository files except those the change's design lists for deletion; if the permission system blocks a deletion, report it instead. Scratch directory: ${scratch}. ${args.rules || ''}`

  const STATUS = {
    type: 'object',
    properties: {
      ok: { type: 'boolean', description: 'true only if every task in the group is done and every literal assertion held' },
      commit: { type: 'string' },
      summary: { type: 'string' },
      problems: { type: 'array', items: { type: 'string' } },
    },
    required: ['ok', 'summary', 'problems'],
  }

  setPhase('Apply')
  const results = []
  for (const g of groups) {
    const impl = await callAgent(`${RULES}\n\nImplement task group ${g} of the OpenSpec change at ${DIR}. Read proposal.md, design.md, the spec deltas and tasks.md first (and .agents/skills/openspec-apply-change/SKILL.md or .claude/skills/openspec-apply-change/SKILL.md if it exists). Do ONLY group ${g}'s tasks, in order, test first as written (red, then green, then the mutation check). Run every literal assertion and positive control the tasks list, exactly as written. Record the measured values in each task's Notes line and tick the box. If an assertion does not hold, do not paper over it: stop, record it in Notes and report it as a problem. If the assertion itself is wrong-shaped, make the smallest correct artifact fix, explain it in Notes, and report it. An independent verifier checks your group right after you. When the group is done and green, commit it (code + tasks.md) with full commit provenance if applicable. Return ok, commit, summary and problems.`, { label: `impl:${g}`, phase: 'Apply', schema: STATUS })
    const ver = await callAgent(`${RULES}\n\nYou are the INDEPENDENT VERIFIER for task group ${g} of the OpenSpec change at ${DIR}. The implementer reported: ${JSON.stringify(impl)}. Do not trust that report. Re-read the group's tasks and the design, inspect the commit (git --no-pager show ${impl?.commit || 'HEAD'}) and the code, and re-run the cheap literal assertions yourself (greps, builds, the targeted test filters; re-run a full-suite step only if its recorded Notes look wrong). Check: each ticked task is really done; the Notes values are measured and plausible; red-first evidence exists where the task requires it; caller regimes are covered if a shared helper was modified; no out-of-scope edits; the commit follows the repository's conventions; no secrets or forbidden identities appear. Fix small defects yourself and commit them; report anything larger. Add a short verifier line to the group's Notes. Return ok, commit, summary and problems.`, { label: `verify:${g}`, phase: 'Apply', schema: STATUS })
    results.push({ group: g, impl, ver })
    log(`group ${g}: implementer ok=${impl?.ok}, verifier ok=${ver?.ok}`)
    if (!impl?.ok || !ver?.ok) {
      log(`stopping after group ${g}`)
      break
    }
  }
  return results
}
