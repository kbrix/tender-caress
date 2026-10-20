# The method: Verified Spec-Driven Development

A way of building software with AI agents where every behavior change is written down as a spec first, and every claim about the work is checked by someone other than the one who made it, with a command whose output proves it.

This file is tool-agnostic. It speaks in **roles**, not tools. `claude/CLAUDE.md` maps the roles onto Claude Code. A repository adds its own specifics (commands, live systems, safety rails) in its `AGENTS.md`; where that file and this one disagree, the repository's file wins.

---

## 1. Principles

1. **The spec is the contract.** Specs describe what the system SHALL do today. A behavior change is a spec change first. When code and spec disagree, that is a bug in one of them, never "expected behavior".
2. **Prove it literally.** A task is done when a command shows the promised outcome: `<run the thing> | <extract the promised value> | <assert it>`. Exit codes, log lines and "tests pass" are symptoms, not proof.
3. **Nobody grades their own work.** The one who implements is never the one who verifies. Reviews come from fresh context, and every review finding is challenged before anyone acts on it.
4. **Fixes are riskier than drafts.** Applying review findings introduces new defects more often than first drafts do, so every fix diff is reviewed again.
5. **Small, ordered changes.** Split work into changes that each have one clear purpose. Each requirement is edited by exactly one change.
6. **The operator decides product; the agent decides engineering.** Ask only questions whose answer changes what gets built. Consequences of a decided direction are design decisions, not questions.
7. **Quality over speed.** The ceremony is the product. Cut scope, never verification. Give honest time estimates instead of skipping steps.

---

## 2. Roles

| Role | Does | Never |
|---|---|---|
| **Operator** | Owns the product. Answers open questions, delegates autonomy, approves anything irreversible or public. | — |
| **Lead** | Runs the process: writes briefs, launches the other roles, checks their claims, keeps the record, merges when delegated. | Grades its own implementation. |
| **Explorer** | Maps a problem area and reports facts with `file:line` evidence. | Edits anything. |
| **Critic** | Turns exploration into numbered open questions (OQ1, OQ2…), each with a recommendation. | Decides for the operator. |
| **Drafter** | Writes a change (proposal, design, spec deltas, tasks) from a brief. | Writes code. |
| **Implementer** | Executes one task group, test first. | Ticks a task without its measured value. |
| **Verifier** | Re-checks one task group independently and re-runs its assertions. | Trusts the implementer's report. |
| **Reviewer** | Reviews a whole branch with fresh context (no prior conversation). | Edits code. |
| **Adversarial reviewer** | Hunts for defects through one **lens** (code correctness, spec truth, completeness, safety…). | Reports style preferences as defects. |
| **Breaker** | Uses the product the way a hostile or confused user would (odd inputs, wrong order, empty or huge data, the regime where the change matters) and reports each break as a reproducible command with its wrong output. | Starts from the implementation instead of the specs and docs. |
| **Mutant** | Breaks the changed code on purpose (flipped conditions, deleted calls, off-by-one boundaries, swapped constants), runs the tests, and reports every mutant that survives. | Mutates tests, or works in a shared working tree. |
| **Refuter** | Tries to prove one finding wrong or immaterial before anyone acts on it. | Confirms without checking the evidence. |
| **Fixer** | Applies confirmed findings and records each one's disposition. | Fixes unconfirmed findings silently. |

One agent can hold several roles over time, but never both sides of a check (implementer and verifier, implementer and mutant, or author and refuter).

---

## 3. Process tiers

The lead proposes a tier for every piece of work; the operator can overrule it.

| Tier | When | Required |
|---|---|---|
| **Trivial** | Typos, comments, docs that change no promise | A branch, the change, one look by a reviewer (or the operator). |
| **Standard** | A small behavior change in one area, no data or live-system risk | A spec delta + tasks, test first, one fresh reviewer, the fix diff re-checked. |
| **Full** | Architecture, data migrations, money, live external systems, anything hard to reverse | The whole lifecycle below, including the probe (breaker and mutant). |

When unsure, pick the higher tier.

---

