---
name: frontend-observability-triage
description: Triage frontend production regressions and observability-driven GitHub issues for this repository, especially Sentry-created issues that include error links, trace links, release or environment metadata, or browser runtime failure details. Use when the goal is to investigate likely root cause, impacted user flow, suspect files, and recommended fix or rollback path. If the evidence supports a prudent high-confidence fix, implement the smallest safe change and open a PR that references the issue.
---

# Frontend observability triage
Start with diagnosis. If the evidence points to a small, prudent, high-confidence fix, carry it through to a PR. Do not stop at a comment-only outcome when the observed failure is directly explained by a narrow local code change that you can validate in this repo.

## Runtime contract
Require:
- checked-out copy of this repository
- `GH_TOKEN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- GitHub issue number or enough context to fetch it with `gh`

Optional:
- `SENTRY_BASE_URL` for non-default Sentry hosts

If required credentials are missing, stop and report that triage is blocked by workflow configuration.

## Guardrails
- Default to diagnosis-only unless the fix path is clearly warranted.
- Do not modify files or open a PR for low-confidence or broad-scope issues.
- Prefer the smallest safe fix over a broad cleanup or refactor.
- Do not broaden scope beyond the observed production regression.
- Do not make schema, migration, or cross-system contract changes from this workflow.
- Do not suggest additional automation from inside the run.
- Do not paste raw Sentry payloads into GitHub.
- Do not print secrets.

## Workflow
### 1. Read the GitHub issue first
Prefer:

```sh
gh issue view <ISSUE_NUMBER> --comments
```

Extract only the signals that matter:
- Sentry issue link or ID
- trace links
- event IDs
- release / environment
- route, browser, transaction, or user-flow clues

### 2. Pull the minimum useful Sentry context
Use Sentry only far enough to support a diagnosis.

Preferred order:
1. issue details
2. recommended or latest event
3. recent full events only if needed
4. release details only if a release is known

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

Capture only high-signal facts:
- exception type and message
- best stack clue
- release / environment
- URL, route, transaction, browser tags
- event count / user count if materially useful
- whether trace exists
- whether frames are source-mapped or minified

### 3. Inspect the repo
Use the stacktrace and event context to inspect the most likely local code path.

Prioritize:
- exact files and symbols from the stacktrace
- nearby callers and related models
- recent history only if a release suggests a regression

Common high-signal areas in this repo:
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

Heuristics that often pay off here:
- frontend/backend enum drift
- config-driven parsing failures
- secondary interaction crashes in dropdowns, modals, or editors
- missing source maps hiding an otherwise obvious code path

### 4. Form a diagnosis
Answer:
- what likely broke
- which user flow is impacted
- which files are most suspect
- whether the immediate response is mitigation, rollback, or a code fix
- how confident the diagnosis is

Confidence:
- **High**: direct event evidence plus a clear matching code path
- **Medium**: strong evidence, but some ambiguity remains
- **Low**: multiple plausible causes remain

Severity:
- **High**: hard crash in a core flow or broad production impact
- **Medium**: limited-scope crash or secondary-flow breakage
- **Low**: edge-case failure or mostly observability hygiene

### 5. Decide whether to stop at triage or fix it
Choose **diagnosis-only** if any of these are true:
- confidence is not high
- the fix would touch multiple unrelated areas
- the correct fix depends on unclear product intent
- the change needs backend, schema, or API coordination
- the safest next step is rollback or mitigation

Choose **fix + PR** only when all of these are true:
- confidence is high
- the suspected code path is local and well-bounded
- the fix is small, prudent, and directly tied to the observed failure
- validation is feasible in the current repo setup

Strong candidates for **fix + PR** in this repository include:
- frontend/backend enum drift where the backend already defines the intended value and the frontend crashes on parsing or rendering it
- a hardcoded UI option that is inconsistent with an existing frontend model or shared contract
- a direct stacktrace to one or two local frontend files plus a concrete repro from the issue

When those signals are present, prefer opening a PR over stopping at diagnosis-only. If validation is partially blocked but the code path and fix are still high-confidence, prefer a draft PR with explicit validation notes over no PR.

### 6. If diagnosis-only, post one compact triage comment
Post exactly one structured comment with `gh issue comment`.

Optimize for fast scanning:
- Start with a real TL;DR.
- Prefer bullets over paragraphs.
- Keep sections short.
- Do not repeat the same point in Summary, Root cause, and Recommended action.
- List at most 3 suspect files unless more are essential.
- Omit empty sections.
- Include Open questions only if they materially affect confidence or next steps.

Use this format:

```markdown
## Frontend observability triage

### TL;DR
- **What broke:** <1 sentence>
- **Impact:** <1 sentence>
- **Next action:** <1 sentence>

### Severity / confidence
- **Severity:** <high|medium|low> — <brief why>
- **Confidence:** <high|medium|low> — <brief why>

### Evidence
- Sentry issue / event: ...
- Trace: ...
- Release / environment: ...
- Key error or stack clue: ...
- Route / URL / browser clue: ...

### Likely root cause
<1 short paragraph or 2 bullets max>

### Suspect files
- `path/to/file`: <why>
- `path/to/file`: <why>

### Recommended action
- **Immediate:** <rollback, mitigation, or "no rollback needed">
- **Fix:** <concrete fix direction>

### Validation
- <how to verify the fix or mitigation>

### Open questions
- <only if important>
```

Prefer `gh issue comment <ISSUE_NUMBER> --body-file <file>` over large inline shell strings.

### 7. If fix + PR, implement the minimum safe change
Keep the diagnosis quality bar from the earlier steps. Then:

1. change only the smallest code path that directly addresses the failure
2. validate with the most relevant checks available
3. open a PR that references the issue
4. leave the issue with one compact comment that summarizes the diagnosis and links the PR

For straightforward regressions, keep the diff tightly scoped to the failing contract. Example: if the frontend crashes because a backend-supported status value is missing locally, add the missing frontend enum/state handling and remove or align any hardcoded duplicate value instead of broad refactors nearby.

Validation expectations:
- run targeted tests when they exist
- prefer `make lint` and `make test` before opening the PR when practical
- if full validation is too expensive or blocked, state exactly what was and was not run in the PR body

PR guidance:
- use a focused branch and title
- keep the diff narrow
- include the issue reference in the PR body, for example `Refs #<ISSUE_NUMBER>` or `Closes #<ISSUE_NUMBER>` when appropriate
- summarize the user flow, root cause, and validation in the PR body
- prefer a draft PR if confidence is high on the code path but there is still some rollout or product risk

Issue comment guidance after opening the PR:
- keep the same triage structure above
- update **Next action** to point at the PR
- add a short PR line under Recommended action or Validation

## Stop condition
Stop once the issue has either:
- a concise diagnosis, strongest evidence, top suspect files, and a clear next action, or
- a linked PR containing the smallest prudent fix with validation notes and issue reference
