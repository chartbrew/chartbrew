# Chartbrew MCP server: private alpha

This endpoint lets an external agent read Chartbrew data, explore supported connections, save
datasets, and create temporary charts. It does not run the Chartbrew AI model or create a chat.

## Connect

1. Install server dependencies with `npm ci` in `server/`, then restart your existing API process.
2. In Chartbrew, open **Team settings → API keys** and create a key. Copy the token once and keep it
   in your agent's secret storage. Existing keys do not gain write permissions.
3. Configure a Streamable HTTP MCP connection to your **API host** plus `/mcp`, not your frontend host.
   In this workspace, the endpoint is `http://localhost:3210/mcp`.
4. Set the HTTP header `Authorization: Bearer <your API key>` in the MCP client configuration.

Use HTTPS outside local development. No new environment variables or database migrations are required.
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

Public OAuth sign-in is **not implemented**. Do not present this private API-key flow as a public
OAuth integration. Cloud use requires deployment of this version and an API host supplied by the operator.

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
  A table needs no axes; a KPI needs only `yAxis`. Open the returned signed-in link to edit the chart.

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
The initial exploration sources are PostgreSQL, MySQL, and MCP. Other source types can still serve
existing datasets through `run_dataset`; create those datasets in Chartbrew first.

All six tools use a small catalog and bounded results. Optional images are limited to 1 MiB; if rendering
fails, the chart remains available by link. No public snapshot is created. Dataset saves and chart
creation are not idempotent: check a returned result or search before retrying an uncertain write.
Previews use Chartbrew's existing temporary-chart lifecycle and are not permanent dashboard charts.

## Test

From `server/`, with Docker running:

```sh
npm run test:database -- tests/integration/mcpServer.test.js
```

This command uses an isolated test database. The tests cover authorization, project access, the tool
catalog size, protocol requests, dataset saves, timeouts, and chart previews. Data calls retain the
existing Data API rate, size, refresh, and execution controls.
