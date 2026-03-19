# Sentry → GitHub → Oz demo
## Prerequisites
- Start the app and supporting services in another terminal:
  - `make watch`
- Confirm Sentry is configured to create GitHub issues with the `sentry` label.
- Confirm the GitHub Actions workflow and required secrets/variables are already configured.
- The demo trigger targets run against `http://localhost:3000`.

## Trigger the demo
Run the automated demo trigger:

```sh
make demo-trigger-sentry
```

To watch the browser while the demo runs:

```sh
make demo-trigger-sentry-headed
```

## What the demo does
The scenario:
1. checks whether a local single-host site exists and creates it if needed
2. signs in as `admin`
3. creates a new post
4. opens the staff response modal
5. sets the post status to `archived`
6. submits the response and reloads the post page
7. triggers the intentional frontend enum-drift crash

## Notes
- If `make demo-trigger-sentry` says the app is unreachable, start it first with `make watch`.
- In single-host mode the demo assumes the admin email is `admin@fider.io` unless you override `E2E_ADMIN_EMAIL`.

## Expected result
- The browser lands on the in-app error page.
- The frontend exception is sent to Sentry.
- Sentry creates a GitHub issue with the configured label(s).
- GitHub Actions picks up that issue and runs Oz triage.
