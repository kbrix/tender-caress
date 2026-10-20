# `<change-name>` — fix brief (task <n>)

Sources: `REVIEW_NOTES.md` (fresh reviewer; copy in the scratchpad) and the adversarial review's confirmed findings (`<path>`). pre-fix commit = `<sha>`. Give **every finding id** its own row in the disposition table in tasks.md `<task>` Notes: fixed (commit) / declined (reason) / owned by the lead. Fix overlapping findings once.

## Fix (test first where it is code: red, green, mutation)

- **<id>** <what to change, where, and how to prove it>
- **<id>** …

## Decline or defer (with the reason recorded)

- **<id>** <why not in this change; where it is recorded instead>

## Owned by the lead

- **<id>** <e.g. a live re-run under specific conditions; the fixer only adds the task text>

## Rules

- Keep `openspec validate <change-name> --strict` green and every MODIFIED header verbatim. If the deltas come from a generator script, regenerate them; do not hand-edit the output.
- Commit in logical commits, following the repository's conventions.
- Do not run the full suite; the re-verification runs separately.

## Re-verification (task <m>; done later by someone else — write the task text, do not run it)

Re-run: the delta integrity checks, every check whose claim the fix touched, the full non-live suite (expected count = previous + the tests the fix added, each named) with the side-effect checks, and the smoke run against its baseline. Tick the task only if every assertion holds.
