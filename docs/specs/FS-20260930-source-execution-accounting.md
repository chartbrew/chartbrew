# Source Execution Accounting

Status: implemented — source records, callbacks, coverage and retention are in place.
Date: 2026-09-30
Updated: 2026-10-01
Scope: Chartbrew OS v6 source execution records and neutral execution callbacks.

## 1. Purpose and handoff

Record all successful fresh data fetches from connected sources. Keep compact evidence after diagnostic cleanup. Provide internal callbacks before source execution and after a durable outcome, with a consistent record from which to calculate usage.

This document is the implementation handoff. Read `AGENTS.md`, `server/AGENTS.md`, and `source-plugin-guide.md` before making changes. Follow existing JavaScript, migration, source-plugin, and test patterns. Use double quotes. Add no dependencies, feature flags, or new environment variables for this work.

The user requested a comprehensive spec. This document therefore exceeds the short-spec guideline in `docs/specs/README.md`.

### Neutral implementation language

Do not name or describe a separate commercial edition or its implementation anywhere in this change. This applies to file names, identifiers, comments, JSDoc, schema metadata, logs, errors, CLI text, tests, fixtures, and repository documentation. Describe only source execution, policy checks, outcomes, usage records, and retention. Do not add notes such as "for billing", "reserved for the paid edition", or future commercial integration TODOs. Callback names must remain `beforeSourceExecution` and `afterSourceExecution`; the implementation must not assume what an external consumer does with them.

Before completion, inspect all added and changed text, including tests and documentation, for edition-specific names and commercial implementation details. Use a text search and review its matches. This is a review check, not a new runtime check or a test that searches source text. Preserve legitimate external-source names and existing unrelated product links.

## 2. Agreed scope

One unit is one complete, successful, uncached query or logical fetch from a connected source. Only an explicit `cacheHit: false` source outcome can count. Do not infer a fresh fetch from a missing cache value or a successful HTTP response from Chartbrew.

| Operation or outcome | Units |
| --- | ---: |
| Create, copy, or edit an entity without a source fetch | 0 |
| Read, filter, render, or export saved or cached data | 0 |
| Connection test, schema discovery, or resource metadata discovery | 0 |
| Successful fresh query, including empty or unchanged results | 1 |
| Successful data-request test or preview | 1 |
| Successful fresh AI exploration or MCP query | 1 |
| Successful automatic refresh, including background refresh and cache preparation | 1 per logical fetch |
| Three separate fresh queries for a dataset | 3 if all succeed |
| One logical fetch with several pages | 1 after all required pages succeed |
| Source failure, incomplete pagination, or unknown completion | 0 |
| Two failed attempts followed by one successful execution | 1 |
| Successful fetch followed by a cache-write, transform, join, or render failure | 1 |
| Two separate successful executions of the same query | 2 |

Apply the same rule to manual work, schedules, reports, alerts, AI, API, MCP, and internal background work. Keep `AiUsage` separate.

Metadata discovery means the work needed to describe a connection, schema, or resource. A sample fetched only as part of schema discovery remains excluded. A sample or record search requested for analysis or a preview counts. Assign this purpose in trusted server code; never accept a client field that disables accounting.

### Explicit exclusions

- Prices, plans, allowance balances, billing periods, payments, top-ups, warnings, and usage projections.
- AI credit changes and entity-limit changes.
- Shared-fetch optimisation, request coalescing, cache-key redesign, or changes to schedule frequency.
- A customer usage page, new public usage API, or new operator UI.
- Daily summary tables, an event bus, a separate accounting service, or a new queue.
- Reconstruction of historical usage from incomplete `UpdateRunEvent` records.

Existing repeated scheduled fetches continue and each successful call counts. Pagination and source-internal retries remain parts of their existing logical fetch; they do not become additional units.

## 3. Repository baseline

These are navigation points, not a complete caller list. Confirm the current code before editing.

