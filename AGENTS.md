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
- **Documentation**: See [`server/AGENTS.md`](server/AGENTS.md) for detailed backend documentation, including the runtime [`Filtering Guide`](server/docs/agents/filtering-guide.md)

## Project Instructions

### Style
- JavaScript only, double quotes.
- Keep generated code minimal with TODOs, no dead code.

### Workflow
- Implement spec if requested `docs/specs/FS-YYYYMMDD-<slug>.md`.
- Scaffold from spec, or directly implement if requested, run tests and linting to validate works, and fix any issues.
- When working on sources, source plugins, source templates, source-specific frontend components, or source runtime behavior, follow [`source-plugin-guide.md`](source-plugin-guide.md) before making changes.

