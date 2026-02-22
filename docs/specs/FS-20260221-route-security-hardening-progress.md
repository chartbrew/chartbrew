# FS-20260221-route-security-hardening-progress

## Goal
Harden team-scoped API routes against cross-team IDOR/access bypass while preserving current client request shapes.

## Scope
In scope for this pass:
- AI access middleware return-path fix
- Team-scoped enforcement for connection, dataset, integration, savedQuery, and API key deletion routes
- Project ownership validation for chart export `chartIds`
- Chart filter route auth hardening with bearer/share-token support
- Project logo upload hardening (type/content/path validation)

Out of scope for this pass:
- None

## Progress
- [x] AI middleware returns on denied access (`server/api/AiRoute.js`)
- [x] Connection team scoping enforced for all team routes with `:connection_id` (`server/api/ConnectionRoute.js`, `server/controllers/ConnectionController.js`)
- [x] Dataset team scoping enforced for all team routes with `:dataset_id`/`:id` (`server/api/DatasetRoute.js`, `server/controllers/DatasetController.js`)
- [x] Integration ID-based routes scoped by `team_id` (`server/api/IntegrationRoute.js`, `server/controllers/IntegrationController.js`)
- [x] API key deletion scoped by `team_id` (`server/api/TeamRoute.js`, `server/controllers/TeamController.js`)
- [x] SavedQuery update/delete scoped by `team_id` (`server/api/SavedQueryRoute.js`, `server/controllers/SavedQueryController.js`)
- [x] Chart export validates selected charts belong to route project (`server/api/ChartRoute.js`, `server/controllers/ChartController.js`)
- [x] Chart filter route auth hardening with dual auth (bearer user OR valid share policy token) (`server/api/ChartRoute.js`, `client/src/slices/chart.js`, public/shared chart containers)
- [x] Project logo upload hardened against stored XSS/path traversal (`server/api/ProjectRoute.js`, `server/modules/logoUploadSecurity.js`, `server/index.js`)
- [x] Snapshot email pipeline regression fix: awaited mail send, optional file attachment, and non-looping channel failure handling (`server/modules/nodemail.js`, `server/crons/workers/sendSnapshot.js`, `server/crons/sendSnapshots.js`)
- [x] Snapshot `accessToken` compatibility restored for chart filter requests (`server/api/ChartRoute.js`, `client/src/slices/chart.js`, `client/src/containers/PublicDashboard/PublicDashboard.jsx`, `client/src/containers/PublicDashboard/Report.jsx`)
- [x] Snapshot file serving path alignment and legacy static fallback for `/uploads` (`server/index.js`, `server/modules/snapshots.js`, `server/crons/workers/takeSnapshot.js`)

## Compatibility notes
- No request body schema changes required; public/share clients now append auth query params (`token` and `pass` when present) for chart filtering.
- Team-scoped endpoints keep same paths/params; unauthorized cross-team IDs now return not found/denied.
- Chart export still accepts `chartIds` array; now rejects mixed-project/foreign IDs.
- Chart filtering now requires one of: authenticated team/project access, valid share token for chart/report, or explicitly public report access (public policy/no policy).
- Project logo upload now accepts only real image files (`png`, `jpg`, `gif`, `webp`, `svg`) up to 5MB, with server-generated filenames.
- Snapshot jobs now avoid duplicate queue entries per project while a job already exists; email send is properly awaited and includes attachment when local snapshot file exists.
- Internal snapshot pages (`/b/:brewName?accessToken=...`) can now run dashboard chart filters using the same temporary `accessToken`.
- Snapshot files are now created under an explicit server uploads directory, and `/uploads` serves both canonical and legacy upload roots.

## Verification
- [x] `npm --prefix server run lint`
- [x] `npm --prefix server run test:unit`
- [x] `cd client && npx eslint src/slices/chart.js src/containers/SharedChart.jsx src/containers/EmbeddedChart.jsx src/containers/PublicDashboard/PublicDashboard.jsx src/containers/PublicDashboard/Report.jsx`
- [x] Re-run lint and unit tests after logo upload hardening changes
