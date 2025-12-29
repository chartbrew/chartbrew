# Chartbrew Server (Backend) – Agent Documentation

This is the index for agent-oriented documentation. Each topic is detailed in separate files under `docs/agents/`.

## Quick Navigation

### Core Architecture
- [Runtime and Architecture](docs/agents/runtime-and-architecture.md) - Entry points, settings, routing, models
- [Data Visualization Pipeline](docs/agents/data-visualization-pipeline.md) - Connection → DataRequest → Dataset → Chart flow

### Features and Flows
- [User Authentication](docs/agents/user-authentication.md) - Signup, login, 2FA, password reset, email updates

### Development
- [Testing Guide](docs/agents/testing-guide.md) - Test framework, DB lifecycle, integration tests

## Document Purpose

These documents are optimized for LLM agents to:
- Understand the complete system architecture
- Identify edge cases before making changes
- Find relevant code quickly
- Preserve critical behaviors during refactors

## Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| Runtime and Architecture | ✓ Current | 2025-01-XX |
| Data Visualization Pipeline | ✓ Current | 2025-01-XX |
| User Authentication | ✓ Current | 2025-01-XX |
| Testing Guide | ✓ Current | 2025-01-XX |

## Contributing to Agent Docs

When adding documentation:
1. Create themed files in `docs/agents/`
2. Keep files focused (< 500 lines each)
3. Update this index with links
4. Use Mermaid diagrams for complex flows
5. Include specific code pointers (file paths + line numbers)
6. Document edge cases and critical behaviors
