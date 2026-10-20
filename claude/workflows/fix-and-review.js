export const meta = {
  name: 'fix-and-review',
  description: 'Apply a branch fix brief, review the fix diff adversarially, run a second fix pass if needed, then re-verify',
  whenToUse: 'Step 4.4 of METHOD.md, after the branch reviews: fixing their findings',
  phases: [
    { title: 'Fix', detail: 'one fixer applies the fix brief' },
    { title: 'Fix review', detail: 'two lenses over the fix diff, each finding sent to a refuter' },
    { title: 'Fix 2', detail: 'a second fix pass for confirmed fix-review findings' },
    { title: 'Reverify', detail: 'run the re-verification task as written' },
  ],
}

// args: { change, brief, base, reverify, scratch, rules? }
const { change, brief, base, reverify, scratch } = args
const DIR = `openspec/changes/${change}`
const RULES = `Work in the current repository, on branch ${change} (checked out). Never switch branches, never commit to the default branch, never git stash/clean/reset --hard/rebase/amend. Follow the repository's AGENTS.md (commit conventions, safety rails, side-effect checks, live-system rules); where it is stricter than this prompt, it wins. Never read or print secrets. Never delete repository files unless the fix brief lists them. Scratch directory: ${scratch}. ${args.rules || ''}`
const STATUS = { type: 'object', properties: { ok: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' }, problems: { type: 'array', items: { type: 'string' } } }, required: ['ok', 'summary', 'problems'] }
const FINDINGS = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'warning', 'suggestion'] }, file: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['id', 'severity', 'file', 'problem', 'evidence', 'fix'] } } }, required: ['findings'] }
const VERDICT = { type: 'object', properties: { real: { type: 'boolean' }, reason: { type: 'string' } }, required: ['real', 'reason'] }

phase('Fix')
const fix = await agent(`${RULES}\n\nApply the fix brief ${brief}, EXCEPT its re-verification task ${reverify}: write that task's text into tasks.md as the brief says, but do not run it (someone else does, later). Read the brief, any REVIEW_NOTES.md in the repository root, and the change artifacts at ${DIR} first. Test first where the brief says so: record red, green and the mutation results in the tasks.md Notes the brief names. Record one disposition per finding id (fixed with commit / declined with reason / owned by the lead) in the disposition table the brief names. Run targeted test filters only, never the full suite. Keep the design, tasks and spec deltas consistent with the code, and \`openspec validate ${change} --strict\` green. Commit in logical commits. Return ok, commits, summary and problems.`, { label: 'fix', phase: 'Fix', schema: STATUS })

const lenses = [
  { key: 'code', p: 'CODE: is each fix correct and minimal? Do the new tests fail on the claimed mutation? (If cheap, re-run one mutation yourself: mutate, run the targeted filter, then git checkout -- <file> and confirm git diff --quiet -- <file>.) Does the fix add a hermeticity leak, flakiness (shared temp dirs, timing, parallel runs) or a cleanup bug?' },
  { key: 'artifacts', p: 'ARTIFACTS: are the design, tasks and spec deltas consistent with the code after the fix? Is every design section the fix touches updated? Is the re-verification task text complete, with literal assertions and positive controls for every new or changed claim? Does the disposition table have one row per finding id from the reviews? Are delta headers still verbatim and MODIFIED blocks whole? Is validate green?' },
]

phase('Fix review')
const reviewed = await pipeline(lenses,
  l => agent(`${RULES}\n\nREAD-ONLY reviewer (no edits, no commits) of the fix diff \`git diff ${base}..HEAD\` on branch ${change}, made from the fix brief ${brief}. The fixer reported: ${JSON.stringify(fix)}. Lens: ${l.p} Report only real defects, with evidence. Do not run the full suite.`, { label: `review:${l.key}`, phase: 'Fix review', schema: FINDINGS }),
  (r, l) => parallel((r?.findings || []).map(f => () => agent(`${RULES}\n\nREAD-ONLY. Try to REFUTE this finding against the files. Return real=false only if it is wrong or immaterial.\n${JSON.stringify(f)}`, { label: `refute:${l.key}/${f.id}`, phase: 'Fix review', schema: VERDICT }).then(v => ({ ...f, lens: l.key, verdict: v })))))
const confirmed = reviewed.flat().filter(Boolean).filter(f => f.verdict?.real)

let fix2 = null
if (confirmed.length) {
  phase('Fix 2')
  fix2 = await agent(`${RULES}\n\nApply these confirmed fix-review findings. Verify each against the source first, and skip it with a reason if it is wrong. Targeted tests only. Keep validate green. Commit. Add each one to the disposition table the fix brief names.\n\n${confirmed.map(f => `[${f.lens}/${f.id}] ${f.severity} ${f.file}\nPROBLEM: ${f.problem}\nEVIDENCE: ${f.evidence}\nFIX: ${f.fix}`).join('\n\n')}`, { label: 'fix2', phase: 'Fix 2', schema: STATUS })
}

phase('Reverify')
const rv = await agent(`${RULES}\n\nRun task ${reverify} of ${DIR}/tasks.md exactly as written: every assertion and control, and the side-effect windows the repository's AGENTS.md defines. Run it from a shell without the developer's environment overrides. Record the measured values in its Notes and tick it only if every assertion held; also tick the task that holds the disposition table if that table is complete. If anything fails, record it and report ok=false; do not paper over it. Commit tasks.md. Return ok, commits, summary and problems.`, { label: 'reverify', phase: 'Reverify', schema: STATUS })

return { fix, confirmed: confirmed.map(f => ({ id: `${f.lens}/${f.id}`, problem: f.problem })), fix2, rv }
