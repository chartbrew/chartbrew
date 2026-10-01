# Platform Settings

Platform settings are instance-wide controls for Chartbrew OS.

The platform `Enable Chartbrew AI` control is the upper limit for the installation. Each team also
has an `aiEnabled` control. Chartbrew AI is available only when both controls are enabled. A team
control cannot override a disabled platform control.

## Access

- Only a user with `User.admin = true` can use the API.
- `GET /platform/settings` returns the safe settings registry and effective values.
- `GET /platform/analytics?days=30` returns request and AI usage totals and daily charts across all teams.
- `PUT /platform/settings` saves validated overrides.
- `POST /platform/settings/reset` removes selected overrides and restores deployment defaults.
- These routes cannot change `User.admin`.

## Platform Analytics

Open **Settings → Platform analytics** as a platform admin. Choose 7, 30, or 90 days
(default: 30), or refresh to load current records. Charts use `VisualizationEngine` and the
shared client renderer; KPI values use the same metric formatting as dashboard charts.

`server/modules/platformAnalytics.js` aggregates `SourceExecution` in the database:

- Only `cacheHit: false` records with a confirmed `success` or `failed` outcome are included.
- Periods start at UTC midnight, include today, and end at the response snapshot time (exclusive).
  Requests belong to the day they finish. Pending outcomes are excluded.
- Success rate is successful requests divided by all completed requests. An empty period has no rate.
- Mean time is the sum of valid durations divided by the number of timed requests, across both outcomes.
  Durations run from `startedAt` to `finishedAt`, including pagination and pre-execution overhead.
  Negative durations are excluded from means but still count toward request totals.
- Days without requests show zero counts and a gap for mean time. Missing means are never zero-filled.
- Daily values and period KPIs come from the same aggregate query. No request payloads or identifiers are returned.
- Existing record retention and team deletion rules apply. Records from before execution tracking began are unavailable.

The **AI usage** tab uses the response's `ai` object, aggregated from `AiUsage`:

- Calls, input tokens, output tokens, and total tokens share the selected period. Days use record creation time in UTC.
- All activities are included. One user task can make several provider calls.
- `reported` and `unknown` records count as calls. `pending` records are shown separately; `rejected` records are excluded.
- Older `legacy` records count only when at least one token count is positive. Old zero-token records can represent work without a provider call.
- Token totals include `reported` and included `legacy` records. Partial counts from `unknown` records are excluded.
  Missing counts and records without a final result are shown in a warning and in the daily and model tables.
- Cached input and reasoning tokens are already included in input and output. They are not added again.
- Model totals group by provider and model. Prompts, answers, and team identifiers are not returned.
- No prices or credits are calculated. These remain in Cloud. Existing AI usage migration and retention rules apply.

Run `npm --prefix server run db:migrate` to add the `source_execution_finished` date index.
No new environment variables are needed. Tests run against an isolated database:
`npm --prefix server run test:database -- tests/integration/platformAnalytics.test.js`.

## Product Controls

The platform page contains three groups:

- AI controls cover AI access, external data consent, and workspace learning.
- Reporting and actions cover summaries, recommendations, confirmed changes, and reporting range.
- Advanced AI limits cover the total request budget, maximum answer time, and analysis depth.
  This section stays visible with the other controls.

The external data controls appear only when an AI provider is configured. Provider credentials and
model names remain deployment-only.

Analysis depth maps one product choice to coordinated runtime limits:

| Depth | Analysis tasks | Workspace lookups |
| --- | ---: | ---: |
| Standard | 2 | 8 |
| Thorough | 3 | 12 |
| Extended | 4 | 18 |

The runtime keeps a maximum of two analysis tasks active at once. Preview and write tasks remain
sequential.

## Configuration Boundary

`server/modules/platformSettings/configuration.js` is the allowlist for the API and UI. A setting
must be in this registry before the API can read or write it.

Do not add these values to the registry:

- API keys, passwords, tokens, or connection credentials.
- Encryption or signing values.
- Internal model names.
- Per-stage token limits, worker limits, or scoring thresholds.
- Internal schema or contract versions.

Environment variables define deployment defaults. `PlatformSetting` records contain explicit
database overrides. A reset deletes an override. It does not write an environment value.

The runtime ignores retired database values. This behavior permits the product settings list to
become smaller without a cleanup migration.

## Safety Rules

- Team and project permissions always control available AI tools.
- Project viewers only receive reporting tools.
- A metric watch change requires an exact preview and explicit confirmation.
- A report schedule change requires an exact preview and explicit confirmation.
- The settings API never grants a role or bypasses a confirmation.
- The request budget is a ceiling. It is not a usage target.

## Runtime Updates

- The saving process reloads values at once.
- Each server process reloads values every 30 seconds.
- Invalid or retired database values are ignored. The deployment value stays active.
- Model and provider credentials remain deployment-only.

## Adding A Setting

1. Add the environment-backed value to the applicable intelligence policy.
2. Add a registry entry with a type and strict bounds.
3. Confirm that the setting represents a platform-admin decision.
4. Add unit and integration tests.
5. Do not expose a separate control for an internal value that can use a tested default or preset.
