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

### UI Copy And Meta-Information
- Before UI work, read `../chartbrew-design/DESIGN.md` and the relevant examples in `../chartbrew-design`. Follow its approved design rules, including secondary form controls on primary surfaces.
- Never expose implementation or developer-facing meta-information in the product UI. This includes internal model names, storage details, schema or contract versions, fingerprints, source IDs, queue/job states, feature flags, migrations, rollout notes, entitlement mechanics, and architecture terminology.
- User-facing copy must describe the user's task, the result, or the next useful action. Do not explain how Chartbrew is implemented unless that knowledge is required to complete the task.
- Keep interfaces concise. Do not add subtitles, helper paragraphs, callouts, badges, or tiny descriptive text merely to explain obvious controls or fill visual space.
- Prefer clear labels, sensible defaults, and familiar product language over instructional copy.
- When secondary explanation is genuinely useful, place it in a concise, accessible info tooltip next to the relevant label instead of permanently displaying helper text throughout the interface.
- Do not hide essential validation, errors, destructive consequences, required setup, or information needed to make a decision inside a tooltip. Keep essential guidance visible and action-oriented.
- Errors and empty states should explain what happened in user terms and provide a recovery action. Never surface stack traces, endpoints, module names, or internal workflow stages.
- Keep debugging and operational metadata out of normal product surfaces. If it is required for support or administration, place it behind an explicit admin or development-only surface.
- During UI review, remove copy that repeats the title, restates the visible control, overexplains the workflow, or would only make sense to someone familiar with the implementation.

### Workflow
- Implement spec if requested `docs/specs/FS-YYYYMMDD-<slug>.md`.
- Scaffold from spec, or directly implement if requested, run tests and linting to validate works, and fix any issues.
- When working on sources, source plugins, source templates, source-specific frontend components, or source runtime behavior, follow [`source-plugin-guide.md`](source-plugin-guide.md) before making changes.
