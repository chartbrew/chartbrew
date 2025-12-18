# Chartbrew Server (Backend) – Agent Notes

This file is a quick map of **how the Chartbrew backend works**, with pointers to the most important files. It is written for agents (and humans) to ramp up quickly.

## Runtime entrypoint
- **Main entry**: `server/index.js`
  - Loads env via `dotenv`
  - Sets `app.settings = settings` (not `app.set(...)`)
  - Loads middleware and mounts all API routes
  - Runs DB migrations then starts the HTTP server

## Settings and env
- **Settings modules**:
  - `server/settings.js` (production)
  - `server/settings-dev.js` (non-production)
- Many modules load settings with:
  - `process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev")`
- Key env vars used by auth:
  - `CB_SECRET_DEV` (legacy token secret + `simplecrypt` secret)
  - `CB_ENCRYPTION_KEY_DEV` (JWT secret used by current auth flow)
  - `CB_RESTRICT_SIGNUP_DEV` (restrict signup once users exist)
  - `CB_RESTRICT_TEAMS_DEV` (restrict team auto-creation on signup)

## API routes
- **Route registry**: `server/api/index.js`
- Each route file (ex: `server/api/UserRoute.js`) exports a function `(app) => { ... }`.
- `server/index.js` mounts routes like this:
  - `_.each(routes, (controller, route) => app.use(route, controller(app)))`
  - Route modules typically **register handlers directly on `app`** (ex: `app.post("/user/login", ...)`).

## Controllers and data access
- Controllers live in `server/controllers/*Controller.js`.
- Controllers usually talk to Sequelize models via:
  - `const db = require("../models/models");`
- Models live in `server/models/models/*` and are wired from `server/models/models/index.js`.

## Auth model (high-level)
- **Signup**: `POST /user` in `server/api/UserRoute.js`
  - Uses `UserController.createUser()`
  - Returns a token created with `jwt.sign(..., app.settings.encryptionKey, ...)`
- **Login**: `POST /user/login` in `server/api/UserRoute.js`
  - Uses `UserController.login(email, password)`
  - Supports:
    - bcrypt passwords (`$2a$`, `$2b$`, `$2y$`)
    - legacy `simplecrypt` passwords (auto-migrated to bcrypt on successful login)
  - If 2FA is enabled for the user, the route returns a **2FA challenge** payload instead of a token:
    - `{ user_id, method_id, method }`
- **Token verification**: `server/modules/verifyToken.js`
  - Verifies first with `settings.encryptionKey`, then falls back to `settings.secret`
  - Loads the user from DB and places a sanitized user on `req.user`

## Testing (Vitest + Supertest)
- Tests live in `server/tests/` and run via `server/package.json` scripts.
- **DB lifecycle**:
  - `server/tests/globalSetup.js` starts a DB (containers if available; otherwise SQLite)
  - `server/tests/setup.js` truncates/cleans between tests
- **Express app helper**:
  - `server/tests/helpers/testApp.js`
  - Use `createTestAppWithUserRoutes()` for HTTP integration tests around `/user` endpoints.
  - Important: tests set env defaults in `server/tests/setup.js` because `settings-dev.js` reads env at require-time.

## 2FA endpoints (current behavior)
- **2FA challenge** happens via `POST /user/login` (see above)
- **Validate 2FA login**: `POST /user/:id/2fa/:method_id/login`
  - Calls `UserController.validate2FaLogin(userId, methodId, token)`
  - On success, issues a normal tokenized user response
  - Implementation note: the route currently reads `method_id` from the **request body** (`req.body.method_id`), even though `:method_id` is also present in the path.

## Password reset flow (current behavior)
- **Request reset**: `POST /user/password/reset`
  - Always returns `{ "success": true }` immediately (does not await controller)
  - Controller path: `UserController.requestPasswordReset(email)`
    - Sets `User.passwordResetToken` to a new UUID
    - Builds a `hash` payload using `server/modules/cbCrypto.encrypt()`:
      - JSON: `{ id, email }`
    - Emails a reset URL like:
      - `${settings.client}/passwordReset?token=${passwordResetToken}&hash=${hash}`
- **Change password**: `PUT /user/password/change`
  - Controller path: `UserController.changePassword({ token, hash, password })`
  - Decrypts `hash`, verifies `token` matches `User.passwordResetToken`, then:
    - Updates password (bcrypt)
    - Rotates `passwordResetToken` (new UUID)

## Email update flow (current behavior)
- **Request email update**: `POST /user/:id/email/verify`
  - Protected by `server/modules/verifyUser.js` (token user must match `:id`)
  - Calls `UserController.requestEmailUpdate(id, newEmail)`
    - Rejects if `newEmail` already exists
    - Generates a JWT signed with `settings.encryptionKey` that includes:
      - `{ id, email, newEmail }`
    - Sends an email to the **new email address** with a URL like:
      - `${settings.client}/user/profile?email=${token}`
- **Apply email update**: `PUT /user/:id/email/update`
  - Protected by `server/modules/verifyUser.js`
  - Calls `UserController.updateEmail(id, token)`
    - Verifies JWT and validates that the request `id` matches token `id`
    - Checks `newEmail` is still available
    - Updates `User.email` to `newEmail`

## User management endpoints (current behavior)
- **Get user by id**: `GET /user/:id`
  - Protected by `server/modules/verifyUser.js` (token user id must match `:id`)
- **Update user**: `PUT /user/:id`
  - Protected by `server/modules/verifyUser.js`
  - `admin` cannot be set through this API (model hook forces `admin=false`)
- **Delete user**: `DELETE /user/:id`
  - Protected by `server/modules/verifyToken.js` and additionally checks `req.user.id === :id`
- **Admin listing**: `GET /user`
  - Protected by `verifyToken` and checks `req.user.admin`
  - Note: admins are intended to be set **only in DB**, not via API

## Where to add tests next
- Start with `server/tests/integration/` for real HTTP behavior:
  - `/user` signup and `/user/login`
  - then 2FA endpoints (`/user/:id/2fa/...`)
  - then password reset and email update flows


