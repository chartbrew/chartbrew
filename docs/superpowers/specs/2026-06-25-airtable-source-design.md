# Airtable Source Design

Date: 2026-06-25

## Goal

Add Airtable as a first-class Chartbrew source where users work with Airtable concepts and Chartbrew handles Airtable API mechanics.

The product rule is:

```txt
I use Airtable words. Chartbrew handles the API words.
```

Users should not need to see endpoints, bearer headers, encoded formulas, pagination offsets, field rename fragility, or API URL length concerns.

## Context

The current source plugin architecture expects source-specific runtime, UI, templates, and AI behavior to live under the source plugin. Airtable should follow that model instead of using the generic API builder.

Official Airtable docs checked for this design:

- Authentication: bearer tokens only; legacy API keys are no longer supported.
- OAuth: authorization code with PKCE; access tokens last about 60 minutes; refresh tokens rotate on use and expire after 60 days if unused.
- Scopes: `data.records:read`, `schema.bases:read`, and `user.email:read` are enough for v1 read-only datasets, previews, and AI planning.
- List records: table IDs are recommended over names; `view`, `fields`, `filterByFormula`, `sort`, `pageSize`, `maxRecords`, `offset`, and `returnFieldsByFieldId` support the v1 data shape.
- Base schema: `GET /v0/meta/bases/{baseId}/tables` returns tables, fields, primary fields, and views.
- Rate limits: Airtable limits requests to 5 requests per second per base and returns 429 with a required backoff.

The connected Airtable MCP account confirmed account access, but deeper schema requests hit the current Airtable monthly API limit. Implementation should rely on official docs and source-owned mocks/tests rather than the MCP account as a test fixture.

## Chosen Approach

Build a custom Airtable source:

```js
{
  id: "airtable",
  type: "airtable",
  subType: "airtable"
}
```

Rejected alternatives:

- Branded generic API source: too likely to leak API routes, headers, pagination, and generic builder assumptions into the user experience.
- PAT-only vertical slice: faster, but it creates auth and AI migration churn and does not match the desired integration quality.

Use Airtable's official `airtable` npm package for record-listing behavior where it helps. Keep a source-owned wrapper for OAuth, metadata endpoints, token refresh, schema normalization, retries, errors, output normalization, and tests.

## Scope

Included in v1:

- OAuth-first connection flow.
- Personal access token fallback behind an advanced toggle.
- Read-only OAuth scopes: `data.records:read`, `schema.bases:read`, `user.email:read`.
- Automatic OAuth token refresh on demand and daily refresh maintenance for inactive connections.
- Base, table, view, and field picker.
- Airtable URL paste to extract base, table, and view IDs.
- Visual filter builder.
- Advanced Airtable formula mode for direct `filterByFormula` editing.
- Capped live previews.
- Dataset creation from a selected table or view.
- Constrained "Create dashboard from this view" flow with heuristic chart suggestions.
- Source-owned AI orchestrator support using configuration planning, not query generation.
- Scheduled Chartbrew refresh through the Airtable protocol.
- Runtime dashboard filter support where the merge is safe.
- Field IDs stored internally and displayed as Airtable field names.

Out of scope for v1:

- Writing records back to Airtable.
- Creating, updating, or deleting Airtable tables, fields, views, or records.
- Airtable webhooks.
- Full linked-record expansion.
- Joining linked tables automatically.
- Syncing attachments or persisting attachment file contents.
- Workspace collaborator metadata beyond what the selected scopes provide.
- Accounting for every advanced Airtable formula edge case before preview validation.

## Architecture

Backend layout:

```txt
server/sources/plugins/airtable/
  airtable.plugin.js
  airtable.protocol.js
  airtable.connection.js
  airtable.client.js
  airtable.resources.js
  ai/airtable.ai.js
  templates/
```

Frontend layout:

```txt
client/src/sources/airtable/
  airtable.source.js
  airtable-connection-form.jsx
  airtable-builder.jsx
  airtable-template-setup.jsx
  components/
  assets/
```

The source plugin owns:

- Connection testing.
- OAuth and PAT token resolution.
- Airtable metadata loading.
- Schema normalization.
- Record fetching.
- Formula generation and validation.
- Pagination and rate-limit handling.
- Field ID/name mapping.
- Output normalization.
- Source actions.
- Built-in dashboard/chart recommendations.
- Source-owned AI behavior.

Shared controllers should only resolve the Airtable source through the registry and call plugin hooks or plugin source actions. Do not add Airtable-specific branches to shared connection, dataset, chart, or AI controllers.

