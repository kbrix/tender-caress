# Drafting brief — `<change-name>`

Branch `<change-name>` (off `<base-sha>`). Write the OpenSpec change at `openspec/changes/<change-name>/` (proposal.md, design.md, specs/**/spec.md deltas, tasks.md). Do NOT write code, commit, delete, write to databases or live systems, or read secrets.

<One paragraph: which change this is in the sequence, and its job.>

## Scope — DECIDED (operator, <date>; quote the answers verbatim)

1. <decided item, with the operator's words>
2. …

**Keep (not in scope, must not change):** <items>

## Owned by other changes — do NOT touch

- <item> (owned by `<other-change>`), with file:line anchors.

## Inputs (read all)

- <exploration reports, hand-off lists, archived changes for house style>
- `.claude/skills/openspec-propose/SKILL.md` (its format rules win), if present.

## Delta rules

- REMOVED, MODIFIED and RENAMED headers verbatim against the live spec (`grep -cxF` = 1 each); MODIFIED blocks whole; REMOVED blocks carry a Reason and a Migration.
- `openspec validate <change-name> --strict` passes; the tool reference (archive in a scratch copy) applies cleanly.

## Verification the tasks must encode literally

- Test first where behavior changes: name each new test, why it is red before the change, and its mutation check.
- Every absence claim has a same-shape positive control.
- The full non-live suite: the expected count (old − removed + added) and the side-effect checks.
- The smoke or live checks: their baseline, the expected differences, and the conditions (time, state) under which they must run.
- Costs: what each live or paid call costs.

## Process constraints for tasks.md

- Task groups, each with an independent verifier; measured values in Notes.
- Deletions listed by path (the lead deletes if subagents are blocked).
- Close-out: fresh reviewer ‖ adversarial review → fix → fix-diff review → re-verification → spec sync against a tool reference → archive (verified by the directory move) → merge as delegated.

## Open questions

Record only genuinely new product decisions, each with a recommendation. Engineering consequences of decided items are design decisions.
