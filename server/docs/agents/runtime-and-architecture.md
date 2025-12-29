# Runtime and Architecture

This document covers the foundational architecture of the Chartbrew backend: how the application starts, how settings work, how routes are registered, and how controllers access data.

## Runtime Entrypoint

- **Main entry**: [`server/index.js`](../index.js)
  - Loads environment variables via `dotenv`
  - Sets `app.settings = settings` (not `app.set(...)`)
  - Loads middleware and mounts all API routes
  - Runs DB migrations then starts the HTTP server

## Settings and Environment Variables

- **Settings modules**:
  - [`server/settings.js`](../settings.js) (production)
  - [`server/settings-dev.js`](../settings-dev.js) (non-production)
- Many modules load settings with:
  - `process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev")`
- Key env vars used by auth:
  - `CB_SECRET_DEV` (legacy token secret + `simplecrypt` secret)
  - `CB_ENCRYPTION_KEY_DEV` (JWT secret used by current auth flow)
  - `CB_RESTRICT_SIGNUP_DEV` (restrict signup once users exist)
  - `CB_RESTRICT_TEAMS_DEV` (restrict team auto-creation on signup)

## API Routes Registration

- **Route registry**: [`server/api/index.js`](../api/index.js)
- Each route file (ex: [`server/api/UserRoute.js`](../api/UserRoute.js)) exports a function `(app) => { ... }`.
- [`server/index.js`](../index.js) mounts routes like this:
  - `_.each(routes, (controller, route) => app.use(route, controller(app)))`
  - Route modules typically **register handlers directly on `app`** (ex: `app.post("/user/login", ...)`).

## Controllers and Data Access

- Controllers live in [`server/controllers/*Controller.js`](../controllers/).
- Controllers usually talk to Sequelize models via:
  - `const db = require("../models/models");`
- Models live in [`server/models/models/*`](../models/models/) and are wired from [`server/models/models/index.js`](../models/models/index.js).

## Database Models

- All models are Sequelize models defined in [`server/models/models/`](../models/models/)
- Models are exported through [`server/models/models/index.js`](../models/models/index.js)
- Common models include: `User`, `Team`, `Project`, `Connection`, `DataRequest`, `Dataset`, `Chart`, `ChartDatasetConfig`, `VariableBinding`

