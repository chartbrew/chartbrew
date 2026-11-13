# Slack Personal Accounts And Native Charts

Status: implemented locally; release checks pending
Date: 5 November 2026

## Summary

Use personal Chartbrew account links for Slack requests. Apply the same permissions and request
handling as Chartbrew chat. Show native Slack charts with controls for data, periods, refresh,
dashboard placement, and confirmed changes. Leave full web embeds for a later spec.

This spec extends `FS-20260903-ai-orchestrator-chat-and-mcp.md` and
`FS-20260811-workspace-learning-orchestrator.md`. Follow `server/AGENTS.md`,
`server/apps/slack/AGENTS.md`, and the filtering guide during implementation.

## Product Decisions

1. Each person links their own Chartbrew account. A workspace installation grants no data access.
2. Slack uses the person's current Chartbrew permissions. Do not maintain a separate role list.
3. Answers stay in the source thread. Channel mentions receive channel-thread replies; DM questions receive DM-thread replies.
4. A user can select **Share in channel** to publish one result in the original allowed channel.
   Show a confirmation that everyone with access to that channel can read the result.
5. A shared result is a fixed copy. A later private refresh does not change that shared message.
6. Use native Slack charts where the data fits. Keep a secure Chartbrew link for every chart.
7. Start with manual refresh. Do not add automatic refresh subscriptions.
8. Use existing Chartbrew request and action functions. Do not create a second orchestrator.
9. Do not add feature flags, new AI prompts for Slack, or a new dependency without a demonstrated need.
10. Full embeds, Work Objects, an App Home dashboard, and the Slack agent side panel are outside scope.

## Current State And Required Changes

| Area | Current state | Required change |
| --- | --- | --- |
| Identity | Slack conversations use a selected owner/admin, with a user ID fallback. | Use the linked person. Remove all fallback identities. |
| Permissions | The Slack caller passes progress and usage options only. | Use the same access checks, tool scope, and history rules as web chat. |
| Requests | Slack calls the lower-level `orchestrate()` function. | Reuse `AiController.respond()` and existing action entry points. Extract shared code only if necessary. |
| History | Thread timestamps map to conversations in integration JSON. | Store a unique binding for the integration, channel, thread, and person. |
| Results | The formatter reads text, screenshots, and `cb-actions`. | Render validated chart references, pending actions, and replies. |
| Default dashboard | Saved but not passed to the request. | Use it as initial context only if the person can access it. |
| Delivery | Requests run after an immediate HTTP response. Duplicate events are not tracked. | Use existing durable work facilities with deduplication and ordered conversation turns. |
| Formatting | Images and a token footer are added after the block limit check. | Validate the complete message. Remove the raw-token “credits” footer. |

## Personal Account Linking

Keep workspace installation and team connection separate from personal account linking. Existing
owner/admin checks still apply to workspace connection and channel settings.

Add `/chartbrew link` and `/chartbrew unlink`. Keep `/chartbrew connect` and
`/chartbrew disconnect` for workspace administration. Help and status must distinguish these tasks.

Link flow:

1. Verify the Slack request signature and timestamp.
2. Send a single-use link to the requesting person's DM. Do not post it in a channel.
3. Bind the link to the integration, Slack workspace, Slack user, and current Chartbrew team.
   Store a hash of the random token. Expire it after 15 minutes.
4. Require normal Chartbrew authentication, including its existing 2FA flow. Do not match accounts
   by display name or email address.
5. Show the Slack workspace and the signed-in Chartbrew account. Use **Link account** to complete
   the operation. Check current membership in the integration's team.
6. Consume the token atomically and store the link. Send a private success message.

Allow one active Chartbrew account link per integration and Slack user. Do not silently replace an
existing link to another account. Require unlinking first. Provide **Unlink Slack account** in the
existing Chartbrew integration surface for the current person. It must not require team admin rights.

Store the personal link in a dedicated model. Keep at least the integration ID, Slack user ID,
Chartbrew user ID, and timestamps. Enforce uniqueness in the database. Do not create a long-lived
personal API key or copy the person's Chartbrew session into Slack.

Unlinking blocks new requests and invalidates unfinished actions for that link. Workspace disconnect,
reinstallation, or team replacement invalidates personal links and conversation bindings. A removed
team member cannot use an existing link. Check membership again on each request.

