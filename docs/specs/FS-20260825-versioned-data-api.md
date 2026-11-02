# Versioned Data API

Status: implemented

Related:

- [ECharts Rendering And Data API](FS-20260819-echarts-rendering-data-api.md)
- [Next-Generation Visualization Engine](FS-20260719-next-generation-visualization-engine.md)

> The Data API exposes Chartbrew data contracts. It does not expose a renderer contract.

## Summary

Add a read-only, versioned Data API for reusable dataset results and prepared chart data. The API
uses the existing dataset execution, runtime filter, variable, timezone, prepared-cache, and
prepared-snapshot paths. It must not create a second data pipeline.

The API has four JSON endpoints:

```text
GET  /api/v1/teams/:team_id/datasets/:dataset_id/data
POST /api/v1/teams/:team_id/datasets/:dataset_id/data
GET  /api/v1/projects/:project_id/charts/:chart_id/data
POST /api/v1/projects/:project_id/charts/:chart_id/data
```

The chart endpoints return the existing public `PreparedData` v1 contract. The dataset endpoints
return a new `DatasetData` v1 contract. Responses contain no Chart.js configuration, ECharts
option, source query, connection data, credential, or internal cache key.

The Data API is a separate feature from ECharts rendering and image sharing. It depends on the
renderer-neutral `PreparedData` boundary that the rendering work created. It does not depend on
ECharts and it does not compile renderer output.

## Goals

- Add stable, versioned dataset and chart data contracts.
- Use bearer API keys that are bound to an `Apikey` database record, team, user, scopes, and
  project access.
- Apply current team roles and project assignments at request time.
- Reuse the same variables, filters, timezone, source cache, prepared cache, and durable prepared
  snapshot paths as Chartbrew charts.
- Return chart rows that are byte-equivalent to the public serialization of the internal
  `PreparedData`, except for documented generation metadata.
- Return dataset results after source execution, joins, and dataset-owned transformations, but
  before chart encoding, aggregation, or presentation.
- Add deterministic serialization, `ETag`, freshness headers, stable error codes, request audit
  records, rate limits, execution limits, and response-size limits.
- Document authentication, request formats, response formats, errors, limits, and caching.
- Publish JavaScript examples for ECharts and Chart.js to show that the API is renderer-neutral.

## Non-Goals

- Public or anonymous data links.
- Authentication with chart shares, dashboard shares, report tokens, or cookies.
- Write, create, update, or delete operations for charts, datasets, or source records.
- A general SQL, source-query, or connection API.
- Pagination, sorting, projection, GraphQL, CSV, Arrow, or streaming responses in v1.
- Renderer options, renderer selection, image generation, or screenshot sharing.
- A new dataset execution engine, filter grammar, variable grammar, or cache service.
- A replacement for all existing Chartbrew API authentication in this phase.
- A change to which user roles can manage API keys.

## Current Repository Baseline

The implementation must use these existing components:

| Component | Current responsibility | Data API use |
| --- | --- | --- |
| `server/visualization/VisualizationEngine.js` | Builds `VizFrame`, prepares data, and compiles renderers | Call `prepare()`, never the compiler |
| `server/visualization/preparedData.js` | Creates, validates, normalizes, fingerprints, and serializes `PreparedData` | Use its public serializer without a second chart serializer |
| `server/controllers/ChartController.js` | Runs datasets, applies runtime context, reads and writes prepared caches and snapshots | Add a prepared-only result mode |
| `server/controllers/DatasetController.js` | Runs DataRequests, joins results, applies dataset transformations, detects fields, and uses source caches | Use as the dataset execution path |
| `server/modules/chartRuntimeFilters.js` | Normalizes variables and filters and builds stable variant hashes | Use for Data API runtime requests |
| `server/modules/runtimeCache.js` | Stores default source results and runtime prepared/source variants | Reuse current keys and fingerprints |
| `server/modules/preparedSnapshot.js` | Loads and persists the default chart snapshot | Use for default chart reads |
| `server/modules/updateAudit.js` | Records bounded request and execution audit data | Add a Data API trigger and API-key identity |
| `server/modules/verifyToken.js` | Accepts user session JWTs | Do not use as the Data API trust boundary |
| `server/models/models/apikey.js` | Stores an encrypted long-lived user JWT and a team ID | Extend with database-bound Data API identity and scope |

Current `Apikey` records do not store the creating user, scopes, project restrictions, or last-use
time. The token contains a user ID, but `verifyToken` does not prove that the token belongs to an
active `Apikey` row or to the team in the route. An old team API key is therefore not sufficient
for the Data API.

## Design Principles

1. Authorization happens before resource execution or snapshot loading.
2. A key is a bearer credential. Possession of the key grants the authority stored on its active
   database record.
3. The database record is the source of truth for scopes and project restrictions. Token claims do
   not grant authority by themselves.
4. The current role and project assignment of the key owner can only reduce key access.
5. A route parameter never grants scope. Team, project, chart, and dataset relationships must be
   checked in database queries.
6. Default chart data comes from `Chart.preparedData` when it is valid. Runtime chart data comes
   from the prepared cache or the canonical preparation path.
