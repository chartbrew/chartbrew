# Chart Studio conversation history

Status: implemented. Verification results and limits are recorded below.
Date: 29 September 2026.

## Decision

Keep one saved conversation with one chart editing target. List studio conversations in the AI
modal, but open them in Chart Studio. Show and continue their history in the studio's left panel.
General conversations continue in the modal. Context references alone do not establish ownership.

## User flow

- The modal lists general and studio conversations together. A studio entry shows its conversation
  title, accessible chart name, and an **Open in chart studio** action. Selecting the entry closes
  the modal and opens that chart with the selected conversation. Do not first show its transcript.
- Opening the AI modal itself opens the conversation list when the active conversation belongs to
  Studio. Do not immediately send the user back to Studio without a selection.
- Studio conversations never appear in the bottom active conversation bar, including while a reply
  is pending, after leaving Studio, or after a reload. They remain available in the conversation list.
  General conversations retain their existing bar behavior.
- Connection setup return links use the same destination rule as modal selection. A direct link to
  a studio conversation opens the chat panel, including on phones.
- On a normal chart visit, load the user's most recently updated studio conversation for that chart.
  If none exists, show the existing empty chat. An explicit conversation in the URL takes priority.
- Show the current conversation title with a plus button for **New conversation** and a clock button
  for **Conversation history**. The history popup marks the selected chat. The list contains only
  this user's conversations for this chart, newest first, with access to older pages. Keep it separate
  from chart version history. Use existing HeroUI controls and approved design rules.
- Selecting an older chat restores its saved messages and continues the same conversation ID.
  Starting a new chat clears the transcript without deleting previous chats. Save it on the first
  message, not when the user presses New conversation.
- A deleted or inaccessible chart opens the existing modal transcript in read-only mode. Show
  “This chart is no longer available. You can read the available conversation history.” Hide the
  composer and all actions that change data. Apply existing history redaction and ownership checks;
  this fallback does not grant access to hidden messages or chart details.

## Data and API

- Add one nullable integer, `AiConversation.studio_chart_id`, through a reversible migration.
  Set it from the authorized active chart when a new persistent studio conversation is created.
  Keep this value after chart deletion; do not cascade-delete its conversation or clear its identity.
- The chart link is fixed once set. Context can include other references without changing the target.
  Resolve the chart's current dashboard and name through existing access checks when opening it.
  Do not save dashboard IDs, URLs, or chart names as a second source of routing data.
- Extend the existing conversation list/detail responses with the chart link and authorized chart
  destination, or an unavailable result. Extend the list endpoint with a studio chart filter applied
  before pagination. Retain user and team filters. Do not load each conversation transcript to build
  the list. Add an index for user/team/chart history lookup if the existing indexes do not cover it.
- On resume, derive `activeChartId` from the saved link and validate current access. Reject a supplied
  conflicting chart ID. Reject chart mutations when the linked chart is unavailable. Keep existing
  pending-action authorization and AI availability checks.
- Existing conversations have no reliable studio origin. Do not infer one from titles, message text,
  or a chart reference alone. Leave them as general conversations by default.
- To recover an older chat, offer **Open in chart studio** in its modal menu when it has exactly one
  accessible chart in saved context. This explicit action assigns the fixed chart link and opens the
  studio. Validate ownership, chart access, and the unassigned link on the server. Do not offer this
  action for ambiguous context. Do not bulk-assign old conversations.

## Client changes

- Extend `useAiChat` with loading/resuming by conversation ID. Reuse the existing history parsing
  and rendering code so saved answers, tool results, and action states match the modal. Keep chart
  preview cards suppressed in Studio, where the chart is already visible. Do not render raw tool
  messages or run a saved action during loading.
- Use `/dashboard/:projectId/chart/:chartId/edit?conversation=<id>` for a selected chat. Use
  `conversation=new` for an explicitly empty chat, so reload does not reopen the latest one.
  Replace `new` with the saved ID after the first message. Conversation selections support browser
  Back/Forward. Preserve unrelated query parameters. An invalid explicit ID shows an error with
  Retry or New conversation; it must not silently select another chat.
- Update `Main.jsx` connection return handling so `aiConversationId`/`aiTeamId` resolve to the correct
  destination before removal. Do not let that handler consume the studio's `conversation` parameter.
- Apply the destination rule to modal selection and pending modal conversation requests. Use a small
  shared helper only for repeated routing logic, not a routing registry.
- Exclude studio conversations from bottom-bar display and persistence. Keep studio request tracking
  separate from bar eligibility within the existing state; do not remove loading or completion tracking.
  Identify new studio requests before their saved ID arrives. Validate restored bar entries and remove
  any now linked to Studio before display, including older chats explicitly assigned to a chart.
- Reset chat state when the user, team, chart, or selected conversation changes. Ignore responses
  from an earlier selection. Preserve the existing chart refresh after a completed AI chart change.
