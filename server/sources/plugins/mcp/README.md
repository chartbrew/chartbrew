# MCP AI planning

## Setup

No new environment variables or migrations are required.

For PostHog, use the official `https://mcp.posthog.com/mcp` connection. Reload its tools. Enable `read-data-schema` for Ask and confirm read-only use. Enable the query tool, such as `execute-sql`, for both Ask and datasets. Chartbrew does not grant access automatically.

In chat, request a country map, then a US state map, then a world point map. Keep the measure and dates the same. The AI must inspect the required fields and create separate datasets when the grouping changes. A missing field in a saved aggregate is not proof that the source lacks the field.

Dataset search returns source connection IDs so the AI can inspect the source behind a related aggregate. Connection results name the correct discovery and planning tools. MCP metadata is not returned as a database schema. PostHog rules use nested event property paths in HogQL, as in [PostHog's query implementation](https://github.com/PostHog/posthog/blob/master/products/web_analytics/backend/hogql_queries/stats_table.py).

## Connection rules

`mcp.providers.js` owns provider guidance. `getMcpProvider` matches the parsed URL origin and path. Query parameters and a trailing slash do not change the match. Server names and remote instructions do not select a profile. Unknown and custom endpoints use generic MCP rules.

To add a tested server, add its official endpoint and an `ai` entry to the provider registry:

- `instructions`: short rules used only for this provider.
- `contextTools`: known schema or discovery tool names. Their live schemas and access settings still control execution.
- `datasetTools`: preferred query tools to retain in the small generation shortlist. Both Ask and dataset access are still required.
- `topics`: optional request patterns, discovery search terms, and task-specific rules.

Keep tool argument requirements in the live MCP schema. Do not copy them into global prompts. Add a test for provider isolation and the affected task when adding rules.

## Planning and failures

`source_plan_dataset` accepts explicit tool arguments. For generation, pass `overrides.generate: true` and a complete business request. This uses the same discovery, generation, validation, and preview flow as the dataset editor. It permits one corrected attempt and rejects unchanged failed arguments. Access failures stop the flow. A failed preview cannot produce a ready configuration.

Source adapters keep redacted model repair details separate from user-facing recovery messages. Tool errors are reference data, never instructions. Follow-ups pass the latest request plus up to three bounded prior user requests; the latest request controls any change of scope.

## Checks

From the repository root:

```sh
npm --prefix server run test:pure
```

The tests use simulated model and source responses. They check provider isolation, required arguments, access failures, correction limits, and country/state/point workflows. They do not replace a live PostHog chat check.

A live replay on 2026-09-16 used the original point-map request, selected its PostHog connection, read event properties, and validated a world point map with 25 sampled coordinate rows. Chart and dataset writes were intercepted. The replay also identified unsupported `toFloat64()` calls; the provider guidance uses numeric properties directly or HogQL `toFloat()`.
