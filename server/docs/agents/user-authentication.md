# User Authentication

This document covers all authentication and user management flows in Chartbrew.

## Signup Flow

- **Endpoint**: `POST /user` in [`server/api/UserRoute.js`](../api/UserRoute.js)
- Uses `UserController.createUser()`
- Returns a token created with `jwt.sign(..., app.settings.encryptionKey, ...)`

## Login Flow

- **Endpoint**: `POST /user/login` in [`server/api/UserRoute.js`](../api/UserRoute.js)
- Uses `UserController.login(email, password)`
- Supports:
  - bcrypt passwords (`$2a$`, `$2b$`, `$2y$`)
  - legacy `simplecrypt` passwords (auto-migrated to bcrypt on successful login)
- If 2FA is enabled for the user, the route returns a **2FA challenge** payload instead of a token:
  - `{ user_id, method_id, method }`

## Token Verification

- **Module**: [`server/modules/verifyToken.js`](../modules/verifyToken.js)
- Verifies first with `settings.encryptionKey`, then falls back to `settings.secret`
- Loads the user from DB and places a sanitized user on `req.user`

## 2FA Endpoints

- **2FA challenge** happens via `POST /user/login` (see above)
- **Validate 2FA login**: `POST /user/:id/2fa/:method_id/login`
  - Calls `UserController.validate2FaLogin(userId, methodId, token)`
  - On success, issues a normal tokenized user response
  - Implementation note: the route currently reads `method_id` from the **request body** (`req.body.method_id`), even though `:method_id` is also present in the path.

## Password Reset Flow

- **Request reset**: `POST /user/password/reset`
  - Always returns `{ "success": true }` immediately (does not await controller)
  - Controller path: `UserController.requestPasswordReset(email)`
    - Sets `User.passwordResetToken` to a new UUID
    - Builds a `hash` payload using [`server/modules/cbCrypto.encrypt()`](../modules/cbCrypto.js):
      - JSON: `{ id, email }`
    - Emails a reset URL like:
      - `${settings.client}/passwordReset?token=${passwordResetToken}&hash=${hash}`
- **Change password**: `PUT /user/password/change`
  - Controller path: `UserController.changePassword({ token, hash, password })`
  - Decrypts `hash`, verifies `token` matches `User.passwordResetToken`, then:
    - Updates password (bcrypt)
    - Rotates `passwordResetToken` (new UUID)

## Email Update Flow

- **Request email update**: `POST /user/:id/email/verify`
  - Protected by [`server/modules/verifyUser.js`](../modules/verifyUser.js) (token user must match `:id`)
  - Calls `UserController.requestEmailUpdate(id, newEmail)`
    - Rejects if `newEmail` already exists
    - Generates a JWT signed with `settings.encryptionKey` that includes:
      - `{ id, email, newEmail }`
    - Sends an email to the **new email address** with a URL like:
      - `${settings.client}/user/profile?email=${token}`
- **Apply email update**: `PUT /user/:id/email/update`
  - Protected by [`server/modules/verifyUser.js`](../modules/verifyUser.js)
  - Calls `UserController.updateEmail(id, token)`
    - Verifies JWT and validates that the request `id` matches token `id`
    - Checks `newEmail` is still available
    - Updates `User.email` to `newEmail`

## User Management Endpoints

- **Get user by id**: `GET /user/:id`
  - Protected by [`server/modules/verifyUser.js`](../modules/verifyUser.js) (token user id must match `:id`)
- **Update user**: `PUT /user/:id`
  - Protected by [`server/modules/verifyUser.js`](../modules/verifyUser.js)
  - `admin` cannot be set through this API (model hook forces `admin=false`)
- **Delete user**: `DELETE /user/:id`
  - Protected by [`server/modules/verifyToken.js`](../modules/verifyToken.js) and additionally checks `req.user.id === :id`
- **Admin listing**: `GET /user`
  - Protected by `verifyToken` and checks `req.user.admin`
  - Note: admins are intended to be set **only in DB**, not via API

