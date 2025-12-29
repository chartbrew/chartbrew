# Chartbrew Project Structure

This is a monorepo containing two main applications:

## Client Application (`client/`)
- **Framework**: React with Vite
- **Location**: `client/`
- **Purpose**: Frontend web application for creating and managing charts
- **Tech Stack**: React, Vite, Redux, Tailwind CSS, HeroUI
- **Entry Point**: `client/src/main.jsx`
- **Build**: `npm run build` (outputs to `client/dist/`)

## Server Application (`server/`)
- **Framework**: Node.js with Express
- **Location**: `server/`
- **Purpose**: Backend API and chart rendering engine
- **Tech Stack**: Express, Sequelize, Redis, BullMQ
- **Entry Point**: `server/index.js`
- **Documentation**: See [`server/AGENTS.md`](server/AGENTS.md) for detailed backend documentation

## Project Instructions

### Style
- JavaScript only, double quotes.
- Keep generated code minimal with TODOs, no dead code.

### Workflow
- Spec-first: create `docs/specs/FS-YYYYMMDD-<slug>.md`.
- After acceptance, scaffold from spec, add rollout flags, add telemetry.

### Docs
- Specs ≤ 2 pages. ADRs short. Use Mermaid if needed.