| File or area | Current behaviour and required change |
| --- | --- |
| `server/modules/updateAudit.js` | Diagnostic writes are best effort. Internal log helpers currently return objects. Keep diagnostic errors separate from durable accounting failures. |
| `server/models/models/updaterun.js`, `updaterunevent.js` | Run trees and JSON event payloads describe work. They are not the usage source of truth. |
| `server/modules/updateAuditRetention.js`, `server/scripts/runRetention.js` | Cleanup runs at startup and daily. Defaults are 30 days for non-failed runs, 90 days for failed runs, batches of 1,000, and a 300-second runtime limit. Extend this path. |
| `server/sources/runSourceDataRequest.js` | Dispatches saved data requests, but source cache resolution occurs deeper. This entry point alone is not the counting boundary. |
| `server/sources/shared/connectorRuntime.js` | Shared cache and diagnostic completion helpers. Reuse these where useful; accounting must work without an audit context. |
| `server/sources/shared/sql/sql.protocol.js` | Has separate saved-request, query, schema, and exploration paths. Success is currently recorded after the cache write. |
| `server/sources/shared/protocols/api.protocol.js`, `server/modules/paginateRequests.js` | Preview and saved execution are separate. Generic pagination can accept a non-success HTTP response as empty or partial success. |
| `server/controllers/DataRequestController.js` | Direct execution has no source audit context. |
| `server/controllers/DatasetController.js` | Child request events depend on a supplied trace. There are two source-execution branches. Cover both. |
| `server/controllers/ChartController.js` | Chart updates do not create a trace when none is supplied. Do not make source accounting depend on chart tracing. |
| `server/controllers/DataApiController.js` | Normal requests have traces; background refreshes can explicitly omit them. |
| `server/modules/mcp/execute.js` | A tool audit exists, but exploration can call source methods directly. Preserve MCP attribution through Data API calls. |
| `server/modules/ai/orchestrator/tools/` | `runQuery`, `runExistingDataset`, `sourceTools`, and source-owned planners can execute or preview data through different paths. |
| `server/crons/workers/updateDashboard.js` | Charts run separately. Background variant updates use no trace. Preserve this fetch behaviour. |
| `server/controllers/ChartVersionController.js`, `server/modules/chartCreation.js` | Version previews and chart creation can fetch data without the usual chart trace. |

Existing indexes support diagnostic lookups. The run list in `UpdateRunController` is not paginated. Do not use that list to calculate monthly usage or extend its scope in this task.

## 4. Execution boundary

Use one small shared accounting helper, provisionally `server/modules/sourceExecution.js`, and source-owned calls to it. Do not build a second source dispatcher or an accounting class hierarchy.

The logical order is:

1. Resolve the authorized team, connection, source, and initiating activity.
2. Validate the request and resolve applicable caches through existing code.
3. Return a cache hit without starting a fresh execution or calling the execution policy check.
4. For a fresh data operation, generate an execution ID and persist a `pending` record.
5. Await the optional execution policy check. Do not contact the source if it rejects or fails.
6. Execute the logical query or fetch, including its pages and existing internal retries.
7. Validate source success and the complete required response. Persist the terminal outcome.
8. Perform cache writes, transformations, joins, chart work, and diagnostic completion as before.

The helper owns steps 4–7. Prefer an execution callback that returns the existing source result. Keep existing public result shapes. The source protocol still owns cache lookup, query preparation, response validation, and pagination.

Accounting must not rely on `traceContext`, `UpdateRunEvent`, saved Dataset/DataRequest rows, or the final success of a parent chart, dashboard, tool, or HTTP request. Several successful child queries remain countable if another query or the parent operation fails.

### One owner per logical fetch

Place accounting at the source function that owns the complete logical fetch. When a preview delegates to an already-accounted runner, the caller must not add another record. Pages and low-level HTTP/SQL calls inside that fetch must not create independent records.

Conversely, do not wrap an entire planner, AI task, report, or dataset as one fetch: it can perform several independent queries. Record those queries separately. Shared SQL/API protocols should cover their source variants. Source-specific protocols must call the same helper.

Search all callers of methods being changed. In particular, inspect `runDataRequest`, `runChartQuery`, `exploreReadOnly`, `previewDataRequest`, AI `previewConfiguration`, `getSampleData`, `searchRecords`, and source actions. A source action that only loads metadata is excluded; an action that fetches analytical records counts.

### Success and limits

- HTTP transport success is necessary where applicable, but it is not sufficient. Validate source-specific error envelopes, query errors, and response parsing.
- A configured row/item limit defines the requested fetch. Reaching that limit normally can be success. An unexpected page failure or a protective abort is not success.
- Successful empty results count. A valid empty-body response can count where the source contract permits it. Do not introduce a universal JSON-body requirement.
- For retries inside one logical fetch, persist only its final outcome. A new top-level source execution gets a new ID, even when it uses the same query or queue job.
- If the caller times out but the source later demonstrably completes the full fetch, record that known source outcome once. A confirmed cancellation or incomplete response does not count. Do not mark a still-running source call failed merely because `Promise.race` returned first.
- Preserve existing source safety, authorization, read-only rules, deadlines, and size limits. Do not expand this task into a new general limit system.