7. Data API code stops at preparation. It does not compile or remove renderer output after the
   compiler runs.
8. Public serializers use explicit allowlists. They do not copy model objects into responses.
9. Response freshness is user information. Internal cache names, keys, variants, and fingerprints
   are not user information.
10. A limit failure returns an error. It never returns truncated data.

## API-Key Contract

### Database Changes

Add these nullable or default-safe fields to `Apikey` in a new migration:

| Field | Type | Purpose |
| --- | --- | --- |
| `user_id` | integer, nullable | Binds new keys to the user who created them. Legacy records remain null. |
| `scopes` | long text JSON, non-null, default `[]` | Stores canonical Data API permissions. |
| `project_ids` | long text JSON, nullable | Stores the projects that the key can access when `all_projects` is false. |
| `all_projects` | boolean, non-null, default false | Gives the key access to all projects that its current owner role can access. |
| `last_used_at` | date, nullable | Supports key management and security review. |

Do not edit the original API-key migration. Do not add Data API authority to existing records in a
backfill. Their signed tokens do not contain a database key identity.

New manually created keys use the existing signed token format so that existing authenticated API
routes continue to accept them. Add these signed claims:

```json
{
  "id": 17,
  "apiKeyId": "5e951c4f-0c79-4f70-b8fb-5993ea20bc12",
  "teamId": 4,
  "tokenType": "api_key"
}
```

Generate the API-key UUID before token signing. Store the token with the current encrypted `token`
field. Store scopes and project access only in the database. Do not trust scope or project claims
from the token.

The create response shows the token once. List responses never include the token. Deletion keeps
the current blacklist behavior and removes the database record, which makes Data API revocation
immediate.

### Scopes

The first release defines two scopes:

| Scope | Authority |
| --- | --- |
| `data:read` | Read default data and run cache-aware requests with parse-only field filters. |
| `data:refresh` | Bypass caches or run a request whose variables or date filters require a source refresh. Requires `data:read`. |

All four routes require `data:read`.

The following requests also require `data:refresh`:

- `refresh: true`
- A non-empty `variables` object
- A chart date-range filter
- A filter with `forceSourceRefresh: true`

A normal cache miss on a default `GET` can use the canonical cache-aware source path with
`data:read`. It does not bypass a valid source cache. The `data:refresh` scope controls explicit or
runtime-forced cache bypasses.

Unknown scopes are rejected when a key is created or updated. The server checks stored scopes on
every request. A scope removed from the database stops access without token rotation.

### Key Creation And Management

The current role rules remain:

| Role | Create, list, and revoke API keys | Use data made available by a scoped key |
| --- | --- | --- |
| `teamOwner` | Yes | All team projects, limited by the key project scope |
| `teamAdmin` | Yes | All team projects, limited by the key project scope |
| `projectAdmin` | No | Only projects in the current team-role project list and the key scope |
| `projectEditor` | No | Only projects in the current team-role project list and the key scope |
| `projectViewer` | No | Only projects in the current team-role project list and the key scope |
| No current team role | No | No access; the key is rejected |

The last column describes the effective authority if a key owner is later moved to a more limited
role. It also describes the authority of the bearer credential. A bearer cannot gain more access
than the stored key and current owner permit.

The key creation interface must require an explicit project choice:

- All projects in this team, or
- One or more selected projects.

An API key is always bound to the team where the user creates it. An all-project key does not grant
access to projects in another team.

It must also show two concise permissions:

- Read chart and dataset data
- Refresh data from sources

`data:read` is required. `data:refresh` is optional. The interface must not show token claims,
database fields, contract versions, or implementation terms.

Requests to the existing key-creation endpoint that contain only `name` continue to create a
legacy key with no Data API scopes. This avoids a silent expansion of existing automation access.

The key list response must identify whether each key can use the Data API. Derive this state from
the stored database identity and scopes. Do not decrypt and inspect tokens while listing keys. A
safe list item can contain:

```json
{
  "id": "5e951c4f-0c79-4f70-b8fb-5993ea20bc12",
  "name": "Warehouse export",
  "createdAt": "2026-05-01T08:00:00.000Z",
  "lastUsedAt": null,
  "dataApiAccess": "unavailable",
  "permissions": [],
  "projectAccess": null
}
```

`dataApiAccess` has two v1 values: `ready` and `unavailable`. This is a key-management
contract. It is not returned by the Data API routes.

### Data API Authentication Middleware

Add `server/modules/verifyDataApiKey.js`. It performs these checks in order:

1. Read one `Authorization: Bearer <token>` header. Reject missing, empty, repeated, or malformed
   authorization values.
2. Verify the signature with the current session-token verifier.
3. Require `tokenType: "api_key"`, `apiKeyId`, `teamId`, and a user `id`.
4. Load the `Apikey` record by `apiKeyId` with an explicit attribute allowlist.
5. Compare a SHA-256 digest of the supplied token with a SHA-256 digest of the decrypted stored
   token by using `crypto.timingSafeEqual()`.