## Permissions And Result Visibility

Use the same access resolver as Chartbrew chat for every prompt, button, modal submission, data
request, and write. This includes team membership, visible dashboards, editable dashboards, source
access, AI availability, and current account limits.

- Viewers receive only the reporting actions available to them in Chartbrew.
- Editors and administrators receive only their current Chartbrew actions.
- An unlinked Slack user receives a private **Link account** action and no Chartbrew data.
- Channel allowlists remain a separate requirement for channel requests and sharing.
- A default dashboard provides context. It never expands permissions.
- Recheck access after queued work waits and before delivering a result or applying a change.
- Load conversation history with the same current-access filtering as web chat.
- Personal memory and KPI review schedules belong to the linked person.

Deliver a channel mention's answer and controls in the original channel thread. Deliver DM answers
in the original DM thread. Check the requesting person's permissions for every request and action.
Do not load the channel transcript into the person's Chartbrew conversation.

**Share in channel** publishes only the selected result and its chart, period, data timestamp, and
Chartbrew link. It does not publish the private conversation, memory, or action previews. Confirm:
“Everyone with access to this channel can read this result.” Recheck the sender's access, original
channel allowlist, and active integration before posting. Exclude Slack Connect channels from this
phase; detect them from Slack channel metadata and fail closed if that state cannot be checked.

Shared copies have no write controls. **Open in Chartbrew** checks each viewer's access at the
destination. Suppress automatic link previews where they could reveal additional data. Revocation
stops future access but cannot remove data already read or copied from a Slack message.

## Shared Request Flow

The Slack controller handles transport, identity resolution, and presentation. The shared Chartbrew
entry points handle context, history, tool access, orchestration, usage, and action validation.

- Reuse `AiController.respond()` for persistent chat requests and confirmations.
- Reuse `placeChartPreview()` for chart placement. Preserve its ownership and version checks.
- Reuse the existing deterministic and external workspace paths through the shared entry point.
- Reuse current memory handling, pending-action expiry, confirmation rules, and audit records.
- Add only the progress callback and source metadata needed by Slack. Do not make a second copy of
  message persistence, permission calculation, or usage accounting.
- Treat prepared actions as structured results. Do not infer a write from a button label.
- Preserve web chat behavior and its public response contract when moving shared code.

Store conversation bindings outside the integration config. The unique key must include the
integration, source channel, source thread, and Slack user. Store the DM thread destination as well.
Two people in one channel thread must not share a Chartbrew conversation. A DM reply resolves to
the same person's binding. Check conversation ownership before every turn.

Do not reuse legacy Slack history under a newly linked person. Keep old history under the existing
retention rules, but start a new conversation. Old buttons must return a private instruction to start
again. Do not import old owner/admin context into the new flow.

## Native Charts And Controls

Render chart data from Chartbrew's prepared render output and validated chart references. Reuse
`preparedSnapshot` and the access patterns in `readChartResults`. Do not use the model's prose or its
truncated tool response as the source of plotted values.

Preserve filters, timezone, units, comparison periods, aggregation, and missing-value behavior.
Include the selected period and data update time. Do not label cached data as refreshed source data.

| Result | Slack presentation | Controls |
| --- | --- | --- |
| Supported chart | Native line, bar, area, or pie block | Refresh, View data, Change period, Open in Chartbrew |
| Temporary chart | Native chart or supported fallback | Add to dashboard, plus applicable chart controls |
| KPI value | Formatted value, unit, and valid comparison | Refresh, View data, Open in Chartbrew |
| Unsupported chart | Private Slack image when available; otherwise a clear link | Open in Chartbrew |
| Prepared watch or KPI review | Exact proposed change | Confirm, Change |
| Follow-up choice | Up to four relevant replies | Suggested replies, Ask another question |

Only show controls that the person and result support. Keep secondary controls in an overflow menu
when necessary. Use concise labels. Do not show model names, tool arguments, storage details, or
token counts. For Chartbrew linking screens, use existing HeroUI components and the design system.

### Native chart limits

Slack currently permits two native chart blocks per message. Each chart permits up to 12 series;
each series permits up to 20 points. Pie charts permit up to 12 positive segments. Titles permit
50 characters; series names and category labels permit 20 characters. Each series must contain one
value for every axis category, and series names must be unique.