## 5. Compact durable records

Add one model and one new reversible migration for `SourceExecution`. Do not alter historical migrations.

| Field | Requirement |
| --- | --- |
| `id` | UUID primary key, generated once before source I/O. Use the installed UUID utility or Node standard library. |
| `teamId` | Required integer from authorized server context. |
| `sourceId` | Required source registry ID, preserved as a value. Distinguish branded API sources. |
| `connectionId` | Required existing connection ID, preserved as a historical reference. |
| `activity` | Required bounded value for the initiating activity; see below. |
| `status` | Required `pending`, `success`, or `failed`. A pending record does not prove source completion. |
| `cacheHit` | Required boolean, always explicitly `false` for this table. Cache hits do not create rows. |
| `startedAt` | Required UTC timestamp. |
| `finishedAt` | Nullable UTC timestamp. Set from the actual terminal source outcome, before persistence retries. |
| `projectId`, `chartId`, `datasetId`, `dataRequestId` | Nullable historical references. Do not require them for temporary work. |
| `runId` | Nullable diagnostic correlation. Its deletion must not affect the execution. |
| `createdAt`, `updatedAt` | Normal Sequelize timestamps. Do not use these as the usage time. |

This table contains compact fresh-execution attempts so a process crash can leave durable evidence of an unknown outcome. Only successful rows count. Do not add prices, units, balances, query text, query hashes, response bodies, headers, credentials, errors, arbitrary JSON, or duplicate entity names. The unit is always one.

Use a small fixed set of activity values: `manual`, `preview`, `schedule`, `report`, `alert`, `ai`, `api`, `mcp`, and `background`. Pass the original activity through nested calls. MCP calling Data API remains `mcp`; AI calling a dataset remains `ai`. Independent cache preparation uses `background`. Do not overwrite activity merely because a request crosses another module.

Require trusted context for fresh data execution. Resolve team ownership from the loaded connection and check it against the authorized caller. Do not silently write `teamId: null`, assign another team, or use a client-supplied activity to bypass counting. Missing or inconsistent context is an internal error before source execution. Connection tests without a saved connection remain excluded.

Use historical ID fields without cascading foreign keys to charts, datasets, connections, or audit rows. Avoid model associations that recreate these constraints during test sync. Usage must survive deletion of those entities. For full team/account deletion, follow the existing `AiUsage` deletion policy in both `TeamController` and `UserController`. Retention by external consumers is outside this implementation.

Initial indexes: the UUID primary key, `(teamId, status, finishedAt)` for usage, and `startedAt` for retention and pending-record inspection. Add no per-source or per-chart indexes without a measured query need.

### Read contract

Keep reads in the shared module. Provide a team-scoped successful-count function with explicit UTC `from` and `to` values. Use `[from, to)` against `finishedAt`, with `status = success` and `cacheHit = false`. This handles adjacent time periods without overlap. The caller supplies the period.

Consumers can group these compact records by source, activity, and entity IDs. They must not count diagnostic events or parent runs. A separate export service, aggregation table, or public endpoint is not required.

## 6. Persistence failures and duplicate writes

Use the database as the record of truth. Never retry a source request merely to repair an accounting write.

| Failure | Required behaviour |
| --- | --- |
| Pending insert fails | Retry only that insert, with the same UUID. If it still fails, stop before source I/O and return a safe temporary error. Cached reads still work. |
| Insert committed but acknowledgement was lost | Read by UUID and verify the same immutable context. Do not create a second execution. |
| Execution policy check rejects or fails | Do not contact the source. Record a failed outcome when possible. Count zero. |
| Source fails | Persist `failed`; preserve the source error for the existing error flow. Count zero. |
| Terminal write fails | Retry only the terminal write. Keep the known result and timestamp in memory during retries. Do not rewrite source success as source failure. |
| Success cannot be persisted after retries | Return the successfully fetched result through the existing flow, log the accounting failure, and leave the durable pending row uncounted. Do not emit a confirmed-usage notification. |
| Process exits during execution or persistence | Pending means unknown. Count zero unless the original execution later supplies reliable completion evidence. |
| Cache, audit, chart, or response delivery fails after persisted source success | Keep the successful execution and its original completion time. |

Use at most three persistence attempts with a short bounded delay. Retry transient database failures only; do not retry validation or schema errors. Keep this local to the helper. No new retry service or queue is needed.