## 4. The lifecycle (Full tier)

### 4.1 Explore and decide

1. **Baseline first.** Before changing anything, capture the current state: the full test suite, a CLI/API smoke run, and the live checks, saved for later comparison.
2. **Explore** with several explorers in parallel, one per area. Then a **critic** consolidates the reports into numbered open questions, each with a recommendation.
3. **The operator decides.** Record each answer verbatim, with the date, next to its question. "Accept all recommendations" is a valid answer.
4. **Split** the work into ordered changes. Name what each change owns, so that two changes never edit the same requirement. A change that leaves something for a later one writes a **hand-off list** with exact anchors (`file:line`, requirement headers).

### 4.2 Draft and review the change

5. **Write a brief** for the drafter: scope (decided items quoted), what not to touch, inputs to read, the literal verification the tasks must encode, and the process constraints.
6. **Draft** the change: proposal (why, what changes), design (decisions D1, D2… with alternatives), spec deltas, tasks (grouped, each with a literal assertion and a positive control).
7. **Review the draft adversarially** through at least three lenses:
   - **spec truth**: headers and quoted text verbatim, every factual claim true against the code;
   - **verification quality**: would each assertion fail if the change were wrong?
   - **scope and safety**: decisions implemented as decided, nothing speculative, no unsafe step.

   Each finding goes to a refuter. Fix the confirmed ones, then review the fix diff. Commit the proposal.

### 4.3 Implement

8. **Apply in groups**, one after another. For each group: an implementer works test first (red, then green, then a mutation check), records measured values in the task notes, and commits. Then an independent verifier re-runs the group's assertions and fixes or reports defects.
9. A failed assertion is a stop, not a rounding error. Either the code is wrong or the assertion is wrong-shaped. Fix the smaller thing and say so in the notes.

### 4.4 Review the branch

