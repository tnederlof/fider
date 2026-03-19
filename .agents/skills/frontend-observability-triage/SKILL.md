---
name: frontend-observability-triage
description: Triage frontend production regressions and observability-driven GitHub issues for this repository, especially Sentry-created issues that include error links, replay links, trace links, release or environment metadata, or browser runtime failure details. Use when the goal is to investigate likely root cause, impacted user flow, suspect files, and recommended fix or rollback path without immediately making code changes.
---

# Frontend observability triage
Produce a diagnosis-only comment that helps a maintainer decide the next step quickly.

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
- Diagnose only.
- Do not modify files.
- Do not open a PR.
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
- replay / trace links
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
- whether replay or trace exists
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

### 5. Post one compact triage comment
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
- Replay / trace: ...
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

## Stop condition
Stop once the issue has a concise diagnosis, the strongest evidence, top suspect files, and a clear next action.