Terminal writes must be safe to repeat and conditional on the current status. Repeating the same outcome is a no-op. A conflicting terminal outcome is an operator error; it must not overwrite an existing success. A fresh execution must always have a new UUID. Query hashes, chart IDs, trace IDs, and queue job IDs are not execution uniqueness keys.

There is no atomic transaction across an external source and Chartbrew's database. Unknown outcomes remain excluded from successful usage counts. Do not claim exact accounting across process failure. Do not infer success from a cached result, a parent run, or a later repeat of the query.

Emit structured, bounded server errors for failed accounting writes and conflicting outcomes. Include execution ID, team ID, source ID, operation, and a safe error code. Exclude queries, response data, credentials, and database error objects that can contain SQL. Make the existing diagnostic error logger produce an actual safe log without adding response payload logging.

Expose unknown records through an operator-only CLI report, reusing the retention command's reporting pattern. Report pending count, oldest age, and a bounded list of execution IDs. A recent pending row can still be active; age alone never proves failure or success. No automatic outcome repair or new operator UI is required.

## 7. Internal execution callbacks

Provide two narrow internal callbacks through the shared helper's dependencies. By default, the first allows execution and the second does nothing. Do not add an adapter registry or a runtime feature switch.

| Callback | Timing and contract |
| --- | --- |
| `beforeSourceExecution(context)` | After the durable pending row and cache miss, before source I/O. Receives the execution ID and trusted attribution. Must be awaited. A rejection prevents the fetch. |
| `afterSourceExecution(record)` | After a terminal outcome is durably confirmed. Receives the execution ID and persisted outcome. Only success contributes to successful usage counts. |

Callbacks must use the execution ID to tolerate repeated delivery. An `afterSourceExecution` error must not repeat the fetch, erase usage, or turn source success into failure. Log it safely. Consumers must reconcile missed callbacks from durable records; these callbacks are not a guaranteed-delivery transport.

External policy state and its recovery belong to the consumer. An unknown outcome or missing confirmed success must not increase successful usage counts. Test both callbacks with simple injected fakes; do not simulate an external policy subsystem.

The callbacks must run at all counted source boundaries. Checking a chart route or an AI tool alone is insufficient. Cached/saved results must remain accessible when the callback refuses a fresh fetch. Let existing error handling preserve prior snapshots; do not label a refused refresh as a successful new update.

## 8. Preserve editor and connection-test behaviour

Displaying an upstream error is separate from accounting success. Inspect both server and client response handling before changing it.

Required paths include `ConnectionRoute` connection tests and `apiTest`, `DataRequestRoute` request execution, `DatasetRoute` execution, `client/src/slices/connection.js`, `client/src/slices/dataset.js`, `client/src/containers/Dataset/DatarequestSettings.jsx`, and source builders such as `client/src/sources/api/api-builder.jsx`.

- Preserve current successful payloads and useful source-error details in the existing error surfaces.
- Classify non-success HTTP statuses before generic pagination accepts a page. Keep sanitized status and error details for the existing caller.
- Inspect every pagination mode, not only custom offset pagination. A later-page failure must not be cached or recorded as a complete success.
- Do not force all test routes to change HTTP status or response shape if an existing editor expects an inspectable envelope. An envelope may be returned for display while the source outcome is failed.
- Do not replace structured source errors with an unexplained numeric code or a generic message in a builder that already supports useful safe details.
- Connection tests and schema discovery remain excluded even if they use shared source utilities. Do not exempt a data-request test because its route contains `test`.
- Do not expose execution IDs, accounting status, internal hooks, or pricing mechanics in normal product UI.

Prefer server-only compatibility changes. If a client change is necessary, read the design rules and required UI skills first. Do not start a UI dev server; use an existing browser session when available.

## 9. Retention and operator checks

Keep successful compact records for 13 calendar months after `finishedAt`. Keep failed compact records for the same period after `finishedAt`, and unresolved pending records for 13 months after `startedAt`. This gives one simple bounded policy for the whole compact table. Pending expiry never creates a successful record or increases usage.

Use UTC calendar-month subtraction with month-end clamping. Thirteen months is not 390 days. Use an already installed date library if it makes the calculation simpler. For example, the cutoff for 2026-09-30 is 2025-08-30. Test month ends and leap years.

Extend the existing startup/daily retention job and `retention:run` command. Reuse their batch size, runtime budget, limit, dry-run behaviour, transaction pattern, and error reporting. Add a `source-executions` category. Keep it included in `all`. Do not create another scheduler. Never cascade deletion from `UpdateRun` to compact records.

