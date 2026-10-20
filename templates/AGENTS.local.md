# <Repository name> — agent orientation

This repository follows the method in `method/METHOD.md` (Verified Spec-Driven Development). This file holds the local specifics. **Where this file and the method disagree, this file wins.**

## What is here

| Path | What | Language |
|---|---|---|
| `<path>` | <one line> | <language> |

## Commands

- Build: `<command>`
- Non-live tests: `<command>` (must be hermetic: no real databases, endpoints or secrets)
- Live tests: `<command>` (need: <running services>)
- Spec validation: `openspec validate --all --strict`

## Test categories

<e.g. Unit, Contract, Integration, Live. How a test declares its category.>

## Side-effect checks

How to prove a run touched nothing it should not. Used after every test run (METHOD.md section 5).

- Database: `<command that snapshots row counts / hashes>`, diffed before and after.
- Paid APIs: `<where quota usage is recorded>`.
- Logs: `<log path>`; a window is the lines appended during the run.
- Live connections: `<how to tell whether the run opened one>`.

## Live systems

| System | Access rule | Agent identity | Upstream log |
|---|---|---|---|
| <e.g. broker gateway> | read-only | <client id reserved for agents> | <where its own log is, and how to read it> |

## Safety rails (in addition to METHOD.md section 7)

- <e.g. back up the dev database before any data change: `<command>`>
- <e.g. identities that agents must never use>
- <e.g. commit conventions: prefixes, no trailers>

## Mandatory review checks

<Checks every reviewer must run for this repository, e.g. "a change to argument parsing needs a subprocess test".>

## Anchor incidents

<Short, concrete stories of verification failures in this repository and the assertion that would have caught each.>

## Where new agent context goes

Follow METHOD.md section 8. This file receives a new entry only when the fact is cross-cutting, durable, and has no better home.