Validate these limits before sending. Never silently drop points, turn null values into zero, combine
categories, change aggregation, or truncate labels into collisions. Use the fallback for unsupported
data or types. Split multiple results across bounded messages in the same private thread. If Slack
rejects a native block as unsupported, retry once with the fallback and retain the Chartbrew link.

### Control behavior

- **Refresh:** retrieve the newest result permitted by the person's role. Source execution follows
  the same permission rules as Chartbrew. A viewer must not gain query execution through this button.
  Replace the private result after success; retain the previous result on failure.
- **View data:** show bounded rows in a native Slack data table with numeric sorting where supported.
  Identify partial results and provide the Chartbrew link. Follow Slack row and character limits.
- **Change period:** use existing runtime filters. Do not change the saved chart's defaults. Use the
  existing timezone and date-range rules. Hide this control when the result cannot support it.
- **Add to dashboard:** list only editable destinations. Validate the selected dashboard, preview
  ownership, conversation binding, and chart version on submission. Repeated delivery creates at
  most one placement.
- **Confirm:** execute the exact current pending action through Chartbrew's confirmation path.
  Reject expired, replaced, already-used, or other-person actions. Preserve required confirmations.
- **Change:** return to the private conversation to revise the proposal. Invalidate the old action
  under the same rules as web chat.
- **Share in channel:** copy the selected private result under the visibility rules above. Do not
  subscribe the channel message to subsequent refreshes.

Button values contain opaque references to server-held result/action state. Resolve the acting
person from the verified Slack payload. Bind state to the integration, person, conversation, message,
and result version. Treat modal metadata and selected IDs as untrusted input.

### Image fallback

Use a private Slack file and `slack_file` for an authorized image fallback. Do not publish a private
chart or create an anonymous image URL to make Slack fetch it. Share the file only with its intended
destination. Apply the same explicit sharing check before copying an image into a channel. If upload
or rendering fails, keep the answer and authenticated Chartbrew link available.

## Delivery And Failure Handling

Verify signatures before acknowledging requests. Acknowledge within Slack's three-second limit.
Ignore bot messages, message edits, and message deletions as new prompts. Do not answer the bot's own
progress or result messages.
Use the existing BullMQ/Redis facilities for long work; persist enough state to recover delivery
without repeating completed writes. Deduplicate events by workspace and event ID. Deduplicate
interactions with a stable request key and the action's one-use state. Order turns per conversation.

Do not retry an uncertain write blindly. Read its recorded outcome first. Keep model execution
separate from Slack delivery retries. Respect Slack rate limits and `Retry-After`; combine progress
updates. Send the final result even if an intermediate progress update fails.

Open modals within Slack's trigger lifetime. Validate submissions before clearing a modal where
Slack supports inline errors. Send only one HTTP acknowledgement for each request.

Validate the complete Block Kit payload after charts, actions, and context are added. Bound text,
blocks, and fallback text. Escape data labels and untrusted Slack markup. Include useful plain-text
fallbacks for notifications and screen readers, subject to the same visibility rules.

## Implementation Scope

| Surface | Expected work |
| --- | --- |
| `server/apps/slack/api/SlackRoute.js` | Personal-link commands, DM events, interactions, deduplication, one acknowledgement |
| `server/apps/slack/controllers/SlackController.js` | Linked identity, private delivery, shared request calls, result actions |
| `server/apps/slack/utils/formatResponse.js` | Validated result blocks, native charts, tables, fallback, complete payload limits |
| `server/apps/slack/utils/slackClient.js` | Private file upload, message updates, channel checks, bounded delivery retries |
| `server/controllers/AiController.js` and shared AI modules | Minimal transport hooks; preserve existing access and action behavior |
| Models, migrations, worker registration | Personal links, single-use link state, conversation/result bindings, durable work |
| Existing Slack auth and integration screens | Personal linking/unlinking without weakening admin setup checks |
| `server/apps/slack/manifest.json` and OAuth setup | DM events and required scopes; consistent install scope lists |
| Tests, fixtures, Slack documentation | Permission matrix, render fixtures, delivery checks, install and migration guide |

Add `message.im` and the required `im:history` scope for private replies. Private file upload needs
`files:write`. Verify the installed Slack SDK supports the selected calls; use its existing generic
API method when sufficient. Keep existing channel scopes for allowlist and shared-channel checks.
Request no workspace message-history scopes for this phase. Existing installations must approve
new scopes. Do not erase the team connection during a scope upgrade for the same installation.

