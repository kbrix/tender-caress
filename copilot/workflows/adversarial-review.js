export const meta = {
  name: 'adversarial-review',
  description: 'Adversarial multi-lens review of an implemented branch; every finding goes to a refuter',
  phases: [
    { title: 'Review', detail: 'one reviewer per lens over the branch diff' },
    { title: 'Refute', detail: 'one refuter per finding' },
  ],
  argsSchema: {
    type: 'object',
    properties: {
      change: { type: 'string' },
      base: { type: 'string' },
      lenses: {
        type: 'array',
        items: {
          type: 'object',
          properties: { key: { type: 'string' }, prompt: { type: 'string' } },
          required: ['key', 'prompt'],
        },
      },
      known: { type: 'string' },
      rules: { type: 'string' },
    },
    required: ['change'],
  },
}

export const run = async (ctx) => {
  const args = ctx?.args ?? globalThis.args ?? {}
  const callAgent = ctx?.agent ? (prompt, opts) => ctx.agent(prompt, opts) : (prompt, opts) => globalThis.agent(prompt, opts)
  const runParallel = ctx?.parallel ? (tasks) => ctx.parallel(tasks) : (tasks) => Promise.all(tasks.map(t => t()))
  const setPhase = ctx?.phase ? (p) => ctx.phase(p) : (p) => globalThis.phase?.(p)
  const log = ctx?.log ? (m) => ctx.log(m) : (m) => globalThis.log?.(m)

  const { change } = args
  const base = args.base || 'master'
  const DIR = `openspec/changes/${change}`
  const KNOWN = args.known ? ` Findings already reported are in ${args.known}: read it, do not re-report them, and hunt for what they missed.` : ''
  const RULES = `Work in the current repository, on branch ${change} (checked out). READ-ONLY: no edits, no commits, no git checkout/stash/reset, no writes to /tmp or /var/tmp. Follow the repository's AGENTS.md. Never read or print secrets. Do not run the full test suite or anything against live systems (another reviewer runs tests concurrently). Read-only greps, git --no-pager log/show/diff ${base}..HEAD, and reading the change at ${DIR} are fine. ${args.rules || ''}`

  const DEFAULT_LENSES = [
    { key: 'code', prompt: `CODE CORRECTNESS AND CALLER REGIMES. Does anything the change was supposed to KEEP now behave differently? If a shared helper, base class or message router was modified, check every caller regime across the codebase (null/optional arguments, legacy entry points, migrated or untriggered states, ordering and concurrency assumptions). Is any orphan left behind (members, options, imports, DI registrations, config keys, schema files, test helpers that only the changed code used)? Did a removed or rewritten test cover behavior that is kept? Do the new tests assert what the design says, and would they fail on a regression? Do the edited lines follow the engineering rules in AGENTS.md?` },
    { key: 'spec-truth', prompt: `SPEC CLAIM TRUTH. For every delta under ${DIR}/specs, check every concrete claim (command, flag, config key, default, interface, exit code, test name, behavior) against the code on this branch. Compare each MODIFIED block with the live block in openspec/specs/: was any still-true sentence or scenario dropped or altered beyond the change, without the design saying so? Are REMOVED reasons and migrations accurate? Does new text contradict a requirement elsewhere that this change leaves untouched?` },
    { key: 'completeness', prompt: `COMPLETENESS, DOCS AND EVIDENCE. Sweep the tree (excluding archives, vendored code and build output) for remaining mentions of what the change cut or renamed; every hit must be handled or listed as kept, with a reason, in the design. Are the docs edited by the change accurate against the code? Are all hand-off items the change owns addressed? Are commit messages atomic and linked to culprit/backport provenance where applicable? Re-run the cheap evidence checks recorded in tasks.md Notes on the stored files, and report any value that does not reproduce.` },
  ]
  const lenses = args.lenses || DEFAULT_LENSES

  const FINDINGS = {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            severity: { type: 'string', enum: ['critical', 'warning', 'suggestion'] },
            file: { type: 'string' },
            line: { type: 'integer' },
            problem: { type: 'string' },
            scenario: { type: 'string', description: 'concrete inputs or state -> wrong outcome' },
            evidence: { type: 'string' },
            fix: { type: 'string' },
          },
          required: ['id', 'severity', 'file', 'problem', 'scenario', 'evidence', 'fix'],
        },
      },
    },
    required: ['findings'],
  }
  const VERDICT = {
    type: 'object',
    properties: { real: { type: 'boolean' }, severity: { type: 'string' }, reason: { type: 'string' } },
    required: ['real', 'severity', 'reason'],
  }

  setPhase('Review')
  const out = await runParallel(
    lenses.map(l => async () => {
      const r = await callAgent(`${RULES}\n\nAdversarially review the implemented branch (git --no-pager diff ${base}..HEAD) through this lens: ${l.prompt}${KNOWN}\nReport only real defects, each with a concrete failure scenario and verbatim evidence (file:line). Return an empty list if there are none.`, { label: `review:${l.key}`, phase: 'Review', schema: FINDINGS })
      setPhase('Refute')
      return runParallel(
        (r?.findings || []).map(f => async () => {
          const v = await callAgent(`${RULES}\n\nTry to REFUTE this finding against the code yourself. Return real=false only if you can show that it is wrong or immaterial.\n${JSON.stringify(f)}`, { label: `refute:${l.key}/${f.id}`, phase: 'Refute', schema: VERDICT })
          return { ...f, lens: l.key, verdict: v }
        }),
      )
    }),
  )
  const all = out.flat().filter(Boolean)
  log(`${all.filter(f => f.verdict?.real).length} confirmed, ${all.filter(f => !f.verdict?.real).length} refuted`)
  return {
    confirmed: all.filter(f => f.verdict?.real),
    refuted: all.filter(f => !f.verdict?.real).map(f => ({ id: `${f.lens}/${f.id}`, problem: f.problem, reason: f.verdict.reason })),
  }
}