10. **Review and probe in parallel:**
    - a fresh reviewer over the whole branch (build, full suite, spec adherence);
    - an adversarial review with lenses and refuters (tell it about the fresh reviewer's findings, so it hunts for what was missed);
    - a **probe**: a breaker exercises the built product against its specs, and a mutant mutates the changed code in an isolated copy. Each surviving mutant is a missing test or code that nothing needs. Their findings go to refuters too.
11. **Fix** in one pass from a fix brief that lists every finding id. Record a disposition per id: fixed (commit), declined (reason) or owned by the lead. Then review the **fix diff** adversarially, apply a second pass if needed, and **re-verify**: the full suite, the side-effect checks and the smoke run again.

### 4.5 Prove it live (when a live system is involved)

12. Run **before and after** under the same conditions: the old and new builds back to back, same inputs, same market or traffic state. Compare the outputs structurally (same set, same null pattern, the promised field present).
13. Cover the regime that matters. If the behavior only differs off-hours, under load or on failure, test that regime. A pass in the easy regime proves nothing about the hard one.
14. Capture the **upstream** log (what the external system saw) as well as your own. Your log only shows what you consumed.

### 4.6 Close out

15. **Sync** the spec deltas into the living specs. If the spec tool's own sync or archive is unreliable, build its result in a scratch copy, apply that by hand, and diff the two.
16. **Verify by outcome, not exit code.** An archive that "succeeded" must show the directory actually moved.
17. Record what was learned (section 8), merge as delegated, and **notify the operator** at the checkpoint.
18. Compact or restart the agent session between changes, with a written kickoff prompt that restates the state, the scope and the rules.

---

## 5. Verification discipline

- **Literal assertions.** Every task carries the exact command and the value it must produce. Example shape: `run --json | jq '[.items[] | .price] | any(. != null)'` → `true`.
- **Positive controls.** Every absence check ("no longer mentions X", "0 rows", "no requests sent") is paired with the same command against something that must match: the old revision, or a kept sibling term. Otherwise a broken grep passes silently.
- **Measured values.** Write the actual value into the task notes, with the date. Memory and summaries drift.
- **Red first, then mutate.** A new test must fail before the change, pass after, and fail again when the change is reverted or broken on purpose. A test that never failed proves nothing.
- **Independent mutation.** The implementer's own mutation check shows that a test can fail; it does not show that the tests are enough, because the implementer picks a mutation the test catches. On the Full tier a separate mutant mutates the changed code without looking at the tests first.
- **Side-effect accounting.** After test runs, check what changed outside the code: database rows, vendor quota usage, files written, sockets opened. A test suite that quietly writes to a real database or spends paid API credits is a defect.
- **Hermetic by default.** Tests isolate themselves from the developer's environment (environment variables, config files, live endpoints) unless a test is explicitly marked live.
- **Check the shape of the check.** Wrapped lines counted twice, filters that match unrelated names, a multi-file `sed` that reads one file, a stale build: a wrong-shaped assertion is as bad as no assertion. When one is found, fix it and say so.

### Anchor incident

A fix promised that prices would populate outside trading hours. The verification task said "confirm the price is non-null". It was marked done because the command exited 0 and logged the expected warnings. The next day every price was still null. The fix had set a data mode but never handled the data that mode produces. One literal assertion (`… | any(. != null)` → `true`) would have failed before the change shipped.

---

## 6. Spec discipline

- Specs live in the repository (OpenSpec recommended). Read the relevant spec before declaring observed behavior "expected".
- A change carries deltas: **ADDED**, **MODIFIED** (the whole current requirement, edited only where the change cuts), **REMOVED** (with reason and migration), **RENAMED**. Quoted headers must match the living spec verbatim.
- Specs rot unless checked. Periodically, and in every review, check spec claims against the code. Rotted specs are paid down by dedicated changes, not ignored.
- If the spec is silent on an observed behavior, that is a gap: add a scenario if the behavior is wanted, or fix the code if it is not.

---

## 7. Safety rails

- Work on a branch. Never commit to the default branch directly; merge with a merge commit when the operator says so or has delegated it.
- Back up before changing data. Rehearse destructive steps on a scratch copy first.
- Look at what you are about to delete. Never run blanket cleanup commands (`git clean`, `rm -rf` on a pattern).
- External systems are read-only unless the operator says otherwise. Use dedicated client identities for agents, never the operator's own.
- Say what a paid call costs before making it.
- Never print, log or commit secrets.
- Anything public or irreversible (a push to a public repo, a message, a deployment) needs the operator's explicit go.

---

## 8. Knowledge routing

Every new fact goes to exactly one place:

| Kind of fact | Goes to |
|---|---|
| Behavior the system SHALL exhibit | The spec (a scenario) |
| A durable operational gotcha (a vendor quirk, a log location, quota math) | The agent's persistent memory or a project notes file |
| A constraint on one specific line of code | An inline comment at that line |
| Cross-cutting and durable orientation, with no better home | The repository's `AGENTS.md` (keep it slim) |

---

## 9. The autonomy contract

- The operator can delegate a sequence of changes, including merges. The lead then runs without waiting and notifies the operator at agreed checkpoints.
- Ask only for genuine product decisions, each with a recommendation. Quote the answer verbatim in the change's design.
- Never present an undecided item as decided.
- When a permission or safety check blocks an action, stop and explain. Do not route around it.
- Report failures as failures, with the output. A skipped step is reported as skipped.

---

## 10. Anti-patterns

- Marking a task done because the command ran.
- An absence check without a positive control.
- The implementer verifying its own work, or choosing the only mutation its tests are judged by.
- Applying review findings without reviewing the fix.
- A live check run only in the regime where the change cannot matter.
- Re-asking a decided question, or deciding an open one silently.
- Rationalizing a surprise ("it's probably expected") instead of reading the spec.
- Slimming the review to save time on a Full-tier change.

---

## 11. Adopting the method

1. Add this repository as a submodule (see `README.md`).
2. In the repository's `AGENTS.md`, state that it follows `method/METHOD.md`, then fill in the local specifics from `templates/AGENTS.local.md`: build and test commands, test categories, side-effect checks, live systems, safety rails, anchor incidents.
3. Wire in the tool-specific part (for Claude Code: `claude/CLAUDE.md`).
