# Chartbrew MCP server

This endpoint lets an external agent read Chartbrew data, explore supported connections, save
datasets, and create temporary charts. It does not run the Chartbrew AI model or create a chat.

## Connect with OAuth

1. From `server/`, run `npm ci` and `npm run db:migrate`. Restart the existing API process.
2. Add a Streamable HTTP MCP server in your agent with the API URL plus `/mcp`.
   Locally, use `http://localhost:3210/mcp`. Do not supply an API key for the OAuth flow.
3. Sign in to Chartbrew. Check the app name and return address. Select **one team**, review the
   requested permissions, then press **Allow access**. Optional permissions can be removed.
4. The agent receives access to that team only. Changing the active team in Chartbrew does not
   change the authorization. Connect again to authorize another team, if the agent supports
   multiple connections to the same MCP URL.
5. Use **Settings → MCP** for setup instructions and connected clients. Remove access there to stop
   an app and its refresh tokens. The list covers your authorizations across teams, not your teammates'.

The setup page reads the published MCP resource URL, so commands also use `CB_MCP_PUBLIC_URL` when
configured. It includes Codex, Claude Code, Claude, ChatGPT, Cursor, and generic-client instructions.
Cloud clients cannot reach a localhost URL directly; use a public HTTPS endpoint. These instructions
do not replace per-client compatibility tests. API keys remain in **Team settings → API keys**.

OAuth discovery and the authentication challenge advertise all four permissions: `data:read`,
`data:refresh`, `charts:preview`, and `datasets:write`. Requests without a scope show all four on the
consent page. Users can remove optional permissions before approval; their team role still limits
access. Explicit requests for fewer permissions remain limited to those permissions. Existing
authorizations and API keys do not gain permissions; connect again to review a new request.

The server uses authorization codes with S256 PKCE, resource/audience checks, and explicit consent.
Repeated `resource` parameters are accepted only when every value exactly matches the MCP URL.
Mixed or unknown resources are rejected; tokens retain a single audience.
Access tokens last 10 minutes. Rotating refresh tokens expire with the authorization after 90 days.
Reusing a consumed refresh token or authorization code revokes that authorization. Clients must serialize
refreshes and restart sign-in if a refresh result was lost. Current user status, team membership, role,
and project access are checked on each request. MCP tokens cannot be used as Chartbrew login tokens.

Team owners and administrators can authorize all dashboards and supported connections in the chosen
team, including future dashboards. Other members are limited to the dashboards they can access at
consent time, intersected with their current access. Source exploration and chart creation remain
restricted to owners and administrators. Revoking one authorization does not affect another team.

### Deployment

OAuth runs in the existing API process. The public URL defaults to `VITE_APP_API_HOST` plus `/mcp`
(`VITE_APP_API_HOST_DEV` in development). The existing client-host setting supplies the consent page URL.
Production OAuth requires HTTPS. No new signing secret is needed.

For a separate public hostname, set only `CB_MCP_PUBLIC_URL`, for example
`https://mcp.chartbrew.com/mcp`. Route `/mcp`, `/oauth/*`, and `/.well-known/*` on that hostname to
the same API process. Keep the normal API host available for signed-in consent and settings requests.
Do not derive these URLs from incoming Host headers. Changing the canonical URL invalidates existing
authorizations, so choose it before users connect. Prevent framing of the consent page at the frontend
proxy (`Content-Security-Policy: frame-ancestors 'none'`) and disable query/body/header logging for OAuth
routes at the proxy. Apply shared rate limits at the proxy if the API has multiple workers.

Client registration currently supports dynamic registration with public clients (`none`) and confidential
clients (`client_secret_basic` or `client_secret_post`). Client ID metadata documents are not yet supported.
App names are self-reported, not verified brands; consent shows the return host and a trust notice.
Redirect URLs must be exact HTTPS URLs, or HTTP loopback URLs for local clients. There are no wildcards.
Browser-only MCP clients with a different Origin are not yet supported; native and server-side clients
can use the endpoint. This implementation has local protocol coverage; test each external harness before release.

The existing retention command removes expired requests and authorizations, with their refresh hashes,
in batches of up to 1,000. Schedule it through your existing retention job:

```sh
npm run retention:run -- --category=mcp-oauth --dry-run
npm run retention:run -- --category=mcp-oauth
```

## Connect with an API key

1. Install server dependencies with `npm ci` in `server/`, then restart your existing API process.
2. In Chartbrew, open **Team settings → API keys** and create a key. Copy the token once and keep it
   in your agent's secret storage. Existing keys do not gain write permissions.