6. Require exact matches for token user ID, token team ID, record user ID, and record team ID.
7. Require the requested stored scope.
8. Load the current user and `TeamRole`. Reject deleted users, removed team members, and disabled or
   missing roles.
9. Calculate effective projects from the current role and stored key project scope.
10. Attach a minimal `req.apiKeyAccess` object. Do not attach the token or raw database record.
11. Update `last_used_at` after successful authorization. Throttle this write to at most once per
    key per five minutes so that data reads do not cause one database write each.

`req.apiKeyAccess` contains only:

```json
{
  "apiKeyId": "5e951c4f-0c79-4f70-b8fb-5993ea20bc12",
  "teamId": 4,
  "userId": 17,
  "role": "projectViewer",
  "allProjects": false,
  "projectIds": [8, 12],
  "scopes": ["data:read"]
}
```

Do not call `verifyToken` before or instead of this middleware. Session JWTs, Slack-created legacy
keys, old manually created keys, public share tokens, report tokens, and chart share tokens do not
contain a valid database API-key identity and must return `401`.

### Project Access Calculation

Use `TeamController.getTeamRole()` as the role source. `TeamRole.projects` is the current list for
project-scoped roles.

Calculate access as follows:

```text
owner/admin role projects = all projects in Apikey.team_id
project role projects     = TeamRole.projects

if key.all_projects:
  effective projects = role projects
else:
  effective projects = intersection(role projects, key.project_ids)
```

An empty effective project list denies project, chart, and project-bound dataset access.

For a chart request, query the chart and project with all these conditions:

- `Chart.id = :chart_id`
- `Chart.project_id = :project_id`
- `Project.id = :project_id`
- `Project.team_id = Apikey.team_id`
- `Project.id` is in the effective project list

For a dataset request, require:

- `Dataset.id = :dataset_id`
- `Dataset.team_id = :team_id`
- Route `team_id = Apikey.team_id`
- At least one `Dataset.project_ids` value is in the effective project list

A team owner or team admin with an all-project key can read a team dataset whose `project_ids` is
empty. A project-scoped role or a restricted key cannot read such a dataset.

Return `404 RESOURCE_NOT_FOUND` for a missing resource, a mismatched parent ID, a cross-team ID, or
a resource outside the effective project list. This prevents resource enumeration. Return `403`
only when the key is valid for the resource scope but lacks the required API permission.

## Route Contract

### Common Rules

- The first release supports `application/json` only.
- IDs must be positive base-10 integers. Values such as `1e2`, `1.5`, `-1`, and `01abc` are invalid.
- `GET` does not accept runtime values in query parameters.
- `POST` accepts one JSON object. Unknown top-level fields return `400`.
- A response uses the same data contract for `GET` and `POST` on the same resource type.
- A successful response does not include an outer `data` wrapper.
- `GET` is cache-aware. It does not force a refresh.
- `POST` is used for runtime variables, runtime filters, or an explicit refresh.
- Runtime requests never persist a filtered or variable-specific chart snapshot.
- A default `POST` with `refresh: true` can replace the durable default chart snapshot after a
  successful canonical preparation.

### POST Request Body

```json
{
  "variables": {
    "region": "APAC"
  },
  "filters": [{
    "type": "field",
    "field": "root[].status",
    "operator": "is",
    "value": "paid"
  }],
  "refresh": false,
  "timezone": "Asia/Bangkok"
}
```

All properties are optional. Defaults are:

```json
{
  "variables": {},
  "filters": [],
  "refresh": false
}
```

`timezone` is accepted only by the dataset endpoint. It must be a valid IANA timezone. It defaults
to `UTC`. A chart always uses its project timezone, so a chart request with `timezone` returns
`400 INVALID_REQUEST`.

### Variables

Variables use the current object contract and the current `applySourceVariables()` path.

- Keys must be non-empty strings.
- Values can be JSON scalars or bounded JSON arrays and objects.
- Empty string, `null`, and missing values have the current fallback behavior.
- Runtime values override saved VariableBinding defaults.
- The original DataRequest must not be mutated.
- A variable request requires `data:refresh` because variables can change a source query or API
  request.

Do not return substituted queries, request bodies, headers, routes, or variable values in audit
records or errors.

### Chart Filters

Chart requests use `buildChartRuntimeContext()` without a new filter grammar. They support current
server-meaningful field and date filters, including CDC-scoped filters.

Allowed field operators are:

```text
is
isNot
contains
notContains
greaterThan
greaterOrEqual
lessThan
lessOrEqual
isNull
isNotNull
```

Date-range filters use the current shape:

```json
{
  "type": "date",
  "startDate": "2026-08-01",
  "endDate": "2026-08-31",
  "scope": "chart"
}
```

The server intersects this range with the configured chart date range in the project timezone.
CDC-scoped field filters must contain a valid `cdcId` that belongs to the requested chart. A filter
cannot name a CDC from another chart.

Reject client-only filter types such as pagination, local sorting, display state, and column-toggle
state. The Data API must not silently ignore a supplied filter.

### Dataset Filters

