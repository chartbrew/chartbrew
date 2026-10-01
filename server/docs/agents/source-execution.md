# Source execution records

`SourceExecution` is the durable record of a logical source fetch. `UpdateRun` and `UpdateRunEvent` remain diagnostic history. Their retention and write failures do not determine the source count.

## Counting rule

Count a row only when `status` is `success` and `cacheHit` is `false`. One complete fetch, including its required pages, is one row. Empty results count. Each repeated fetch gets a new UUID. Separate queries in a compiled result get separate rows. A later failed query does not remove earlier successful queries.

Cache hits, connection tests, schema discovery, resource pickers, and work on saved results do not create rows. Failed or pending rows do not count. HTTP errors, invalid required response bodies, and failures on later pages must reject the logical fetch. An outer request timeout does not prove that the source stopped: a continuing fetch can still complete and record success.

The shared helper is `server/modules/sourceExecution.js`. It stores a pending row before source I/O. It then runs the optional policy callback, calls the source once, and stores the outcome before cache writes and downstream processing. Transient record writes have at most three attempts. A lost insert reply is checked using the same UUID. Outcome writes can only change a pending row. Database retries never repeat source I/O.

If the initial record cannot be stored, the fetch does not start. If an outcome cannot be confirmed, the caller keeps the known source result and the helper logs a safe error. The record can remain pending. Do not infer success from its age, a parent run, or a later chart result.

## Source boundaries

| Source | Counted operation | Excluded operation |
| --- | --- | --- |
| MySQL, PostgreSQL | Shared SQL saved query, direct query, read-only exploration query | Connection test, schema inspection |
| MongoDB | `executeMongoQuery`, used by saved requests and previews | Connection test, collection/schema discovery |
| ClickHouse | Connector query, before disconnect and cache write | Database schema and connection checks |
| API and legacy API templates | Full request or complete pagination in `api.protocol` | Connection test and header metadata |
| Customer.io | Customers plus requested attributes, activity pages, campaign metrics | Segment, campaign, action, link, object-type pickers |
| Google Analytics | `runReport`, before formatting | Account and property metadata |
| Firestore | Configured collection fetch and required subcollections | Collection metadata; optional metadata after a fetch does not change its outcome |
| Realtime Database | One `once("value")` read | Connection test |
| Jira | Complete issue search or resource query; created/resolved trend searches count separately | Project, board, field and other resource pickers; a configured resource query still counts |
| Stripe Official | Each complete list/search query, including each query used by a compiled metric | Account and builder metadata |
| MCP source | Approved `callTool` result, before output selection | Connection initialization, catalog discovery, approval and schema validation |

Keep the boundary inside the source implementation. Do not add accounting to HTTP clients, individual pages, cache readers, or chart transforms. Source-specific errors such as MCP `isError` must fail before a success is stored. A generic API response may contain a normal business field named `error`; do not infer a failure from that field in a valid 2xx response.

## Call paths and attribution

The helper resolves `sourceId` through the source registry. It takes the team and connection IDs from the saved connection. The dispatcher supplies the dataset's team, and the helper rejects a mismatched team before source I/O. Use verified IDs. Unsaved previews have no saved request or dataset ID.

`withSourceExecutionContext` uses Node async context. It carries activity and available entity references across nested calls without changing the source response. Parallel requests remain separate. An outer activity takes priority: MCP calling Data API remains `mcp`; AI calling a dataset remains `ai`. Independent cache preparation explicitly selects `background`.

| Call path | Activity |
| --- | --- |
| Chart/dashboard manual refresh and chart creation | `manual` |
| Data request, dataset, connection-action and chart-version previews | `preview` |
| Chart/dashboard scheduled updates | `schedule` from the update trace |
| Data API | `api` |
| AI tool dispatch, direct query and existing-dataset tools | `ai` |
| Inbound MCP tools, including nested AI/Data API calls | `mcp` |
| Monitor refresh and observation driver analysis | `alert` |
| Runtime cache preparation, dashboard variants, live prepared-snapshot backfill | `background` |

