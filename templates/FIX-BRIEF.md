# `<change-name>` — fix brief (task <n>)

Sources: `REVIEW_NOTES.md` (fresh reviewer; copy in the scratchpad) and the adversarial review's confirmed findings (`<path>`). pre-fix commit = `<sha>`. Give **every finding id** its own row in the disposition table in tasks.md `<task>` Notes: fixed (commit) / declined (reason) / owned by the lead. Fix overlapping findings once.

## Provenance (for regression fixes and backports)

- **Culprit commit**: `<sha / URL that introduced or exposed the failure>`
- **Backport source** (if applicable): `<original fix PR URL and commit SHA/URL>`

## Caller regime matrix (when touching a shared helper, base class or router)

| Regime | Representative caller / test | Expected behavior |
|---|---|---|
| `<e.g. standard happy path>` | `<file:line or test filter>` | `<outcome>` |
| `<e.g. null / optional argument>` | `<file:line or test filter>` | `<outcome>` |
| `<e.g. legacy / migrated / untriggered state>` | `<file:line or test filter>` | `<outcome>` |

## Fix (test first where it is code: red, green, mutation)

- **<id>** <what to change, where, and how to prove it>
- **<id>** …

## Decline or defer (with the reason recorded)

- **<id>** <why not in this change; where it is recorded instead>

## Owned by the lead

- **<id>** <e.g. a live re-run under specific conditions; the fixer only adds the task text>

## Rules

- Keep `openspec validate <change-name> --strict` green and every MODIFIED header verbatim. If the deltas come from a generator script, regenerate them; do not hand-edit the output.
- Commit one logical fix per commit, following the repository's conventions and recording provenance (culprit commit SHA/URL and, for backports, original fix PR/commit URL) in the commit body.
- Do not run the full suite; the re-verification runs separately.

## Re-verification (task <m>; done later by someone else — write the task text, do not run it)

Re-run: the delta integrity checks, every check whose claim the fix touched, the full non-live suite (expected count = previous + the tests the fix added, each named) with the side-effect checks, and the smoke run against its baseline. Tick the task only if every assertion holds.
