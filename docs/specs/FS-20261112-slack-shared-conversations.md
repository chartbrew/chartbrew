# Slack shared conversations, access, and usage audit

Status: implemented; live Slack acceptance check remains. Supersedes conflicting rules in FS-20261105-slack-orchestrator-and-native-charts.md.

## Agreed behavior

- Only Chartbrew team owners and admins can create, connect, edit, or remove integrations and view their conversation audits.
- Admins select allowed Slack channels and available Chartbrew dashboards. `allowAllDashboards` defaults to false. When enabled, current and future non-temporary team dashboards are included automatically. Linked-user permissions still apply. When disabled, only selected dashboards are allowed; an empty selection grants no data access.
- Who can ask: `admins-only` (owners/admins), `team` (internal team roles), `team-and-clients` (all team memberships), `everyone` (no account required).
- The first three modes require a personal account link to verify membership and role. Existing integrations default to admins-only until configured.
- Linked requesters always retain their Chartbrew restrictions. Effective dashboards are the intersection of integration selection and current personal permissions, even in everyone mode.
- Unlinked requesters in everyone mode have read-only access to the selected dashboards. Never impersonate an owner or installer.
- Replies, chart previews, controls, and errors belong in the original Slack thread. Account-link tokens stay private.
- A conversation belongs to the integration, channel, and thread, not a user. Record the requester for each turn. Recheck permissions on every turn, control, and delivery. Do not reuse history outside the current requester's access.
- Slack messages are visible to channel members. Chartbrew cannot apply individual read permissions to messages already posted in Slack.
- Shared conversation history must not import personal memory. Write controls require a linked account and the normal Chartbrew permissions.
- Dashboard overviews return a text summary. Do not send individual chart cards for charts read as summary evidence. Keep previews for explicit chart results. `request_chart_preview` sends a selected existing chart and requests a one-time refresh only for explicit live/latest/refresh requests and permitted accounts. Saved views must not be described as live feeds. Explicit dashboard screenshot requests send one image of the saved report view in the source thread. Resolve an omitted dashboard from the last accessible dashboard references in the thread; ask when ambiguous. Recheck dashboard and linked-user export permissions before rendering and upload. Delete temporary image files after delivery.
- Return the complete written answer and relevant explicit chart results. Image upload failure must not prevent answer delivery or leave a stale loading message.

## Audit and usage

- Integration details list all retained Slack conversations with channel/thread link, first and last activity, and token totals.
- Owners/admins can inspect questions, answers, requesters, actions, delivery failures, and request-level usage.
- Tag AI calls by source (`app`, `slack`, `api`) and integration. Include nested calls and failure usage. Unknown provider usage must not be presented as measured zero.
- Team AI usage includes all sources by default, with a source filter including Slack.
- Preserve existing personal links and historical audit data during migration. Do not merge old personal history into new shared conversations.
- No new environment variables or feature flags. Apply the database migration before restarting the server.

## Checks

- Deny non-admin setup and audit access on the server.
- Exercise all four access modes; reject revoked memberships and stale links.
- Client with DashOne access cannot query DashTwo although Slack has both. No-link everyone access is read-only and limited to selected dashboards.
- Two people in one thread share a conversation; restricted history and controls cannot expand access.
- Verify answer-first delivery, chart fallback, retries, and original thread placement.
- Verify source-filtered totals and per-integration audit isolation.
- Check settings and audit UI against the design system, including secondary controls and rounded-3xl surfaces.

## Implementation notes

- Shared conversations use a unique integration/team/channel/thread key. Older personal records stay available for audit but do not become shared history.
- `integrationContext.js` applies fresh dashboard and actor restrictions to nested tool reads. It is set only by the Slack worker.
- Long written answers are split into Slack messages. Written answers are sent before image rendering. Invalid image blocks fall back to text and Chartbrew links.
- The migration adds source and request attribution to AI usage. Historical conversation totals are preserved; historical per-turn counts are shown as unavailable.
- Audit records are retained. Expired link tokens are removed by the existing retention command.
- Setup: run `npm run db:migrate` from `server/`, restart the backend, then select audience and dashboards in Slack integration settings. No new environment variables.