Plugin capabilities:

```js
{
  connection: {
    supportsTest: true,
    supportsOAuth: true,
    supportsFiles: false,
    authModes: ["oauth", "personal_access_token"],
  },
  data: {
    supportsQuery: false,
    supportsSchema: true,
    supportsResourcePicker: true,
    supportsPagination: true,
    supportsVariables: true,
    supportsJoins: true,
  },
  templates: {
    datasets: true,
    charts: true,
    dashboards: true,
  },
  ai: {
    canGenerateDatasets: true,
    canGenerateQueries: false,
    hasSourceInstructions: true,
    hasTools: true,
  },
}
```

Source actions:

- `listBases`
- `getBaseSchema`
- `previewRecords`
- `validateFormula`
- `parseAirtableUrl`
- `recommendDashboardCards`

## Connection And Auth

The connection form defaults to OAuth:

```txt
Connect Airtable
```

The PAT path is available behind an advanced toggle:

```txt
Use a personal access token
```

OAuth read-only scopes:

```txt
data.records:read
schema.bases:read
user.email:read
```

OAuth flow:

1. User clicks "Connect Airtable".
2. Chartbrew creates or updates a pending Airtable connection through the normal connection model.
3. Source-specific OAuth start route stores the PKCE verifier and nonce in encrypted connection authentication state.
4. The start route returns the Airtable authorization URL.
5. Airtable redirects to a source-specific callback route.
6. Callback verifies state and nonce, exchanges the code server-side, stores OAuth data, updates the connection, clears pending auth state, and redirects back to the Chartbrew connection screen.

Route shape:

```txt
POST /team/:team_id/sources/airtable/oauth/start
GET  /sources/airtable/oauth/callback
```

The callback route is unauthenticated but must verify signed state, team ID, user ID, connection ID, nonce, and PKCE verifier before exchanging the code.

Persistence:

- OAuth refresh token lives in existing encrypted `OAuth.refreshToken` with `type: "airtable"`.
- OAuth account label uses `OAuth.email` when `user.email:read` returns an email.
- Short-lived Airtable access token, `accessTokenExpiresAt`, `refreshTokenUpdatedAt`, and `lastRefreshError` live in encrypted `Connection.authentication.airtableOAuth`.
- PAT fallback stores the token in encrypted `Connection.authentication.airtablePat`.
- `Connection.schema` and `Connection.options` store safe metadata only: Airtable user id/email, granted OAuth scopes when returned, accessible base summaries, and metadata refresh timestamps.

Token refresh:

- Refresh on demand before Airtable API calls when the access token is missing or near expiry.
- Refresh tokens rotate on every refresh, so the refresh operation must update `OAuth.refreshToken` and encrypted access token state in one transaction.
- A daily maintenance job refreshes Airtable OAuth connections whose `refreshTokenUpdatedAt` is older than 45 days.
- Maintenance refreshes must use jitter and low concurrency.
- Failed refreshes store `lastRefreshError` and cause connection tests, previews, and dashboard refreshes to return a clear reconnect message.

Connection tests:

- OAuth and PAT tests call Airtable `whoami` and `list bases`.
- Test responses should distinguish invalid token, missing scope, no accessible bases, and Airtable rate/billing limit errors.

## Builder UX

The manual builder uses Airtable concepts:

```txt
Base -> Table -> View -> Fields
```

After base/table/view selection, show an instant preview:

- First 20 records.
- Detected fields.
- Field types.
- Sample values.
- Warnings for capped or partial previews.
- Calls to action: "Create dataset only" and "Create dashboard from this view".

The builder has two modes.

Visual mode:

- Base.
- Table.
- View.
- Fields.
- Sort.
- Max records.
- Date field.
- Field filters.
- Dashboard filter compatibility hints.

Formula mode:

- Base.
- Table.
- View.
- Fields.
- Sort.
- Max records.
- Editable `filterByFormula`.
- Preview validation before save.

Visual mode stores structured filters. Formula mode stores the user formula. Switching from visual mode to formula mode can generate an editable formula from the current visual filters. Switching from formula mode back to visual mode keeps the formula in configuration but disables it until the user returns to formula mode; Chartbrew should not attempt lossy formula parsing in v1.

The UI should never show:

- API endpoints.
- Authorization headers.
- Encoded query strings.
- `offset`.
- Raw Airtable URL length handling.

## DataRequest Configuration

