# Testing Guide

This document covers how to write and run tests in the Chartbrew backend.

## Test Framework

- **Framework**: Vitest + Supertest
- Tests live in [`server/tests/`](../tests/) and run via `server/package.json` scripts.

## Database Lifecycle

- **Global setup**: [`server/tests/globalSetup.js`](../tests/globalSetup.js)
  - Starts a DB (containers if available; otherwise SQLite)
- **Test setup**: [`server/tests/setup.js`](../tests/setup.js)
  - Truncates/cleans between tests
  - Important: tests set env defaults here because `settings-dev.js` reads env at require-time.

## Express App Helper

- **Helper**: [`server/tests/helpers/testApp.js`](../tests/helpers/testApp.js)
- Use `createTestAppWithUserRoutes()` for HTTP integration tests around `/user` endpoints.

## Writing Integration Tests

Start with [`server/tests/integration/`](../tests/integration/) for real HTTP behavior:
- `/user` signup and `/user/login`
- then 2FA endpoints (`/user/:id/2fa/...`)
- then password reset and email update flows

## Current Test Coverage

- User authentication flows (signup, login)
- 2FA validation
- Password reset
- Email update

## Where to Add Tests Next

- Data visualization pipeline endpoints
- Connection testing and query execution
- Dataset join logic
- Chart rendering pipeline
- Variable substitution edge cases