Preserve the existing 30/90-day diagnostic defaults. Replace the broad non-failed selection with explicit terminal statuses. Treat `partial_failure` as failed for retention. Do not delete live `queued` or `running` diagnostics. Reuse any existing abandoned-job evidence where available; do not build a job-liveness system or delete active records based only on age.

Implement the pending report as `retention:run -- --category=source-executions --report-pending`. This mode is read-only, does not invoke cleanup, and uses a bounded default of 100 listed records. Include the total pending count and oldest start time. Do not include customer data or full diagnostic payloads.

## 10. Coverage map

Before implementation is complete, record which lowest-level helper owns each path. Confirm ownership from callers and tests, rather than counting method names.

| Entry point | Required coverage |
| --- | --- |
| Dataset and data-request builder | Saved request, unsaved preview on a saved connection, dataset query, variables, and errors. |
| Chart and dashboard | Manual refresh, filters that fetch, version preview, and chart creation that fetches. |
| Schedules | Chart worker, dashboard worker, cache preparation, and retries. Count repeated successful calls separately. |
| Data API | Dataset query, chart query, cache hit, explicit refresh, and background refresh. |
| Inbound MCP | `run_dataset`, chart operations that fetch, source exploration/query/save, and temporary charts. Metadata inspection is excluded. |
| AI and Slack/agent paths | Query execution, existing datasets, temporary charts, source previews, samples, record searches, and nested planner fetches. Preserve original activity. |
| Reports, alerts, observations, monitors | Count only actual fresh queries; work on existing results is free. Inspect `MonitorController`, `observations/driverAnalysis`, and report workers. |
| Maintenance paths | Prepared-snapshot backfill with live refresh, schema-only jobs, and other internal source callers. Classify actual work, not the script name. |
| Source protocols | Shared SQL and API families; MongoDB, ClickHouse, Firestore, RealtimeDB, Google Analytics, Customer.io, Jira, Stripe Official, and outbound MCP. Also cover any registry sources added before implementation. |

The coverage map is complete when every active analytical source execution path reaches the shared accounting helper exactly once per logical fetch, and each excluded metadata/test path has a named reason and a regression check.

## 11. Acceptance tests

Use the current Vitest setup and existing source fixtures. Keep tests focused on accounting invariants and real entry-point differences. Use fake sources; do not call paid APIs or an LLM.

| Area | Required assertions |
| --- | --- |
| Basic counting | Successful fresh fetch = 1; explicit cache hit = 0; missing/unknown cache outcome cannot imply success; zero rows and unchanged data = 1. |
| Multiplicity | Three queries = three successful rows; repeated equal queries = separate rows; a preview delegating to a runner counts once. |
| Pagination | Several pages = 1; first/later HTTP failure = 0; source error envelope = 0; partial data is not cached as complete; configured item limit can succeed. |
| Retry and failure | Two failed attempts then success = 1; replayed terminal write = 1; conflict cannot overwrite success; source success survives cache/transform/render failure. |
| Persistence | Failed start prevents source I/O; lost insert acknowledgement uses the same UUID; completion retry never repeats source I/O; unresolved completion remains uncounted and reportable. |
| Timeout | Known complete source success can be recorded after a caller timeout; confirmed cancellation is not success; callbacks and terminal writes do not count twice. |
| Attribution | Team is required and verified; temporary work needs no saved request; source ID distinguishes API variants; MCP/AI activity survives nested calls; concurrent requests do not exchange context. |
| Entry points | Builder preview, direct DataRequest, Dataset, chart, schedule, Data API, AI, inbound MCP, and background paths. Cover each distinct execution path from section 10. |
| Exclusions | Saved-only render/export/filter, connection tests, schema discovery, and metadata actions create no countable rows and invoke no execution policy check. |
| Execution callbacks | Cache hit skips both callbacks; refusal prevents I/O; success/failure callbacks follow durable outcomes; callback failure preserves the source result; unknown is never confirmed. |
| Editor compatibility | Existing success shape remains; safe source error details remain visible; no rejected source response is counted because an editor displays it. |
| Retention | Diagnostic deletion preserves compact rows; 13-month cutoffs are exact; dry run/report mode writes nothing; batches and limits work; active diagnostic runs are preserved. |
| Deletion and reads | Entity deletion preserves usage; team/account deletion follows policy; `[from, to)` avoids double counting at period boundaries; team queries cannot mix records. |
| Database | Migration up/down and indexes work on supported MySQL/PostgreSQL test targets. SQLite-only tests are not sufficient proof of migration support. |