Airtable DataRequests store source-owned configuration, not generic API routes:

```json
{
  "source": "airtable",
  "mode": "visual",
  "baseId": "app...",
  "baseName": "Client Operations",
  "tableId": "tbl...",
  "tableName": "Tasks",
  "viewId": "viw...",
  "viewName": "Active tasks",
  "fieldIds": ["fldStatus", "fldOwner", "fldDue"],
  "fields": [
    { "id": "fldStatus", "name": "Status", "type": "singleSelect" },
    { "id": "fldOwner", "name": "Owner", "type": "multipleCollaborators" },
    { "id": "fldDue", "name": "Due date", "type": "date" }
  ],
  "filters": [
    { "fieldId": "fldStatus", "operator": "is", "value": "Active" }
  ],
  "formula": "",
  "sort": [
    { "fieldId": "fldDue", "direction": "asc" }
  ],
  "dateFieldId": "fldDue",
  "pagination": {
    "pageSize": 100,
    "maxRecords": 5000
  }
}
```

Rules:

- Store Airtable IDs for execution.
- Store names for display and human-readable diffs.
- Fetch records with `returnFieldsByFieldId: true` so Airtable field renames do not break saved datasets.
- Validate that saved field IDs still exist during preview/runtime. If a field was deleted, return a clear configuration error naming the deleted field where possible.
- Variables can appear in visual filter values and in formula mode.

## Runtime Behavior

The Airtable protocol validates configuration before execution, applies variables, resolves tokens, fetches records, normalizes rows, and returns Chartbrew-ready output.

Record listing:

- Use the official `airtable` npm package for normal record reads when it supports the required options.
- Use the source-owned client for metadata endpoints, token refresh, POST `/listRecords`, and cases where the SDK does not expose required behavior cleanly.
- Use Airtable's POST `/v0/{baseId}/{tableIdOrName}/listRecords` endpoint when formula or field-list query strings risk the 16,000-character URL limit.
- Paginate automatically until there is no offset or `maxRecords` is reached.
- Return warnings when records are capped by `maxRecords`.

Rate limits and retries:

- Respect Airtable's 5 requests per second per base limit.
- Retry 429 and safe transient 5xx responses with bounded backoff.
- Do not retry formula/configuration validation errors.
- Include source-level warnings when previews or refreshes are partial.

Dashboard filters:

- Visual mode can merge dashboard filters into Airtable structured filters.
- Formula mode can append safe generated filters with `AND(...)` when all runtime filters map cleanly to Airtable fields.
- Formula mode should return a warning when a dashboard filter cannot be merged without changing formula meaning.

## Output Normalization

Every row includes:

```js
{
  recordId: "rec...",
  createdTime: "2026-06-01T12:00:00.000Z",
  Status: "Active",
  Owner: "Raz",
  DueDate: "2026-06-28"
}
```

The response should also preserve compact field metadata for builders, previews, and AI:

```js
{
  fields: [
    { id: "fldStatus", name: "Status", outputKey: "Status", type: "singleSelect" }
  ]
}
```

Normalization rules:

- Single select: label string.
- Multiple select: label array and display string where useful.
- Collaborator: display name or email.
- Multiple collaborators: display names/emails as an array.
- Linked records: record IDs or labels when Airtable provides labels; no deep expansion in v1.
- Lookup and rollup: preserve simple scalar values; flatten simple arrays.
- Attachments: attachment count, first filename, first URL for table outputs.
- Formula fields: treat Airtable-computed values as normal read values.
- Dates: ISO-compatible values and a date-compatible output field for chart bindings.
- Unknown field types: preserve safe display strings and compact metadata without throwing.

## Dashboard From View

After preview, users can create a dataset only or create a dashboard from the selected Airtable view.

The v1 dashboard flow suggests a small set of cards from table/view/field heuristics:

- KPI count of records.
- Category breakdown for select, collaborator, checkbox, or linked-record fields.
- Time trend when a date field exists.
- Numeric aggregate when a number, currency, percent, duration, rating, rollup, or formula numeric field exists.
- Latest records table.

Suggested chart patterns:

- Tasks/projects: open tasks KPI, tasks by status, tasks by owner, overdue tasks table.
- CRM/deals: pipeline value KPI, deals by stage, won deals over time, latest deals.
- Orders: revenue KPI, orders over time, revenue by product, latest orders.
- Tickets: open tickets, tickets by priority, tickets by assignee, created versus resolved.
- Content calendar: content by status, posts by channel, upcoming content table.