3. Configure a Streamable HTTP MCP connection to your **API host** plus `/mcp`, not your frontend host.
   In this workspace, the endpoint is `http://localhost:3210/mcp`.
4. Set the HTTP header `Authorization: Bearer <your API key>` in the MCP client configuration.

Use HTTPS outside local development. Apply the OAuth migration even if you use only API keys.
Chartbrew's existing client-host setting supplies signed-in links in tool results.

| Permission | Use |
| --- | --- |
| Read data | Search, read existing data, inspect supported connections, preview read-only source requests |
| Refresh data | Allow `refresh: true` on existing dataset and chart data calls |
| Create chart previews | Create a temporary chart; does not add it to a dashboard |
| Create datasets | Save a validated source request in a selected dashboard |

The private alpha requires a team owner or administrator with **All projects** access for source
exploration and chart creation. Selected-project keys can search and read data only within their
effective project access. Both write permissions are off by default. Delete the key to revoke access.

Cloud use requires deployment of this version and an API host supplied by the operator.

## Agent flow

- Find existing data with `search_workspace`; use `get_workspace_activity` for recent changes.
- Read an existing dataset with `run_dataset`, or a chart with `get_chart_data`.
- If a dataset is missing, call `explore_data` with `operation: "inspect"` to list connections.
  Repeat with `connectionId` to inspect tables or approved MCP tools. Use `search` to narrow the list
  and `names` to request details for up to three tools.
- Call `explore_data` with `operation: "preview"` and a SQL `query` or MCP `configuration`.
  SQL is limited to validated SELECT/WITH statements and runs in a read-only transaction.
  Source credentials must also have read-only access; do not use database administrator credentials.
- To save the request, use `operation: "save"`, the same request, a `name`, and an accessible `projectId`.
  The server previews it again and does not save empty or invalid data.
- Call `create_chart_preview` with `datasetId`, `name`, `type`, and field paths such as
  `xAxis: "root[].country"` and `yAxis: "root[].visitors"`. Set `includeImage: true` for a PNG.
  The type list comes from Chartbrew's released dataset chart catalog, including `horizontalBar`,
  `radar`, `polar`, `matrix`, `avg`, and `gauge`. Markdown blocks do not use datasets and are not
  offered by this tool. For horizontal bars, keep `xAxis` as the category and `yAxis` as the value.
  Preview options include labels, legend, stacking, colors, fill, point size, time interval,
  aggregation, sorting, record limits, value bounds, gauge ranges, KPI growth, and table columns.
  These use the existing Chartbrew chart creation path, not a separate renderer.
  A table needs no axes; a KPI needs only `yAxis`. The returned `/previews/:chartId` link opens an
  interactive preview with the normal browser session. Signed-out users sign in and return to it.
  Team and dataset access are checked before data is loaded. The dashboard selector saves the chart;
  its title then opens the chart editor. The original preview link still works after placement.
  Deleted previews show an unavailable message. No public links or temporary access tokens are used.

MCP configuration uses the existing source format:

```json
{
  "source": "mcp",
  "tool": { "name": "approved_tool_name", "contractFingerprint": "value from inspect" },
  "arguments": {},
  "output": { "mode": "auto", "path": [] }
}
```

Tool approval and live schema checks still apply. Approve tools in the connection page first.
Routine definition changes keep existing access. Saved fingerprints do not block calls. Invalid
inputs or results return a safe recovery message and a dataset or connection link when available.
New tools remain disabled; destructive tools and missing permissions are still blocked.
The initial exploration sources are PostgreSQL, MySQL, and MCP. Other source types can still serve
existing datasets through `run_dataset`; create those datasets in Chartbrew first.

All six tools use a small catalog and bounded results. Optional images are limited to 1 MiB; if rendering
fails, the chart remains available by link. No public snapshot is created. Dataset saves and chart
creation are not idempotent: check a returned result or search before retrying an uncertain write.
Previews use Chartbrew's existing temporary-chart lifecycle and are not permanent dashboard charts.

## Test

From `server/`, with Docker running:

```sh
npm run test:database -- tests/integration/mcpServer.test.js tests/integration/mcpOAuth.test.js
```

This command uses an isolated test database. The tests cover authorization, project access, the tool
catalog size, protocol requests, dataset saves, timeouts, and chart previews. Data calls retain the
existing Data API rate, size, refresh, and execution controls.