Dataset responses are not chart bindings. They do not have a canonical CDC or chart date field.
The dataset endpoint therefore accepts only chart-wide field filters with an explicit field path.
The field path must start with `root` and identify exactly one array collection.

Use field comparisons for dates:

```json
{
  "type": "field",
  "field": "root[].createdAt",
  "operator": "greaterOrEqual",
  "value": "2026-08-01T00:00:00.000Z"
}
```

Dataset requests reject:

- `type: "date"`
- `scope: "cdc"`
- `cdcId`
- Client-only filter types
- Fields that do not exist in `Dataset.fieldsSchema` when a schema is available

Apply runtime field filters after joins and dataset-owned transformations. Pass source-affecting
filters through the existing connector path where it already supports them. Do not apply legacy
dataset visualization conditions, chart encodings, CDC conditions, chart aggregation, formulas,
goals, sorting, or record presentation limits.

## Chart Response: PreparedData v1

The chart response is the result of `toPublicPreparedData()`. Do not add a Data API-specific chart
serializer.

Example:

```json
{
  "version": 1,
  "frameVersion": 1,
  "identityVersion": 1,
  "generatedAt": "2026-08-25T08:00:00.000Z",
  "resource": {
    "kind": "chart",
    "id": 42
  },
  "results": [{
    "id": "revenue",
    "mark": "line",
    "name": "Revenue",
    "fields": [
      {
        "key": "time",
        "type": "temporal",
        "role": "dimension",
        "sourceField": "root[].createdAt"
      },
      {
        "key": "value",
        "type": "quantitative",
        "role": "measure",
        "sourceField": "root[].revenue"
      }
    ],
    "series": [{
      "id": "series-ec3bc4d7d9f66b02",
      "label": "Pro"
    }],
    "availableSeries": [{
      "id": "series-ec3bc4d7d9f66b02",
      "label": "Pro"
    }],
    "rows": [{
      "time": "2026-08-01T00:00:00.000Z",
      "value": 21400,
      "seriesId": "series-ec3bc4d7d9f66b02"
    }],
    "stats": {},
    "warnings": []
  }],
  "stats": {},
  "warnings": []
}
```

Public serialization rules remain:

- JSON values only.
- Dates use ISO 8601.
- Non-finite numbers become `null`.
- Meaningful `null` values stay `null`.
- Result, field, series, row, object-key, and warning order is deterministic.
- Stable layer and series IDs use the current identity contract.
- `generatedAt` is excluded from the content fingerprint and `ETag`.
- Internal `bindingId`, `__seriesId`, source options, cache values, and renderer data are removed.

The response must not contain these keys at any depth unless they occur as user source column names
inside a dataset response:

```text
chartData
configuration
render
renderer
bindingId
sourceOptions
__seriesId
query
headers
token
password
cacheKey
variantHash
```

## Dataset Response: DatasetData v1

Create `server/modules/datasetData.js` as the contract owner.

Example:

```json
{
  "version": 1,
  "generatedAt": "2026-08-25T08:00:00.000Z",
  "resource": {
    "kind": "dataset",
    "id": 18,
    "name": "Orders"
  },
  "fields": [
    {
      "key": "root[].amount",
      "type": "number"
    },
    {
      "key": "root[].createdAt",
      "type": "date"
    },
    {
      "key": "root[].customer.name",
      "type": "string"
    }
  ],
  "data": [{
    "amount": 120,
    "createdAt": "2026-08-20T04:00:00.000Z",
    "customer": {
      "name": "Ada"
    }
  }]
}
```

`data` preserves the joined dataset shape. It can be an array, object, scalar, or `null`. Do not
force nested or scalar results into a row array.

Build `fields` from the stored `Dataset.fieldsSchema` after a successful default execution. Sort it
by field key. If no stored schema exists, detect fields from the returned result with
`discoverDatasetFieldsSchema()`. Supported field types are:

```text
number
date
string
boolean
array
object
unknown
```

The public DatasetData serializer must:

- Reuse the JSON normalization rules from `preparedData.toJsonValue()`.
- Sort object keys without changing array order.
- Keep `null` values.
- Convert Date objects to ISO 8601 strings.
- Convert non-finite numbers to `null`.
- Remove `undefined`, functions, symbols, and Sequelize metadata.
- Exclude `generatedAt` from the fingerprint.

DatasetData does not include DataRequest IDs, connection IDs, project IDs, joins, transformations,
saved variables, source cache metadata, or dataset compatibility visualization fields.

## Execution Semantics

### Default Chart GET

1. Authorize the key and chart-project relationship.
2. Load the explicit prepared snapshot through `loadPreparedSnapshot()`.
3. Build the current visualization and source fingerprints.
4. If the visualization fingerprint matches, return the snapshot.
5. If only the source fingerprint is stale, return the last-known snapshot and start the existing
   single-flight background refresh.
6. If the visualization fingerprint does not match, prepare current data synchronously. Do not
   compile a renderer.
7. If no valid snapshot exists, run the canonical default preparation with cache-aware source reads.
8. If the source fails and no valid snapshot exists, return `503 DATA_UNAVAILABLE`.

### Runtime Chart POST