Users select which cards to create. Creating one selected chart should create only that chart's required dataset(s), following the source plugin template contract.

## AI Orchestrator

Airtable uses source-owned configuration mode:

```js
{
  canGenerateDatasets: true,
  canGenerateQueries: false,
  hasSourceInstructions: true,
  hasTools: true
}
```

The AI should plan Airtable `DataRequest.configuration` objects and chart specs. It must not generate generic API routes or free-form queries.

AI capabilities:

- List bases.
- Get compact base/table/view/field schema.
- Sample capped records.
- Validate Airtable configuration.
- Preview Airtable configuration.
- Plan datasets from user questions.
- Recommend dashboard cards for a selected table or view.
- Recommend templates where registered source templates match the selected schema.

AI safety rules:

- Never return tokens, headers, endpoints, offsets, raw OAuth payloads, or full unbounded schemas.
- Keep schema and sample outputs compact and capped.
- Use field IDs internally and field names for user-facing explanations.
- Use advanced formulas only as validated configuration.
- Preview before persisting AI-generated formula mode configurations.
- Ask for disambiguation when multiple bases/tables/views match a saved-dashboard request.
- Low-risk previews can use the best match and state what was selected.
- AI-created charts must include safe ChartDatasetConfig bindings and `dateField` when dashboard filters are expected.

Expected AI flow:

```txt
list_connections
source.getCapabilities
source.listResources / Airtable schema
source.planDataset
source.previewConfiguration
create_temporary_chart or create_chart
```

## Security And Permissions

- All source actions must verify team, user, and connection access through existing route permissions.
- OAuth callback must verify signed state and pending connection auth state before token exchange.
- PAT and access tokens must only be stored in encrypted fields.
- Connection responses must not expose PATs, OAuth refresh tokens, access tokens, or PKCE verifier state.
- Source actions must reject unsupported action names.
- Existing project-scoped connection access rules apply to Airtable source actions.
- Airtable server disabling through `CB_DISABLED_SERVER_SOURCES` must prevent tests, previews, metadata, source actions, runtime execution, maintenance refreshes, and AI tools.
- Airtable UI disabling through `VITE_DISABLED_UI_SOURCES` must hide new connection creation but still allow existing connection editing and dataset refresh.

## Testing

Backend tests:

- Source registry resolves Airtable by id and persisted connection shape.
- Plugin validation accepts expected Airtable capabilities.
- Connection route/security tests cover source actions, unsupported actions, team scoping, and project-scoped users.
- OAuth unit tests cover PKCE state, callback validation, refresh token rotation, stale refresh maintenance, and reconnect errors.
- Protocol unit tests cover configuration validation, visual filter formula generation, formula mode, variable substitution, pagination caps, POST listRecords fallback, rate-limit retry behavior, field normalization, deleted field errors, and dashboard filter merging.
- AI harness tests cover capabilities, compact schema outputs, sample caps, planning, validation errors, formula mode preview, dashboard-from-view recommendations, no `generateQuery`, and no secrets in tool outputs.

Frontend tests:

- URL parsing for Airtable table/view URLs.
- Configuration merge and hydration.
- Visual-to-formula mode switching.
- Formula mode preservation when switching back to visual mode.
- Preview column generation.
- Field type display helpers.
- Dashboard card recommendation utility behavior.

Verification commands for implementation:

```sh
cd server && npm run test:run -- tests/unit/sourceRegistry.test.js tests/integration/connectionRoute.security.test.js
cd server && npm run test:run -- tests/unit/sourceAiHarness.test.js
cd server && npm run lint
cd client && npm run lint
cd client && npm run build
```

Add Airtable-specific focused tests next to the protocol, AI, and frontend builder utilities during implementation.

## Acceptance Criteria

- A user can connect Airtable with OAuth and see which Airtable account is connected.
- A user can connect Airtable with a personal access token from the advanced path.
- A user can paste an Airtable URL and have Chartbrew resolve the base/table/view.
- A user can pick base, table, view, and fields without seeing API request details.
- A user can preview Airtable rows and create a reusable dataset.
- A user can edit `filterByFormula` in formula mode and validate it through preview.
- A user can create a small dashboard from an Airtable view using selected suggested cards.
- Runtime refreshes use the Airtable protocol, apply variables, paginate automatically, and respect max record caps.
- AI can plan and preview Airtable datasets/charts without generating raw API requests.
- Existing source plugin registry, availability, template, and access-control patterns remain intact.
