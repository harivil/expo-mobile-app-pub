---
name: preflight-ci
description: Run the checks GitHub Actions runs on a pull request, locally, before pushing — and triage a red check when one still lands. Use before opening or updating a PR, when a CI check fails, or when adding a check to CI.
---

# Preflight

A red pull request costs a push, a wait, and a context switch. Worse, it costs attention: a PR
that has been red four times stops being read, and the fifth failure — the real one — lands in a
check nobody looks at any more.

Everything CI can prove on a pull request except CodeQL and the SARIF upload can be proven here
first, in minutes, against the same commands.

```bash
node .claude/scripts/ci-local.mjs
```

Exit 0 means no blocking check failed. Exit 1 names the ones that did, and CI will fail the same
way. **Read the output** — a check that exited zero with warnings you did not read has not been
verified.

## Running less than everything

```bash
node .claude/scripts/ci-local.mjs --list                  # what would run, and why
node .claude/scripts/ci-local.mjs --fast                  # skip semgrep, playwright, npm ci, tests
node .claude/scripts/ci-local.mjs --only=types,lint       # one job's worth
node .claude/scripts/ci-local.mjs --install               # npm ci first, the way CI starts
node .claude/scripts/ci-local.mjs --base origin/main      # base ref for the test-integrity report
```

`--fast` while building, everything before pushing. Run with `--install` after changing
`package.json` or pulling someone else's dependency change — a check that passes against a stale
`node_modules` says nothing about what CI will install.

## What maps to what

Each check carries the CI job it belongs to, so a red check on github.com maps to one id here.

| CI job                    | Local ids                                                    | Proven locally                     |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| `CI / verify`             | `install` `format` `types` `lint` `test` `doctor` `versions` | fully                              |
| `CI / web-e2e`            | `web-e2e`                                                    | fully, once browsers are installed |
| `CI / agent-config`       | `hooks` `skills`                                             | fully                              |
| `CI / test-integrity`     | `test-integrity`                                             | fully — reports, never fails       |
| `Security / semgrep`      | `semgrep-rules` `semgrep`                                    | fully, with semgrep or docker      |
| `Security / secrets`      | `secrets`                                                    | only with gitleaks installed       |
| `Security / dependencies` | `audit` `doctor`                                             | fully                              |
| `Security / codeql`       | —                                                            | **no**                             |

A check that cannot run reports `skip` with the reason. A skip is not a pass, and the summary
lists them separately for exactly that reason.

## The four things a local run cannot tell you

1. **CodeQL.** No practical local runner, and on a private repository it needs GitHub Code
   Security. This repo is private and keeps the job, so both it and the SARIF upload wait behind
   a repository variable rather than failing on the upload every time:

   ```bash
   gh variable set CODE_SCANNING --body true
   ```

   Set it when Code Security is enabled, not before. The semgrep _scan_ and its ERROR gate run
   either way — the variable decides where results are filed, never whether they block.

2. **The SARIF upload.** Needs a workflow token and code scanning enabled on the repository.
3. **Workflow permissions.** Declaring `permissions:` in a workflow _replaces_ the default token
   scopes rather than adding to them, so an action that needs a scope nobody listed fails as a
   403 from inside its own code — never as anything that looks like a permission error. This
   class of failure only exists against the real API. When a job dies on
   `Resource not accessible by integration`, the fix is a scope in the workflow, not the code.
4. **Dependabot.** Runs on a schedule against the default branch.

## Triage — what each red check actually means

| Symptom                                  | What it is                                                              | Fix                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Cannot find module '@playwright/test'`  | a committed config importing a dependency that is not in `package.json` | `npm i -D @playwright/test`                                                                      |
| `Cannot find module './x.module.css'`    | a web-only import with no type declaration                              | declare it in a `.d.ts`; see the **`scaffold-feature`** skill                                    |
| `expo-doctor`: version mismatch          | a package outside the SDK's pinned range                                | `npx expo install --check`, or `expo.install.exclude` when deliberate                            |
| `npm audit` high                         | a transitive advisory                                                   | `npm audit fix`, or pin the parent; never `--force` on a whim                                    |
| semgrep `N blocking findings`            | ERROR-severity rules only                                               | fix, or justify a narrow `nosemgrep` with a reason — the **`security-scan`** skill covers triage |
| `Resource not accessible by integration` | a missing workflow scope                                                | add it under `permissions:` in the workflow                                                      |
| `Dependencies lock file is not found`    | the branch has no app — `main` is harness-only                          | nothing; the app jobs skip themselves via the `detect` job                                       |
| `Code scanning is not enabled`           | private repo without GitHub Code Security                               | enable it, then `gh variable set CODE_SCANNING --body true`                                      |
| gitleaks finding                         | a secret in history                                                     | **rotate it**, then remove it. Deleting the line is not a fix                                    |

## The gate

`guard-pr.mjs` blocks `gh pr create`, `gh pr ready` and `gh pr merge` until a full run has passed
against the code being reviewed. It reads the receipt each run writes, and treats four things as
unproven: no run, a failed run, a `--fast` or `--only` run — green about the checks it chose,
which is a different claim — and a green run against a different tree, which is the case people
actually hit, because the working tree moved after the run.

A draft is deliberately never blocked:

```bash
gh pr create --draft        # share work in progress, ungated
```

The hook fails open on any internal error, and `CLAUDE_SKIP_CI_PREFLIGHT=1` overrides it. That
exists for a broken gate. Reaching for it twice means the gate is wrong — fix the gate.

## When you add a check to CI

Add it in both places in the same commit: the job in
[`ci.yml`](../../../.github/workflows/ci.yml) or
[`security.yml`](../../../.github/workflows/security.yml), and the entry in
[`ci-local.mjs`](../../scripts/ci-local.mjs) carrying the same command and the same job name.

A check that exists only in CI teaches people that local runs prove nothing, and the next person
stops running them. If a check genuinely cannot run locally, add it to that script's `CI_ONLY`
list so a green run still says out loud what it did not cover.

## Where this sits in the loop

Stage 5 of the **`feature-loop`** skill: after the **`verify-app`** skill's checks and the app
itself, before review. Preflight proves the repo's checks agree; it says nothing about whether the
screen renders. Both are stage 5, and neither substitutes for the other.