Reports, alerts and observations that use saved chart results do not fetch a source and do not count. Local prepared-snapshot inference and schema-only jobs also do not count. A live backfill fetch counts even when its snapshot write is disabled. The activity `report` is available for report code that explicitly starts a fresh query.

## Internal callbacks and queries

`beforeSourceExecution(record)` and `afterSourceExecution(record)` are exported no-op functions. Assign an implementation during process setup when one is required. Install it in each API or worker process that executes sources. No new environment variable is needed.

The before callback is awaited after the cache miss and durable pending insert. It can throw to refuse execution. The after callback receives a confirmed terminal row, including failed or refused work. Its failure is logged and does not change the source result. These callbacks receive only compact record fields, never queries, credentials or response data.

The after callback is not a delivery queue. It can be missed if the process stops. A consumer must use the UUID for idempotency and read durable records to recover missed callbacks. Do not use callbacks alone as evidence. There is no automatic repair of unknown outcomes.

`countSuccessfulExecutions({ teamId, from, to })` requires a positive team ID and a valid time range. It counts by UTC `finishedAt`, including `from` and excluding `to`. Pass explicit UTC timestamps. A fetch that crosses a period boundary belongs to its completion period.

## Storage and deletion

The table stores UUID, team/source/connection identity, activity, status, explicit cache state, start/finish times, and nullable project/chart/dataset/request/run IDs. Millisecond precision is retained for start and finish times. There are no request payloads, names, error text, credentials or result samples.

Historical references have no foreign keys. Deleting a chart, dataset, request, connection or diagnostic run does not delete evidence. Deleting a full team removes its records in the existing deletion transaction. User deletion removes records for teams the user owns; it preserves records for teams where the user is only a member.

Records expire after 13 calendar months in UTC. Both start and finish must be old for a terminal row to expire; old pending rows use start time. Pending records are evidence of uncertainty only. The existing startup/daily retention job runs the bounded cleanup. Diagnostic cleanup retains running/queued runs, uses 90 days for failed/partial-failure runs and 30 days for other known terminal states by default.

## Setup and checks

From the repository root:

```sh
npm --prefix server run db:migrate
npm --prefix server run retention:run -- --category=source-executions --dry-run
npm --prefix server run retention:run -- --category=source-executions --report-pending
```

The pending report is read-only. It shows total count, oldest start time and up to 100 UUID/start-time pairs. `--limit=50` changes the list size, capped at 1,000. Normal cleanup supports the existing `--limit`, batch size and runtime controls. Use `--category=all` to include all existing retention categories.

Apply the migration before starting the new server code. Accounting starts with deployment; diagnostic history is not backfilled. Reverting the application can leave this independent table intact. The migration's `down` operation deletes the records, so use it only when those records are no longer required.

Focused checks:

```sh
npm --prefix server run test:pure -- tests/unit/sourceExecution.test.js tests/unit/sourceExecutionSources.test.js tests/unit/googleAnalyticsConnection.test.js
CB_TEST_DB_REUSE=0 npm --prefix server run test:database -- tests/integration/sourceExecution.test.js tests/unit/updateAudit.test.js tests/integration/updateRunRoute.test.js tests/unit/mcpHttpFixture.test.js
CB_TEST_DB_REUSE=0 CB_DB_DIALECT_DEV=postgres npm --prefix server run test:database -- tests/integration/sourceExecution.test.js
npm --prefix server run lint
```

The database checks use disposable containers. Do not point test cleanup at a working installation.

## Verification at implementation

- Full pure suite: 1,207 passed; five chart-creation assertions failed. Those five failures also occur in the unchanged revision.
- MySQL: 32 focused database tests passed, including MCP calls, audit retention, migration rollback and team/user deletion.
- PostgreSQL: the 30 initial focused checks and all five final storage/deletion checks passed.
- Additional chart/Stripe AI database checks found five existing chart-creation failures and an associated unhandled fixture rejection. The unchanged revision reproduces them.
- Server lint passes with existing warnings. The change adds no dependency or configuration variable.

The review removed duplicate response parsing, pass-through promise catches and a redundant monitor method. The remaining wrappers mark an actual source boundary or carry the original activity.