Do not change source plugins or source execution semantics. Follow `source-plugin-guide.md` if a
later implementation finding requires source changes. No new environment variables are planned.

## Acceptance Tests

1. Link as an owner, editor, and viewer. Reject expired, reused, altered, and wrong-team links.
   Require normal login/2FA. A Slack-only account receives no data.
2. Compare Slack and web chat for the same person's allowed and denied requests. Cover saved results,
   source queries, temporary charts, placement, memory, watched metrics, and KPI review changes.
3. Remove dashboard or team access, unlink, disconnect, and reinstall. Old threads and buttons must
   not restore access. Another person cannot confirm or refresh the owner's private result.
4. Use two people in one channel thread and simultaneous prompts. Verify separate private history,
   ordered turns, no duplicate entities, and correct usage attribution.
5. Confirm that channel mentions receive answers and controls in the original channel thread.
   DM questions must stay in their DM thread. Check that no separate DM is opened for channel answers.
6. Render each supported chart and boundary values: 20/21 points, 12/13 series or pie segments,
   null values, negative pie values, long labels, label collisions, and more than two charts.
   Verify units, periods, timezone, and filters against Chartbrew.
7. Refresh and change period without altering the saved chart. Keep the old result when execution
   fails. Confirm that a shared copy does not change after a private refresh.
8. Test chart placement and action confirmation with stale versions, expired actions, changed roles,
   repeated clicks, and retry delivery. Apply a permitted write at most once.
9. Test unsupported native blocks, failed images, large tables, long text, Slack rate limits, process
   restart, and duplicate events. Deliver a useful bounded fallback without repeating model work.
10. Run web chat regression tests after shared-flow changes. Verify Slack desktop and mobile layout,
    keyboard operation, and accessible text in a test workspace with sample data.

Use Vitest and the existing isolated database setup. Add focused fixtures beside current server
tests. Run `npm run test:pure`, the affected database suites, and `npm run lint` from `server/`.
Do not use a production database for tests or start a UI server without the user's request.

## Delivery Order And Setup

1. Implement personal links, private conversation bindings, and shared access/request handling.
2. Add native chart conversion, private fallbacks, and validated interactive actions.
3. Complete retry, migration, regression, and Slack client checks before release.

For deployment: run the new migrations, deploy the server and existing worker changes, update the
Slack app events/scopes, and obtain installation approval for the added scopes. Each person then
runs `/chartbrew link`. Existing installations keep their team and channel settings, but users start
fresh personal conversations. Legacy integration API keys must no longer authorize bot requests;
revoke keys dedicated to that old path after confirming no remaining caller uses them.

See `server/apps/slack/AGENTS.md` for migration, worker, scope upgrade, and retention commands.
Full embeds require a separate eligibility and access review.

## Implementation checks

- The server pure suite and client production build pass. The pure suite includes an in-memory
  SQLite check of the new tables, unique constraints, JSON fields, and rollback.
- Docker was unavailable, so the MySQL/PostgreSQL integration tests remain pending.
- The local account page renders. Account reads need the new migration on that local database.
- Real Slack installation, native chart display, private file upload, and desktop/mobile checks
  remain pending in a test workspace.
- Turns are serialized globally. Replies use the existing Slack thread composer. No separate question modal
  or detailed tool progress is added. Expired tokens and requests use the retention command.
- Existing dedicated API keys need an operator review before revocation; no new keys are created.

## References

- [Slack native charts](https://docs.slack.dev/reference/block-kit/blocks/data-visualization-block/)
- [Slack data tables](https://docs.slack.dev/reference/block-kit/blocks/data-table-block/)
- [Slack image blocks](https://docs.slack.dev/reference/block-kit/blocks/image-block/)
- [Slack message updates](https://docs.slack.dev/reference/methods/chat.update/)
- [Slack DM events and scope](https://docs.slack.dev/reference/events/message.im/)
- [Slack file upload scope](https://docs.slack.dev/reference/scopes/files.write/)
- [Deferred Work Objects embeds](https://docs.slack.dev/messaging/work-objects-embeds/)

The earlier research checked these documents on 5 November 2026. Native-block support in the
installed app and Slack client behavior still require the acceptance tests above.