The earlier investigation ran 68 source-registry and variable-processor tests successfully. Two isolated checks reproduced the generic pagination failures. Audit database tests could not start because a container runtime was unavailable. These results are baseline evidence, not acceptance of the new implementation.

## 12. Implementation sequence

1. Trace the coverage map and editor response contracts. Add focused regression tests for the pagination failure and the agreed counting rules.
2. Add the model, migration, shared execution helper, count read, safe logs, and internal execution callbacks. Test persistence failure and duplicate-write behaviour before source integration.
3. Integrate shared SQL/API execution, then source-specific protocols and direct previews. Keep accounting inside the complete logical fetch and ahead of cache persistence.
4. Pass trusted attribution through all entry points, including AI/MCP direct calls and background work. Remove dependence on optional diagnostic traces for accounting.
5. Extend retention and the read-only pending report. Cover entity deletion, full team deletion, and both user-deletion paths as applicable.
6. Run the acceptance tests and lint. Update `source-plugin-guide.md` so new source data operations must use the helper. Document setup, retention, unknown outcomes, and execution callback semantics in server documentation. Apply the neutral-language review in section 1 to the full implementation diff.

Keep each change reviewable. Do not refactor unrelated controllers, redesign caching, or add speculative interfaces. If duplicate code must change to cover both dataset branches, make the smallest shared change needed for correctness.

## 13. Verification and setup guide

Run focused existing checks from the repository root. Add the new accounting tests to the appropriate pure/database groups and run them too:

```sh
npm --prefix server run test:pure -- tests/unit/sourceRegistry.test.js tests/unit/sourceVariableProcessors.test.js tests/unit/sourceAiHarness.test.js
npm --prefix server run test:database -- tests/unit/updateAudit.test.js tests/integration/updateRunRoute.test.js tests/integration/connectionRoute.security.test.js tests/integration/dataApiRoute.test.js tests/integration/mcpServer.test.js
npm --prefix server run lint
```

Database tests require a working container runtime or an explicitly isolated reusable test database. Never point test cleanup at development or production data. Do not work around unavailable tests by reporting them as passed. If client code changes, run client lint/build and the relevant existing UI checks.

After implementation, apply the migration through the normal deployment process. For a local installation:

```sh
npm --prefix server run db:migrate
npm --prefix server run retention:run -- --category=source-executions --dry-run
npm --prefix server run retention:run -- --category=source-executions --report-pending
```

The last two commands are implemented. No new environment configuration is required. Automatic retention uses the existing server startup path. Accounting begins at deployment. Existing audit history is not backfilled or presented as complete usage.

Before external consumers rely on these records, verify coverage and record-write reliability. Consumers must recover missed callbacks from durable records and keep unknown outcomes out of successful usage counts. External policy implementations are outside this spec.

## 14. Definition of done

- Every current analytical fetch path is accounted for, including paths without diagnostic traces.
- Only durable successful fresh executions count, once each; confirmed source success is independent of downstream failure.
- Connection tests, schema discovery, cached reads, and saved-only work remain free.
- Existing editors retain useful success and error behaviour.
- Compact evidence survives diagnostic and entity cleanup for the specified retention period.
- Unknown outcomes are uncounted, visible to operators, and never repaired by repeating a fetch.
- Tests demonstrate the internal execution callbacks with simple injected fakes.
- All added and changed code, comments, schema metadata, logs, tests, and documentation use neutral execution language. No separate commercial edition is named or described.
- No shared-fetch optimisation, usage UI, new dependency, feature flag, or new environment variable was added.
- The implementation report gives the changed files, checks and limitations, and a short setup guide. Before any commit or push, review the exact staged or outgoing diff with `/ponytail-review`.

## Implementation status — 2026-10-01

Implemented in the server. See [Source execution records](../../server/docs/agents/source-execution.md) for the source and caller coverage map, callback contract, retention commands and setup. The implementation adds one compact table and reuses the existing source protocols, async context and retention scheduler. It adds no dependencies, feature flags or environment variables. No pricing policy is implemented.

The source tests include persistence failures, lost acknowledgements, team checks, parallel activity context, cache hits, pagination failures, empty results, source-specific boundaries, late completion after caller timeout, cleanup and deletion. Database checks cover migration apply/rollback on MySQL and PostgreSQL. Existing chart-creation test failures are checked separately against the unchanged revision.
