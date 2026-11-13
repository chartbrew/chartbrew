# Slack App Integration

Slack uses integration-owned conversations and optional personal Chartbrew account links.

## Code paths

- `api/SlackRoute.js`: signed Slack events, commands, controls, and account routes.
- `controllers/SlackController.js`: workspace installation, connection, and admin commands.
- `accounts.js`: hashed single-use links, current membership, and account revocation.
- `conversations.js`: shared thread bindings, shared `AiController.respond()` calls, actions, and delivery.
- `queue.js`: durable BullMQ requests. Turns run one at a time across Slack workers.
- `charts.js`: authorized previews, runtime period filters, and private image uploads.
- `utils/resultBlocks.js`: bounded native charts, tables, and action blocks.
- `retention.js`: remove expired link tokens while retaining audit history.

## Access rules

Only Chartbrew owners and admins can configure integrations or review conversation audits.
Verify Slack signatures before reading identity. Resolve membership on every turn and action.
The integration config has `accessMode` and `dashboardIds`; missing config means admins-only and
no dashboards. `allowAllDashboards: true` resolves all current non-temporary team dashboards on each request, including newly created dashboards, before intersecting personal access. Modes are admins-only, team, team-and-clients, and everyone.
Linked users receive the intersection of their current permissions and the selected dashboards.
Everyone mode permits unlinked users to read selected dashboards in allowed channels. It never
uses an owner or installer identity. Direct messages require a link. Unlinked users cannot write.

Dashboard reads (`read_chart_results`) supply evidence for text summaries, not automatic Slack chart cards. Explicit chart results still include previews. `request_chart_preview` selects an existing chart for Slack delivery; summary references stay text-only. A requested refresh runs once at preparation time when the current account can query the chart. Otherwise the tool identifies the result as a saved view. Slack previews are not continuous live embeds. Explicit screenshot requests use `request_dashboard_snapshot` and the existing saved-report renderer. `dashboardSnapshot.js` checks dashboard access, linked-user export permission, and chart access before capture and upload, then removes the temporary file. Follow-ups resolve the last dashboard references in the same thread and access scope. Summaries do not capture screenshots automatically.

Answers use native Slack markdown blocks, with at most 12,000 markdown characters per message, escaped mention syntax, and plain-text fallback.

The waiting message is edited with public orchestrator tool labels through `progress.js`. Edits are awaited, limited to one every two seconds, and never retried; progress failures do not stop the answer. Final delivery replaces the same message. Tool arguments and errors are never included in progress text.

Answers and controls stay in the source Slack thread. Account-link tokens remain private.
`SlackThread` binds the integration, team, channel, and thread to a shared `AiConversation` with no
user owner. Each `SlackRequest` records its requester. Never import old personal history into a new
shared thread. Current access filters shared history; personal memory is excluded. Write controls
remain bound to the requester who proposed the change.

`integrationContext.js` supplies trusted worker-local access to nested tools. It must never accept
HTTP body data as authority. It checks the team and actor and resolves fresh permissions on each
read. Normal web requests still use ordinary membership access.

`audit.js` scopes all records to the current integration AND team. This prevents a reconnected
workspace from exposing a previous team's history. AI usage records carry source, integration,
and Slack request attribution. Historical per-turn counts can be unavailable; conversation totals
remain available. Keep conversation audit records; retention removes expired link tokens only.

## Setup

1. From `server/`, run `npm run db:migrate` before starting the updated server.
2. Start the normal server with `npm start`, or restart the existing deployment. `setUpQueues()`
   starts the Slack worker on the main process. Use the existing Redis configuration.
3. Apply `manifest.json` to the Slack app, with the deployment's URLs. Add the `message.im` event
   and `im:history` and `files:write` bot scopes. Keep event and interaction endpoints enabled.
4. For an existing installation, use **Update Slack access** in Chartbrew's Slack integration.
   This flow preserves the team and channel settings. Ordinary reinstallation clears the connection
   and personal links. Do not use ordinary reinstallation as a scope update.
5. Select the allowed channels, available dashboards, and who can ask questions in the integration.
   For linked access, each person runs `/chartbrew link` and selects **Link account** in Chartbrew.
   Use `/chartbrew unlink` or the personal account screen to remove the link.
6. Include `npm run retention:run -- --category=slack` in existing retention maintenance.
   Add `--dry-run` to inspect counts first. This does not remove messages or files already in Slack.

No new environment variables are required. Existing Slack settings are `VITE_APP_SLACK_CLIENT_ID`,
`CB_SLACK_CLIENT_SECRET`, `CB_SLACK_SIGNING_SECRET`, and `VITE_APP_CLIENT_HOST`.

Legacy keys no longer authorize Slack requests. Before release, review keys named
`Slack Integration - <workspace>` and revoke keys used only by the old integration. The migration
keeps these existing keys because another API client might use them.

## Checks

From `server/`:

```sh
npm run test:pure
npm run test:database -- tests/integration/slackPersonalAccounts.test.js tests/integration/chartPreviewPlacement.test.js
npm run lint
```

The database suite needs Docker or an explicitly configured isolated test database. Never use a
production or development database. The pure suite includes an in-memory SQLite migration check.

In a test Slack workspace, check owner/editor/viewer access, account revocation, period changes,
confirmed writes, duplicate events, private image uploads, native-block fallback, and channel
sharing on desktop and mobile. Never send real customer data for this check.

## Current limits

Native charts support only values that fit Slack's limits and preserve the chart's meaning. Other
charts use the existing image renderer when possible, then an authenticated Chartbrew link. Changes
of period update the original result. Replies in the source thread continue the conversation; no separate
question modal is needed. Full web embeds and automatic refresh remain outside scope.

Slack requests are serialized globally. Increase concurrency only with conversation-level locking.
After a worker stops during an uncertain write, the next attempt asks the user to check Chartbrew;
it does not repeat the write. A transport outage can still leave a result undelivered after retries.
