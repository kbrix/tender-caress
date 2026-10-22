export const meta = {
  name: 'propose-review',
  description: 'Draft an OpenSpec change from a brief, review it adversarially through three lenses, fix, and review the fix diff',
  phases: [
    { title: 'Draft', detail: 'one drafting agent writes the change artifacts' },
    { title: 'Review', detail: 'one adversarial reviewer per lens, each finding sent to a refuter' },
    { title: 'Fix', detail: 'one fixer applies the confirmed findings' },
    { title: 'Fix review', detail: 'review the fix diff; a second fix pass if needed' },
  ],
  argsSchema: {
    type: 'object',
    properties: {
      change: { type: 'string' },
      brief: { type: 'string' },
      scratch: { type: 'string' },
      rules: { type: 'string' },
    },
    required: ['change', 'brief', 'scratch'],
  },
}

export const run = async (ctx) => {
  const args = ctx?.args ?? globalThis.args ?? {}
  const callAgent = ctx?.agent ? (prompt, opts) => ctx.agent(prompt, opts) : (prompt, opts) => globalThis.agent(prompt, opts)
  const runParallel = ctx?.parallel ? (tasks) => ctx.parallel(tasks) : (tasks) => Promise.all(tasks.map(t => t()))
  const setPhase = ctx?.phase ? (p) => ctx.phase(p) : (p) => globalThis.phase?.(p)
  const log = ctx?.log ? (m) => ctx.log(m) : (m) => globalThis.log?.(m)

  const { change, brief, scratch } = args
  const DIR = `openspec/changes/${change}`
  const RULES = `Work in the current repository, on branch ${change} (already checked out). Follow the repository's AGENTS.md; where it is stricter than this prompt, it wins. Never commit, never git add/rm/stash/clean/checkout, never delete files outside ${DIR}, never write to /tmp or /var/tmp, never write to databases or live systems (read-only queries are fine), never read or print secrets. Running \`openspec validate ${change} --strict\`, \`openspec show\`, \`openspec instructions\`, builds and read-only greps is fine. Scratch directory: ${scratch}. ${args.rules || ''}`

  const FINDINGS = {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] },
            file: { type: 'string' },
            problem: { type: 'string' },
            evidence: { type: 'string', description: 'verbatim quotes with file:line, from the change AND from the source or spec' },
            fix: { type: 'string' },
          },
          required: ['id', 'severity', 'file', 'problem', 'evidence', 'fix'],
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

  setPhase('Draft')
  const draft = await callAgent(`${RULES}\n\nRead the drafting brief at ${brief} and follow it exactly: write the OpenSpec change at ${DIR}. If .agents/skills/openspec-propose/SKILL.md or .claude/skills/openspec-propose/SKILL.md exists, read it first; its artifact rules win over the brief's paraphrase. Verify every quoted spec header verbatim against openspec/specs/*/spec.md and every code claim against the source, with file:line. Run \`openspec validate ${change} --strict\` until it passes. Return a summary of at most 30 lines: the artifacts written, the decisions (D1…), the open questions (OQ…, marked "proposed — operator to confirm" only where the brief leaves them genuinely open), and the validate result.`, { label: 'draft', phase: 'Draft' })

  const LENSES = [
    { key: 'spec-truth', prompt: `Lens: SPEC AND CODE TRUTH. For every ADDED, MODIFIED, REMOVED and RENAMED requirement in ${DIR}/specs: is each referenced header verbatim in openspec/specs/<capability>/spec.md (grep it)? Does each MODIFIED block carry the WHOLE current requirement plus the intended edit, with no accidental deletions (diff it against the live block)? Is every factual claim in the proposal, design and tasks (file:line, counts, behavior) true on disk? Do other requirements in openspec/specs state the changed behavior and get left contradicting?` },
    { key: 'verification', prompt: `Lens: VERIFICATION QUALITY (METHOD.md section 5). For every task in ${DIR}/tasks.md: does it carry a literal runnable assertion (<run> | <extract> | <assert>) of the promised outcome, not a surface symptom? Does every absence check have a same-shape positive control? Would the assertion actually fail if the change were wrong (name a concrete mutation)? If the change touches a shared helper, base class or router, does the verification cover its caller regime matrix? Are the commands well-formed and sandbox-safe (never writing to /tmp)? Is the TDD order real (red first)? Are side-effect checks present after test runs?` },
    { key: 'scope-design', prompt: `Lens: SCOPE, DESIGN AND SAFETY. Read the brief ${brief} and the design. Is every operator decision in the brief implemented as decided (not re-argued, not dropped)? Is anything presented as decided that the brief left open, or the reverse? Is anything speculative or larger than needed (KISS, YAGNI)? Does the change stray into requirements that the brief says another change owns? Could any step, as written, touch real data, live systems, paid APIs or secrets in a way the repository's AGENTS.md forbids? Is the design's chosen mechanism actually correct? Check it against the source.` },
  ]

  setPhase('Review')
  const reviewed = await runParallel(
    LENSES.map(l => async () => {
      const r = await callAgent(`${RULES}\n\nYou are an adversarial reviewer of the OpenSpec change at ${DIR} (drafted from the brief ${brief}). ${l.prompt}\nReport only real defects, with verbatim evidence; no style preferences. If nothing is wrong, return an empty list.`, { label: `review:${l.key}`, phase: 'Review', schema: FINDINGS })
      const nonNits = (r?.findings || []).filter(f => f.severity !== 'nit')
      const nits = (r?.findings || []).filter(f => f.severity === 'nit').map(f => ({ ...f, lens: l.key, verdict: { real: true, severity: 'nit', reason: 'nit, not refuted' } }))
      const verdicts = await runParallel(
        nonNits.map(f => async () => {
          const v = await callAgent(`${RULES}\n\nTry to REFUTE this review finding on the OpenSpec change at ${DIR}. Check the cited evidence against the files yourself. Return real=false only if you can show that the finding is wrong or immaterial.\n\nFinding ${l.key}/${f.id} [${f.severity}] in ${f.file}:\nPROBLEM: ${f.problem}\nEVIDENCE: ${f.evidence}\nFIX: ${f.fix}`, { label: `refute:${l.key}/${f.id}`, phase: 'Review', schema: VERDICT })
          return { ...f, lens: l.key, verdict: v }
        }),
      )
      return [...verdicts.filter(Boolean), ...nits]
    }),
  )

  const confirmed = reviewed.flat().filter(Boolean).filter(f => f.verdict?.real)
  const refuted = reviewed.flat().filter(Boolean).filter(f => !f.verdict?.real)
  log(`${confirmed.length} confirmed, ${refuted.length} refuted`)

  const render = fs => fs.map(f => `[${f.lens}/${f.id}] ${f.verdict.severity || f.severity} ${f.file}\nPROBLEM: ${f.problem}\nEVIDENCE: ${f.evidence}\nFIX: ${f.fix}\nREFUTER: ${f.verdict.reason}`).join('\n\n')

  let fix1 = null, fixReview = null, fix2 = null
  if (confirmed.length) {
    setPhase('Fix')
    fix1 = await callAgent(`${RULES}\n\nApply these CONFIRMED review findings to the OpenSpec change at ${DIR} (brief: ${brief}). Before editing, copy the change directory to ${scratch}/prefix (rm -rf ${scratch}/prefix; cp -r ${DIR} ${scratch}/prefix) so the fix diff can be reviewed. Verify each finding against the source before applying it; if one is wrong, skip it and say why. Fixing is more defect-prone than drafting: re-read each edited block afterwards, keep MODIFIED blocks whole and headers verbatim. Run \`openspec validate ${change} --strict\`. Then write the fix diff to ${scratch}/fix1.diff (diff -ru ${scratch}/prefix ${DIR}). Return a summary of at most 25 lines: applied or skipped (with the reason) per finding id.\n\n${render(confirmed)}`, { label: 'fix', phase: 'Fix' })

    setPhase('Fix review')
    fixReview = await callAgent(`${RULES}\n\nReview the FIX DIFF ${scratch}/fix1.diff applied to the OpenSpec change at ${DIR}. The findings it was meant to address:\n\n${render(confirmed)}\n\nFor each finding: is it actually fixed? Then hunt for NEW defects that the fix introduced: broken MODIFIED blocks, headers no longer verbatim, assertions that no longer fail on a mutation, contradictions between proposal, design, tasks and specs, numbering gaps. Verify against the source. Report only real defects.`, { label: 'fix-review', phase: 'Fix review', schema: FINDINGS })
    const remaining = (fixReview?.findings || []).filter(f => f.severity !== 'nit')
    if (remaining.length) {
      fix2 = await callAgent(`${RULES}\n\nApply these fix-review findings to ${DIR}. Copy the directory first (rm -rf ${scratch}/prefix2; cp -r ${DIR} ${scratch}/prefix2), verify each finding against the source, re-read the edited blocks, run \`openspec validate ${change} --strict\`, then write ${scratch}/fix2.diff (diff -ru ${scratch}/prefix2 ${DIR}). Return applied or skipped per id.\n\n${remaining.map(f => `[${f.id}] ${f.severity} ${f.file}\nPROBLEM: ${f.problem}\nEVIDENCE: ${f.evidence}\nFIX: ${f.fix}`).join('\n\n')}`, { label: 'fix2', phase: 'Fix review' })
    }
  }

  return {
    draft,
    confirmed: confirmed.map(f => ({ id: `${f.lens}/${f.id}`, severity: f.verdict.severity || f.severity, problem: f.problem })),
    refuted: refuted.map(f => ({ id: `${f.lens}/${f.id}`, reason: f.verdict.reason })),
    fix1,
    fixReview: fixReview?.findings || [],
    fix2,
  }
}