1. Validate the body and required scopes.
2. Build the current chart runtime context.
3. Use the current chart version, runtime variant hash, and a dedicated `data-api` viewer scope.
4. Return a fresh or stale prepared-cache payload when allowed.
5. On a miss, run the same datasets, variables, filters, joins, and `VisualizationEngine.prepare()`
   path used by the chart.
6. Write cacheable runtime `PreparedData` through `setPreparedCache()`.
7. Never persist a runtime variant to `Chart.preparedData`.
8. Never call `compilePreparedRender()`, `renderPrepared()`, or a Chart.js or ECharts compiler.

The `ChartController.updateChartData()` pipeline currently returns compiled chart responses and its
`returnPreparedData` option does not cover every runtime-cache short circuit. Add a prepared-only
result mode or extract a shared prepared-data service. All cache-hit, cache-miss, snapshot, refresh,
and error paths must return the same internal result shape:

```json
{
  "preparedData": {},
  "fingerprint": "sha256",
  "generatedAt": "2026-08-25T08:00:00.000Z",
  "stale": false
}
```

This internal result is not the HTTP response.

### Dataset GET And POST

Use `DatasetController.runRequest()` with the authorized `team_id`, effective timezone, variables,
runtime context, and source-cache settings.

- `GET` and `POST refresh:false` use DataRequest and source caches when valid.
- On a default cache miss, the request can execute the source.
- `POST refresh:true` bypasses cache reads and requires `data:refresh`.
- Joins and the main DataRequest transformation run before serialization.
- Runtime field filters run after joins and transformations.
- A runtime response does not update `Dataset.fieldsSchema` or dataset intelligence.
- A successful unfiltered default response can use the current schema-discovery update behavior.
- Dataset execution must be team-scoped in the database call, not only in route middleware.

## HTTP Caching And Freshness

Default `GET` responses support conditional requests.

Response headers:

```text
Content-Type: application/json; charset=utf-8
Cache-Control: private, no-cache
Vary: Authorization
ETag: "pd-v1-<sha256>" or "dd-v1-<sha256>"
Last-Modified: <HTTP date>
X-Chartbrew-Data-Stale: true|false
```

Use `getPreparedDataFingerprint()` for chart responses. Add an equivalent DatasetData fingerprint.
Both fingerprints exclude `generatedAt`. Do not use a renderer, snapshot, Redis, or query
fingerprint as the public `ETag`.

After authorization and resource-scope checks, return `304` with no body when `If-None-Match`
matches the current default response. Authorization must run for every conditional request.

`POST` responses use `Cache-Control: private, no-store`. They do not return `304`. They can return
an `ETag` only as informational content identity when the response is a default variant; v1 does
not require this behavior.

`X-Chartbrew-Data-Stale` is result freshness, not internal cache state. Do not return cache hit,
cache miss, Redis key, cache type, or variant data.

## Limits

Add a small `server/modules/dataApiLimits.js` module. All limits are configurable positive integers
with safe defaults:

| Environment variable | Default | Behavior |
| --- | ---: | --- |
| `CB_DATA_API_RATE_LIMIT_MAX` | 60 | Maximum authenticated requests per API key per minute. |
| `CB_DATA_API_AUTH_RATE_LIMIT_MAX` | 30 | Maximum failed or unknown-key attempts per IP per minute. |
| `CB_DATA_API_MAX_REQUEST_BYTES` | 65536 | Maximum raw POST body size. |
| `CB_DATA_API_MAX_RESPONSE_BYTES` | 5242880 | Maximum serialized JSON response size. |
| `CB_DATA_API_MAX_EXECUTION_MS` | 30000 | Maximum time before the API returns a timeout. |
| `CB_DATA_API_MAX_FILTERS` | 50 | Maximum filters in one request. |
| `CB_DATA_API_MAX_VARIABLES` | 100 | Maximum variable keys in one request. |
| `CB_DATA_API_MAX_VALUE_DEPTH` | 10 | Maximum variable or filter-value nesting depth. |
| `CB_DATA_API_MAX_STRING_BYTES` | 8192 | Maximum bytes in one variable name, field, operator, or string value. |

Apply the failed-auth limiter before expensive database or source work. Apply the per-key limiter
after key identity is known. Its key is `Apikey.id`, not user ID, IP, token text, team ID, or route.
Return standard rate-limit headers and `Retry-After`.

Serialize the full response to a string and measure it with `Buffer.byteLength(..., "utf8")` before
sending. If it is too large, return `413`. Never slice rows or strings to fit.

The execution deadline includes resource loading, cache reads, source execution, joins,
transformation, preparation, serialization, and audit completion needed for the response. Pass an
`AbortSignal` or deadline through the canonical source path where the connector supports it. A
timeout returns `504` even if a connector cannot stop immediately. Existing connector timeouts
remain active and must not be increased by this feature.

## Error Contract

