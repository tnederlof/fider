---
name: frontend-observability-triage
description: Triage frontend production regressions and observability-driven GitHub issues for this repository, especially Sentry-created issues that include error links, replay links, trace links, release or environment metadata, or browser runtime failure details. Use when the goal is to investigate likely root cause, impacted user flow, suspect files, and recommended fix or rollback path without immediately making code changes.
---

# Frontend observability triage
Use this skill when a GitHub issue created from Sentry should trigger a diagnosis-only Oz run.

## Required runtime contract

This skill expects:

- a checked-out copy of this repository
- `GH_TOKEN` for reading and commenting on the issue
- `SENTRY_AUTH_TOKEN` for Sentry API access
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- the GitHub issue number in the prompt, or enough issue context to fetch it with `gh`

Optional:

- `SENTRY_BASE_URL` for non-default Sentry hosts

If any required credential is missing, stop and report that triage is blocked by workflow configuration.

## Guardrails

- Diagnose only.
- Do not modify files.
- Do not open a PR.
- Do not propose multi-stage automation from inside the run.
- Do not paste raw Sentry payloads into GitHub.
- Do not print secrets.

## Workflow

### 1. Read the GitHub issue

Read the issue body and comments first.

Prefer:

```sh
gh issue view <ISSUE_NUMBER> --comments
```

Extract the useful context already present in the issue:

- Sentry issue link or ID
- replay link
- trace link
- release
- environment
- event IDs
- route, transaction, browser, or user-flow clues

### 2. Pull the minimum useful Sentry context

Use Sentry only to enrich the issue enough to form a diagnosis.

Prefer this order:

1. issue details
2. recommended or latest event
3. recent full events if needed
4. release details if a release is known

Typical lookups:

```sh
curl -fsSL \
  "${SENTRY_BASE_URL:-https://sentry.io}/api/0/organizations/${SENTRY_ORG}/issues/${SENTRY_ISSUE_ID}/" \
  --header "Authorization: Bearer $SENTRY_AUTH_TOKEN"
```

```sh
curl -fsSL \
  "${SENTRY_BASE_URL:-https://sentry.io}/api/0/organizations/${SENTRY_ORG}/issues/${SENTRY_ISSUE_ID}/events/recommended/" \
  --header "Authorization: Bearer $SENTRY_AUTH_TOKEN"
```

Focus on:

- exception type and message
- best available stack frames
- release and environment
- route, transaction, browser, and URL tags
- event count and user count
- whether replay or trace exists
- whether frames are source-mapped or still minified

### 3. Inspect the repo

Use the Sentry issue plus stacktrace to inspect the most likely code path in this repository.

Prioritize:

- exact files and symbols from the stacktrace
- nearby callers and related models
- recent history for suspect files if a release suggests a regression

Common files to inspect for frontend runtime failures in this repo:

- `public/index.tsx`
- `public/components/ErrorBoundary.tsx`
- `public/services/actions/infra.ts`
- `public/models/post.ts`
- `public/hooks/use-fider.ts`
- `public/components/common/form/CommentEditor.tsx`
- `public/components/common/form/LinkInsertModal.tsx`
- `public/components/NotificationIndicator.tsx`
- `app/models/enum/*.go`
- `app/handlers/**/*.go`

High-signal heuristics for this repo:

- frontend/backend enum drift
- config-driven client parsing failures
- secondary interaction crashes in dropdowns, modals, or editors
- release/source-map hygiene problems that make stacks unreadable

### 4. Form a diagnosis

Aim to answer:

- what likely broke
- which user flow is impacted
- which files are most suspect
- whether the best immediate response is mitigation, rollback, or a code fix
- how confident the diagnosis is

Use these confidence levels:

- **High**: direct event evidence plus a clear matching code path
- **Medium**: strong stacktrace and code evidence, but some ambiguity remains
- **Low**: multiple plausible causes remain

Use these severity levels:

- **High**: hard crash in a core flow or broad production impact
- **Medium**: limited-scope crash or secondary-flow breakage
- **Low**: edge-case failure or mostly observability hygiene

### 5. Comment on the GitHub issue

Post one structured triage comment with `gh issue comment`.

Use this format:

```markdown
## Frontend observability triage

### Summary
<1-3 sentence diagnosis>

### Severity
<high|medium|low> — <why>

### Confidence
<high|medium|low> — <why>

### Impacted user flow
- ...

### Evidence
- Sentry issue: ...
- Replay: ...
- Trace: ...
- Release / environment: ...
- Key error or stack clue: ...

### Likely root cause
<explanation>

### Suspect files
- `path/to/file`: <why>

### Recommended action
- Immediate mitigation: <rollback, config mitigation, or targeted fix direction>
- Follow-up fix: <concrete next step>

### Validation
- <how to verify the mitigation or fix>

### Open questions
- ...
```

Prefer `gh issue comment <ISSUE_NUMBER> --body-file <file>` over large inline shell strings.

## Stop condition

Stop once the issue has a useful diagnosis, evidence, suspect files, and a recommended next action.
