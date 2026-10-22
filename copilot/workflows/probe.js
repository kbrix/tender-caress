export const meta = {
  name: 'probe',
  description: 'Try to break an implemented branch: a breaker exercises the product against its specs, a mutant mutates the changed code; every finding goes to a refuter',
  phases: [
    { title: 'Probe', detail: 'a breaker and a mutant in isolated worktrees (or serialized under a single-tree build mutex)' },
    { title: 'Refute', detail: 'one refuter per finding' },
  ],
  argsSchema: {
    type: 'object',
    properties: {
      change: { type: 'string' },
      base: { type: 'string' },
      maxMutants: { type: 'integer' },
      worktreeRoot: { type: 'string' },
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
  const maxMutants = args.maxMutants || 15
  const worktreeRoot = args.worktreeRoot || './build/worktrees'
  const DIR = `openspec/changes/${change}`
  const RULES = `You work in your own isolated git worktree under ${worktreeRoot} (never /tmp or /var/tmp, and never touch the main working tree, commit, or push). Follow the repository's AGENTS.md: its build and test commands, its build-mutex rules, its hermetic-test rules, and its rules for live systems, paid APIs and secrets. Unless AGENTS.md explicitly allows it, never reach a live system or a paid API, and never read or print secrets. ${args.rules || ''}`

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
            problem: { type: 'string' },
            reproduce: { type: 'string', description: 'exact commands (and the mutation as a diff, for a surviving mutant) that show the problem' },
            observed: { type: 'string' },
            expected: { type: 'string', description: 'what the spec or docs promise, quoted with file:line' },
            fix: { type: 'string' },
          },
          required: ['id', 'severity', 'file', 'problem', 'reproduce', 'observed', 'expected', 'fix'],
        },
      },
      mutants: {
        type: 'object',
        properties: { tried: { type: 'integer' }, killed: { type: 'integer' }, survived: { type: 'integer' } },
      },
    },
    required: ['findings'],
  }
  const VERDICT = {
    type: 'object',
    properties: { real: { type: 'boolean' }, severity: { type: 'string' }, reason: { type: 'string' } },
    required: ['real', 'severity', 'reason'],
  }

  const ROLES = [
    { key: 'breaker', prompt: `You are the BREAKER. Read the promises first, NOT the implementation: ${DIR} (proposal, design, spec deltas), the living specs they touch under openspec/specs/, and the user-facing docs and help text. Build the product. Then use it the way a hostile or confused user would: invalid, empty, huge, duplicate and boundary inputs; options in odd positions and combinations; operations in the wrong order or repeated; missing configuration; unreachable dependencies (use dead local endpoints, never live ones); and the regime where the change actually matters. Each time the observed behavior contradicts a promise (output, exit code, error shape, side effect), record it with exact commands to reproduce it. Only after you have tried at least 15 distinct probes may you read the implementation, to explain a break. Report breaks only, not style.` },
    { key: 'mutant', prompt: `You are the MUTANT. List the production files changed on this branch: git --no-pager diff --name-only ${base}..HEAD, excluding tests, docs, specs and generated files. Do NOT read the tests first. If AGENTS.md names a mutation-testing tool, run it on those files and report its surviving mutants. Otherwise create up to ${maxMutants} mutants by hand, spread across the changed lines: flip a condition or comparison, delete a call or statement, shift a boundary by one, swap a constant, return early, drop an error branch. For each mutant: apply it, build, run the relevant tests (the targeted filter AGENTS.md describes, or the full non-live suite if no narrower one fits), record killed or survived, then revert it and confirm git --no-pager diff --quiet. Report every SURVIVING mutant as a finding: the mutation as a diff, the tests you ran, and the behavior that is now unguarded. Also fill in the mutants counts (tried, killed, survived).` },
  ]

  setPhase('Probe')
  const out = await runParallel(
    ROLES.map(r => async () => {
      const res = await callAgent(`${RULES}\n\n${r.prompt}`, { label: r.key, phase: 'Probe', schema: FINDINGS, isolation: 'worktree' })
      if (res?.mutants) log(`mutants: tried ${res.mutants.tried}, killed ${res.mutants.killed}, survived ${res.mutants.survived}`)
      setPhase('Refute')
      return runParallel(
        (res?.findings || []).map(f => async () => {
          const v = await callAgent(`${RULES}\n\nTry to REFUTE this ${r.key} finding. Reproduce it yourself in your worktree first. For a surviving mutant, decide whether it is equivalent (no observable behavior change) or the unguarded behavior is immaterial; for a break, whether the promise it cites really says what the finding claims. Return real=false only if you can show that it is wrong or immaterial.\n${JSON.stringify(f)}`, { label: `refute:${r.key}/${f.id}`, phase: 'Refute', schema: VERDICT, isolation: 'worktree' })
          return { ...f, role: r.key, verdict: v }
        }),
      )
    }),
  )
  const all = out.flat().filter(Boolean)
  log(`${all.filter(f => f.verdict?.real).length} confirmed, ${all.filter(f => !f.verdict?.real).length} refuted`)
  return {
    confirmed: all.filter(f => f.verdict?.real),
    refuted: all.filter(f => !f.verdict?.real).map(f => ({ id: `${f.role}/${f.id}`, problem: f.problem, reason: f.verdict.reason })),
  }
}
