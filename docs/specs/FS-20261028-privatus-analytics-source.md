# Privatus Analytics Source And Site Overview Template

Status: implemented

## Goal
Let teams that use Privatus Analytics (cookieless website analytics) chart their website traffic in Chartbrew without building API requests by hand. Chartbrew already ships Plausible and Simple Analytics community templates. This adds the same kind of starting point through the source plugin system.

## Scope
- Add a `privatusAnalytics` source plugin as a branded API source (`type: "api"`, `subType: "privatusAnalytics"`, `dependsOn: ["api"]`).
- Reuse `server/sources/shared/protocols/api.protocol.js` for runtime, previews, variables, and builder metadata.
- Own only the connection test: it calls `/stats/aggregate.json?period=today` for the site, because the site root is not a JSON endpoint.
- Add a connection form that asks for a connection name, a site ID, and an API token.
- Add a `site-overview` chart template with one selectable card per chart.
- Reuse `ApiBuilder` for editing datasets after creation.

## Out Of Scope
- OAuth. Privatus Analytics uses personal API tokens (`pat_...`) sent as a bearer token.
- AI dataset generation and source instructions.
- Multi-site connections. One connection points at one site, so template routes stay static.

## Connection
- Host is stored as `https://privatusanalytics.com/sites/<site_id>`.
- Site IDs must match `^pa_[A-Za-z0-9]+$`. The form validates this, and the backend test refuses any host that is not a Privatus Analytics site URL.
- Authentication is `bearer_token`. Tokens start with `pat_`. Users create them under Workspace settings, API tokens.
- Connection tests run with `allowPrivateHost: false`.

## API Shapes
All responses are wrapped in `{ "data": ... }`.

- `GET /stats/timeseries.json?period=90d&interval=day` returns `data.series[]` with `date`, `visitors`, `visits`, `pageviews`, `bounce_rate`, `visit_duration`.
- `GET /stats/aggregate.json?period=30d` returns `data.metrics` with the same metrics as one object.
- `GET /breakdown/<dimension>.json?period=30d&limit=10` returns `data.rows[]` with `value`, `share`, and metrics for that dimension (`pageviews` and `visits` for `page`, `visitors`, `visits`, and `pageviews` for visit dimensions).

Reference: https://privatusanalytics.com/docs/api and https://privatusanalytics.com/openapi.json

## Site Overview Template
Datasets:
- Daily traffic (timeseries, last 90 days, so dashboard date filters have room)
- Headline metrics (aggregate, last 30 days)
- Top pages, traffic channels, top referrers, countries (breakdowns, last 30 days)
- Devices (breakdown, top 5)

Charts:
- Visitors and pageviews (line, `trend`, `sum` so coarser intervals add up)
- Visitors, Pageviews, Bounce rate (KPI)
- Top pages, Traffic channels, Top referrers, Countries (horizontal bar)
- Devices (doughnut)

The template setup selects charts only. The datasets each chart needs are derived from `requiredDatasetIds`, so picking one chart creates only its datasets.

## Files
Backend:
- `server/sources/plugins/privatusAnalytics/privatusAnalytics.plugin.js`
- `server/sources/plugins/privatusAnalytics/privatusAnalytics.protocol.js`
- `server/sources/plugins/privatusAnalytics/privatusAnalytics.connection.js`
- `server/sources/plugins/privatusAnalytics/templates/site-overview.json`

Frontend:
- `client/src/sources/privatusAnalytics/privatusAnalytics.source.js`
- `client/src/sources/privatusAnalytics/privatusAnalytics-connection-form.jsx`
- `client/src/sources/privatusAnalytics/privatusAnalytics-template-setup.jsx`
- `client/src/sources/privatusAnalytics/assets/`

## Verification
- `server/tests/unit/privatusAnalytics.test.js`: registry resolution, site ID validation, connection test URL and headers, template validity, layouts, and plotting every template chart through `AxisChart` with real response shapes.
- Existing `sourceRegistry`, `sourcePluginStructure`, `chartTemplateLoader`, `sourceAiHarness`, and `connectionRoute.security` tests still pass.
- `npm run lint` in `server` and `client`, and `npm run build` in `client`.
