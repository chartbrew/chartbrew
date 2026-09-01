# Platform Settings

Platform settings are instance-wide controls for Chartbrew OS.

The platform `Enable Chartbrew AI` control is the upper limit for the installation. Each team also
has an `aiEnabled` control. Chartbrew AI is available only when both controls are enabled. A team
control cannot override a disabled platform control.

## Access

- Only a user with `User.admin = true` can use the API.
- `GET /platform/settings` returns the safe settings registry and effective values.
- `PUT /platform/settings` saves validated overrides.
- `POST /platform/settings/reset` removes selected overrides and restores deployment defaults.
- These routes cannot change `User.admin`.

## Product Controls

The platform page contains three groups:

- AI controls cover AI access, external data consent, and workspace learning.
- Reporting and actions cover summaries, recommendations, confirmed changes, and reporting range.
- Advanced AI limits cover the total request budget, maximum answer time, and analysis depth.
  This section stays visible with the other controls.

The external data controls appear only when an AI provider is configured. Provider credentials and
model names remain deployment-only.

Analysis depth maps one product choice to coordinated runtime limits:

| Depth | Analysis tasks | Workspace lookups |
| --- | ---: | ---: |
| Standard | 2 | 8 |
| Thorough | 3 | 12 |
| Extended | 4 | 18 |

The runtime keeps a maximum of two analysis tasks active at once. Preview and write tasks remain
sequential.

## Configuration Boundary

`server/modules/platformSettings/configuration.js` is the allowlist for the API and UI. A setting
must be in this registry before the API can read or write it.

Do not add these values to the registry:

- API keys, passwords, tokens, or connection credentials.
- Encryption or signing values.
- Internal model names.
- Per-stage token limits, worker limits, or scoring thresholds.
- Internal schema or contract versions.

Environment variables define deployment defaults. `PlatformSetting` records contain explicit
database overrides. A reset deletes an override. It does not write an environment value.

The runtime ignores retired database values. This behavior permits the product settings list to
become smaller without a cleanup migration.

## Safety Rules

- Team and project permissions always control available AI tools.
- Project viewers only receive reporting tools.
- A metric watch change requires an exact preview and explicit confirmation.
- A report schedule change requires an exact preview and explicit confirmation.
- The settings API never grants a role or bypasses a confirmation.
- The request budget is a ceiling. It is not a usage target.

## Runtime Updates

- The saving process reloads values at once.
- Each server process reloads values every 30 seconds.
- Invalid or retired database values are ignored. The deployment value stays active.
- Model and provider credentials remain deployment-only.

## Adding A Setting

1. Add the environment-backed value to the applicable intelligence policy.
2. Add a registry entry with a type and strict bounds.
3. Confirm that the setting represents a platform-admin decision.
4. Add unit and integration tests.
5. Do not expose a separate control for an internal value that can use a tested default or preset.