- Disable conversation switching and new submissions while that conversation has a known active
  request. Leaving the page must not replay it. On return, load saved history and refresh it when the
  existing request completes. Retain existing failure recovery; do not add a background job system.
- The server owns saved history. Keep only selection and temporary request state in the client.
  No duplicate message store, cross-tab synchronization, or full modal rewrite is required.

## Implementation order

1. Add the chart link, API filtering/destination data, and server validation, including explicit
   assignment for older chats. Keep existing ownership and redaction behavior.
2. Add history loading and conversation selection to Studio through the existing chat hook.
3. Route modal and connection return selections to Studio; add the read-only fallback and exclude
   studio conversations from the bottom bar.
4. Run the checks below. No feature flags, new dependencies, or environment variables are needed.

Primary files: `server/models/models/aiconversation.js`, one migration, `server/controllers/AiController.js`,
`server/api/AiRoute.js`, `client/src/api/ai.js`, `client/src/containers/Ai/hooks/useAiChat.js`,
`client/src/containers/Ai/AiModal.jsx`, `client/src/containers/Ai/ActiveConversationBar.jsx`,
`client/src/containers/Main.jsx`, and `client/src/containers/AddChart/components/ChartStudioChat.jsx`.
Change existing message, UI-state, and studio panel helpers only where required by this flow.
Read applicable server/AI instructions before implementation. Match `../chartbrew-design/DESIGN.md`.

## Acceptance checks

- Create a studio chat, exchange messages, leave, and return. The same history loads. Continue the
  conversation and confirm that the existing chart changes and its preview refreshes.
- Open that chat from the modal list and connection return. Each opens the same studio
  conversation. Opening the modal itself still permits browsing the full conversation list.
- Close the studio panel, leave Studio during and after a reply, and reload elsewhere. No studio chat
  appears in the bottom bar. Check a restored studio entry and an older chat newly assigned to Studio.
  General conversation bar behavior and studio request completion remain functional.
- Start a second chat, switch between both, reload, and use Back/Forward. Check `conversation=new`,
  an invalid ID, and an older conversation beyond the first API page.
- Open a chat while an earlier request finishes. No duplicate message, wrong transcript, stale chart
  target, or repeated action is permitted. Loading saved actions must preserve their current state.
- Check another user's ID, another team's ID, a mismatched chart, chart deletion, and lost access.
  No unauthorized history or mutation is permitted. Check the read-only fallback and redaction.
- Assign an older single-chart chat explicitly; it resumes in Studio. Unassigned and ambiguous chats
  retain their current modal behavior. General Home and observation chats remain functional.
- Add focused regressions to the existing client AI and server ownership/context tests. Run
  `npm --prefix client run test:ai`, `npm --prefix client run test:visualization`, client/server lint,
  the affected server tests, and the client build. Check keyboard use, phones, and both themes in an
  existing browser session. Do not start a UI server without an explicit request.

## Setup after implementation

Run `npm --prefix server run db:migrate`, then run the updated application through its normal setup.
No new configuration is required. To check the main flow, create a chat in Studio, leave the chart,
open the AI conversation list, and select **Open in chart studio**.

## Ponytail review

Reviewed the complete proposed scope on 29 September 2026. No unnecessary complexity found.
Use one stored chart link, the existing conversation APIs, and the existing chat hook and renderers.
Explicit assignment for older chats is retained because their studio origin was not saved.
No separate chat service, generic destination framework, or duplicate transcript storage is needed.
The bottom-bar exclusion uses existing conversation identity and state; no second tracking system is needed.
The final working diff was also reviewed. It reuses these components and adds no dependencies,
feature flags, or configuration. No further complexity cuts were identified.

## Verification results

- Client AI tests: 23 passed. Visualization tests: 81 passed. Client build and lint passed.
- Server ownership and context tests: 16 passed against an isolated database. Server lint passed
  with existing warnings. The migration passed in the test database and local development database.
- Browser checks passed for saved history, New conversation, Back navigation, reload, modal routing,
  explicit assignment of an older chat, unavailable-chart read-only history, and connection return
  routing. No Studio chat bar appeared after leaving Studio. Phone layout, keyboard menu dismissal,
  and light and dark themes were checked. The four temporary test chats were removed.
- The wider server pure suite had 1,167 passes and six failures. The same six failures were
  reproduced on unchanged HEAD in `apiAi`, `firebaseAi`, `orchestratorDashboardTemplate`, and
  `sourceAiHarness`. They concern existing chart-creation mock expectations.
- Browser checks used saved test messages. A live AI chart edit and leaving during a live response
  were not tested end to end. Server checks cover creation, resume, fixed targets, and access loss.
  Multi-page history filtering is covered by the server test; a full older page was not tested in
  the browser.