All Data API errors use this shape:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found.",
    "requestId": "7a39da10-819c-4db4-9dcf-f27d48e3a7c0"
  }
}
```

`message` is safe for users. It does not contain a stack trace, SQL, source request, endpoint,
connection name, database name, cache key, file path, or implementation stage.

Required codes:

| HTTP | Code | Use |
| ---: | --- | --- |
| 400 | `INVALID_REQUEST` | Invalid JSON shape, unknown property, invalid ID, timezone, or content type. |
| 400 | `INVALID_VARIABLE` | Invalid variable name, type, value, count, depth, or size. |
| 400 | `INVALID_FILTER` | Invalid field, operator, scope, CDC, date range, count, depth, or size. |
| 401 | `API_KEY_REQUIRED` | No valid bearer value was supplied. |
| 401 | `API_KEY_INVALID` | Signature, key identity, record, token comparison, user, or team membership failed. |
| 403 | `API_KEY_SCOPE_REQUIRED` | The key lacks `data:read` or `data:refresh`. |
| 404 | `RESOURCE_NOT_FOUND` | Resource is absent, cross-team, under a different parent, or outside project scope. |
| 406 | `NOT_ACCEPTABLE` | The client does not accept JSON. |
| 413 | `REQUEST_TOO_LARGE` | The request body exceeds its limit. |
| 413 | `RESPONSE_TOO_LARGE` | The complete response exceeds its limit. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | A POST does not use JSON. |
| 429 | `RATE_LIMITED` | The failed-auth or per-key rate limit was reached. |
| 500 | `INTERNAL_ERROR` | An unexpected server failure occurred. |
| 503 | `DATA_UNAVAILABLE` | No valid default data exists and the source cannot supply it. |
| 504 | `EXECUTION_TIMEOUT` | The request exceeded the execution deadline. |

Connector policy errors can map to a stable Data API code, but their public message must remain
source-neutral unless an action from the caller can fix the problem. Do not pass existing raw
controller error strings through this API.

## Audit And Observability

Extend `UpdateRun` with nullable `apiKeyId` and add an index on `(apiKeyId, startedAt)`. Keep the
identifier after a key is deleted. Do not add a foreign-key cascade that deletes audit history.

Start one root run for each authorized Data API request:

```text
triggerType = data_api
entityType  = chart_data or dataset_data
```

Child dataset and connector runs use the current trace parent. Record only bounded metadata:

- Request ID and trace ID
- API-key ID
- Team, project, chart, and dataset IDs as applicable
- HTTP method and API version
- Refresh requested: true or false
- Variable count and filter count, but not names or values
- Result status and stable error code
- Duration in milliseconds
- Serialized response bytes
- Data stale: true or false

Never record:

- Bearer token or token fragment
- Authorization header
- Variable names or values
- Filter fields or values
- SQL or source query text
- API source URL, headers, or body
- Raw source rows or response rows
- Connection credentials
- Redis keys or cache payloads

Failed authentication attempts do not create normal `UpdateRun` rows because no trusted team or key
identity exists. Emit a bounded security log with request ID, failure class, and server-derived IP
rate-limit key. Do not log the supplied token.

Add counters and timing metrics for request count, authorization failure, status code, resource
type, response bytes, duration, stale response, timeout, and size rejection. Labels must not contain
user input, token data, resource names, filter fields, or variable names.

## Server Structure

Add or change these server areas:

```text
server/api/DataApiRoute.js
server/controllers/DataApiController.js
server/modules/verifyDataApiKey.js
server/modules/dataApiAccess.js
server/modules/dataApiLimits.js
server/modules/dataApiResponse.js
server/modules/datasetData.js
server/models/models/apikey.js
server/models/models/updaterun.js
server/models/migrations/<timestamp>-add-data-api-key-scope.js
server/models/migrations/<timestamp>-add-data-api-audit-key.js
server/controllers/TeamController.js
server/controllers/ChartController.js
server/controllers/DatasetController.js
server/visualization/filterDatasets.js
server/modules/updateAudit.js
server/api/index.js
```

Responsibilities:

- `DataApiRoute` defines only the four versioned routes and middleware order.
- `DataApiController` coordinates authorization results, request validation, chart or dataset
  service calls, headers, serialization, limits, and errors.
- `verifyDataApiKey` proves key identity and stored scopes.
- `dataApiAccess` calculates effective projects and performs scoped resource lookups.
- `dataApiLimits` owns environment parsing and deadline helpers.
- `dataApiResponse` owns stable errors, headers, byte checks, and conditional responses.
- `datasetData` owns DatasetData v1 normalization, validation, serialization, and fingerprinting.
- `ChartController` or an extracted chart-preparation service owns prepared-only execution.
- `DatasetController` remains the owner of source execution, joins, and dataset transformation.

Do not place Data API routes in `ChartRoute.js` or `DatasetRoute.js`. Those files contain legacy
application, public-share, and session-authenticated behavior that must not become part of the
versioned Data API contract.

Any changes to source runtime signatures or connector behavior must follow `source-plugin-guide.md`.
The preferred implementation reuses current source execution and only passes a bounded deadline or
abort context.

## Client Key Management

Update the existing Developer settings API-key view. Do not add a Data API screen to the chart
builder.

The create form contains:

- Key name
- Project access: all accessible projects or selected projects
- Read chart and dataset data, always selected
- Refresh data from sources, optional

The key list can show name, project access summary, permissions, created date, and last-used date.
It never shows the token after creation.

Clearly identify old keys that cannot use the Data API. Use a visible warning state with this user
meaning:

```text
Data API unavailable
This key still works with existing integrations. Create a new key to use the Data API.
```

Do not add a separate replacement action or flow. The normal `Create a new API Key` action opens
the same scoped-key form for all users.

Do not modify, upgrade, rotate, revoke, or delete an old key automatically. The server cannot
change its signed identity, and Chartbrew cannot know where the bearer token is in use. The user
must revoke the old key in a separate explicit action when it is no longer in use.

The warning must not depend on color only. Include visible text and an accessible label. Keep the
current key order unless the user selects another order.

Keep user copy concise. Do not show JWT, scope identifiers, database IDs, token claims, contract
versions, migrations, or cache details.

## Documentation

Every server contract in this feature must be present in the `v6` branch of:

```text
../chartbrew-docs/api-reference/openapi.json
```

The OpenAPI update must include:

- Four paths and both methods
- A Data API bearer security scheme that is distinct in description from a session token
- Path parameters
- POST request schemas
- PreparedData and DatasetData schemas
- Field, filter, variable, series, warning, error, and resource schemas
- All response status codes
- `ETag`, `Last-Modified`, `Retry-After`, and freshness headers
- Rate, request, response, and execution limits
- Examples for default, runtime, conditional, stale, and error responses

Add endpoint MDX pages for the four resources and update the API introduction. Add one guide that
shows:

1. How a team owner or team admin creates a project-scoped key.
2. How to send a default `GET`.
3. How to send variables and filters with `POST`.
4. How to use `If-None-Match`.
5. How to handle `401`, `403`, `404`, `413`, `429`, `503`, and `504`.
6. How to map PreparedData fields and rows into ECharts.
7. How to map the same response into Chart.js.

Update `../chartbrew-docs/environment-variables.mdx` with all Data API limit settings.

Validate the documentation with:

- JSON parsing
- OpenAPI validation
- Documentation-site link and schema validation

The Data API is not complete until the documentation change is validated and ready to land with
the server change.

## Test Plan

### Unit Tests

Add focused tests for:

- API-key claim validation
- Database-record, user, team, scope, and token comparison
- Constant-time digest comparison behavior
- Effective project calculations for all five roles
- Key project restrictions and empty project sets
- Legacy, session, Slack, share, and deleted token rejection
- Legacy-key list status and warning serialization
- Request schema validation
- Variable limits and normalization
- Chart and dataset filter validation
- DatasetData field ordering and JSON normalization
- PreparedData public serialization use
- Deterministic fingerprints that exclude only `generatedAt`
- `ETag` matching
- Response-size measurement with UTF-8 content
- Deadline and timeout mapping
- Stable public errors and secret redaction
- Audit allowlists

### Integration Tests

Add route tests for:

- All four paths and methods
- Team owner and team admin keys
- Project-admin, project-editor, and project-viewer effective access after a role change
- Removed user and removed team-role behavior
- All-project and selected-project keys
- Cross-team dataset IDs
- Chart under a different project ID
- Dataset outside the key project list
- Empty-project datasets
- Missing `data:read`
- Missing `data:refresh`
- Deleted and blacklisted keys
- Session JWT, public chart token, project share token, and old API-key rejection
- Legacy-key warning, new scoped-key creation, and no automatic revocation
- Default chart snapshot read with sources unavailable
- Stale-source snapshot read and background refresh
- Visualization-mismatch synchronous preparation
- Runtime prepared-cache hit and miss
- Runtime filters, variables, timezone, joins, transformations, aggregation, and breakdowns
- Dataset nested, array, object, scalar, and null results
- `If-None-Match` and `304`
- Rate-limit headers and per-key isolation
- Request and response byte limits
- Execution timeout
- JSON content negotiation
- Audit success and failure records
- No renderer configuration or secret fields in any successful response

### Parity Tests

For every supported chart preset, prepare one chart through the normal chart path and one through
the Data API path with the same inputs. Compare:

- Public serialized results
- Layer IDs
- Field metadata
- Series IDs and labels
- Row values and order
- Nulls and non-finite values
- Stats and warnings

Run the comparison for:

- Default data
- Field filters
- Date filters
- Variables
- Project timezone
- Sparse values
- Multiple bindings
- Breakdowns
- Table, KPI, average, gauge, matrix, markdown, and graphical presets

The Data API result must not depend on whether the current preset renderer is ECharts, native, or
the Chart.js fallback.

### Repository Validation

Run from `server/`:

```text
npm run test:unit
npm run test:integration
npm run lint
```

Use focused test commands during implementation, then run the full server suite before completion.
Do not start a UI development server for this validation.

## Delivery Plan

### Stage 1: Contracts And Key Security

- Add API-key and audit migrations.
- Add model fields and associations.
- Add key claims, stored scopes, project restrictions, and last-use tracking.
- Add strict Data API authentication and access calculation.
- Update key-management API and UI.
- Add unit and integration tests for all roles and token types.

Exit gate: no session, share, legacy, deleted, cross-team, or out-of-project token can reach a Data
API controller.

### Stage 2: Chart Data Endpoint

- Add prepared-only chart execution.
- Cover durable snapshots and prepared-cache short circuits.
- Add chart `GET` and `POST` routes.
- Add public serialization, `ETag`, freshness, errors, limits, and audit data.
- Add chart parity tests.

Exit gate: API chart rows match normal prepared chart rows for default and runtime inputs, and no
renderer compiler runs.

### Stage 3: Dataset Data Endpoint

- Add DatasetData v1.
- Add explicit dataset runtime filter handling.
- Add dataset `GET` and `POST` routes.
- Add dataset cache, join, transformation, nested result, limit, and access tests.

Exit gate: dataset responses preserve joined result shape, apply only documented runtime behavior,
and expose no chart presentation or source secrets.

### Stage 4: Hardening, Documentation, And Release

- Complete rate, timeout, response-size, audit, and redaction tests.
- Update and validate OpenAPI and MDX documentation on `v6`.
- Add ECharts and Chart.js examples.
- Run the full server test and lint suites.
- Confirm migration behavior on SQLite, PostgreSQL, and MySQL.

Exit gate: all acceptance gates pass and the documentation change is ready to release with the
server change.

## Migration And Compatibility

- All routes are additive and versioned under `/api/v1`.
- Existing application, embed, report, share, and old API routes do not change.
- Existing API keys keep their current old-API behavior.
- Existing keys have empty scopes and cannot use the Data API.
- Users must create a new scoped key for Data API access.
- The key-management UI identifies these keys as `Data API unavailable`.
- Creating a new scoped key never revokes an old key.
- Slack-created keys remain legacy integration keys and cannot use the Data API unless a later
  migration explicitly gives them database identity and scope.
- API-key model fields are additive and safe for a rolling deployment.
- New server code must tolerate old rows with null `user_id`, null project scope, and empty scopes.
- A rollback can remove the new route registration while leaving additive columns in place.
- `CB_DATA_API_ENABLED=false` can disable route execution during rollout. Disabled routes return
  `404`, not an implementation or feature-flag message.

## Security Review Checklist

- [x] Authorization header parser accepts exactly one bearer credential.
- [x] Token signature is valid.
- [x] Token type is `api_key`.
- [x] Token key ID loads one active database record.
- [x] Supplied and stored tokens match in constant time.
- [x] Token user and team match the database record.
- [x] Current user and team role exist.
- [x] Stored scope permits the operation.
- [x] Effective project set permits the resource.
- [x] Chart belongs to the route project.
- [x] Project belongs to the key team.
- [x] Dataset belongs to the route team.
- [x] Dataset project access is valid.
- [x] Public and share tokens fail before resource loading.
- [x] Runtime input is bounded before source work.
- [x] Source execution receives team and project scope.
- [x] Response uses an explicit serializer.
- [x] Error serialization removes internal details.
- [x] Audit records contain no token, query, variables, filters, or rows.
- [x] Rate-limit keys do not contain the bearer token.
- [x] Conditional requests repeat authorization.
- [x] Sensitive responses use private cache headers and vary on authorization.

## Acceptance Gates

- The four versioned routes return the documented JSON contracts.
- Only an active database-bound API key with `data:read` can use the API.
- Explicit or runtime-forced refresh requires `data:refresh`.
- Session tokens, old API keys, integration keys, and all share tokens are rejected.
- Team and project relationships are enforced in scoped database lookups.
- Current roles and project assignments can reduce key authority immediately.
- Team owner, team admin, project admin, project editor, and project viewer behavior matches the
  documented matrix.
- A deleted user, removed team member, revoked key, or removed scope loses access immediately.
- Chart responses are the public serialization of canonical `PreparedData`.
- Dataset responses preserve the canonical joined result before chart presentation.
- Default and runtime chart API rows match normal prepared chart rows.
- No successful response contains Chart.js, ECharts, renderer, source, credential, or cache data.
- Default `GET` supports stable `ETag` and authorized `304` responses.
- Stale last-known chart data is clearly marked without exposing cache internals.
- Rate, request, response, filter, variable, depth, string, and execution limits are enforced.
- Limit failures do not return partial data.
- All errors use stable codes and safe messages.
- Every authorized request produces bounded audit data.
- OpenAPI, endpoint guides, environment variables, and JavaScript examples are complete and
  validated on the documentation `v6` branch.
- Existing Chartbrew dashboards, embeds, reports, exports, snapshots, alerts, observations,
  automated refreshes, old APIs, and renderer fallbacks keep their behavior.

## Follow-Up Work

These items require a new specification or a new API version:

- Public data links
- Service-account keys that are independent of a user
- Key expiry and rotation policies
- Additional read and write scopes
- Row-level policies
- Pagination and field projection
- Streaming, CSV, Arrow, and bulk export
- Public schema discovery
- Dataset or chart webhooks
- Image, SVG, PNG, and screenshot sharing
