# Chart version history

Status: implemented; verification results are recorded below.
Date: 27 September 2026.
Target: Chartbrew OS.

## 1. Required result

Save a chart version after each successful manual save and each successful AI chart change.
Let chart editors view history, read change summaries, preview an earlier version, and restore it.
Restore adds a new version. It does not remove later versions.

The user confirmed these decisions:

- Save versions automatically at the existing save points.
- Restore chart settings and chart-specific data settings. Leave shared datasets unchanged.
- Include history, change summaries, preview, and restore in the first release.
- Keep the latest 100 versions per chart, including the current version. Use no age limit.

Do not add named versions, branches, merges, a detailed comparison editor, or session undo/redo.
Do not add feature flags, dependencies, environment variables, or a separate publish process.
The lab's Undo, Redo, and Publish controls do not define this feature.
This spec replaces the history exclusion in `FS-20260922-chart-studio.md` only.

## 2. Checked references and current behavior

Paths are relative to the repository root unless stated otherwise.

| Reference | Relevant behavior |
| --- | --- |
| `http://127.0.0.1:5174/#experiments/chart-studio/final` | Checked in the browser: left history list, selected version, preview banner, restore action. History is sample data. |
| `../chartbrew-design/DESIGN.md`, section 20 | Approved Studio placement, themes, typography, and control rules. |
| `../chartbrew-design/src/ChartStudio.jsx` | Sample history and restore interaction. Do not copy its persistence behavior. |
| `.impeccable.md` | Business dashboard users; clear, calm UI; compact controls. |
| `client/src/containers/AddChart/AddChart.jsx` | `_onChangeChart` saves chart changes immediately. The Save chart action is not the only save point. |
| `client/src/containers/AddChart/components/ChartStudio.jsx` | Existing left panel, resize controls, chart preview, and responsive settings. |
| `client/src/slices/chart.js` | Chart and chart-dataset create, update, and delete requests. |
| `server/api/ChartRoute.js` | Separate chart and chart-dataset mutation routes. |
| `server/controllers/ChartController.js` | Chart writes, binding writes, legacy compatibility, chart creation, and data refresh. |
| `server/modules/ai/orchestrator/tools/updateChart.js` | AI writes Chart, ChartDatasetConfig, and visualization separately. It does not use the manual update method. |
| `server/modules/ai/orchestrator/orchestrator.js` | Authenticated user and team context; tool calls can run in parallel. |
| `server/models/models/chart.js`, `chartDatasetConfig.js`, `alert.js` | Chart settings, chart-specific bindings, and alerts attached to bindings. |
| `server/visualization/VisualizationEngine.js`, `remapBindings.js` | Existing rendering and binding remap functions. |

The existing image snapshot and prepared data snapshot are not chart versions.
Do not use either as the version store. Refreshes can also write derived binding values.
A database hook that records every Chart update would therefore create false versions.

## 3. Version contents and limits

Store a complete, explicit selection of chart configuration fields. Do not store request bodies,
hydrated chart responses, Sequelize associations, or query results as a version.

| Include | Exclude |
| --- | --- |
| Title, chart type, markdown content, canonical visualization, and editable display settings | Chart data, prepared results, images, render output, cache fields, refresh timestamps, and generated metadata |
| Saved date settings, intervals, chart-specific conditions, formulas, and variable overrides | Temporary viewer filters and dashboard filters |
| Dataset references, field mapping, aggregation, series order, labels, colors, table settings, and goals | Dataset definitions, queries, joins, connections, credentials, and shared variable defaults |
| Chart refresh interval, where the existing chart exposes it as a saved setting | Refresh executions and refresh status |
| All bindings needed by the saved visualization | Alerts, recipients, monitor settings, and conversation messages |
| Compatibility fields still used by the editor | Dashboard placement, layout, report inclusion, draft/public/share state, export permission, and access tokens |

Initial Chart field selection:
`name`, `type`, `subType`, `visualization`, `displayLegend`, `pointRadius`, `dataLabels`,
`startDate`, `endDate`, `dateVarsFormat`, `includeZeros`, `currentEndDate`, `fixedStartDate`,
`timeInterval`, `autoUpdate`, `mode`, `maxValue`, `minValue`, `xLabelTicks`, `stacked`,
`horizontal`, `showGrowth`, `invertGrowth`, `isLogarithmic`, `content`, `ranges`,
`dashedLastPoint`, and `defaultRowsPerPage`.

Initial binding field selection:
`id`, `dataset_id`, `xAxis`, `xAxisOperation`, `yAxis`, `yAxisOperation`, `dateField`,
`dateFormat`, `conditions`, `formula`, `datasetColor`, `fillColor`, `fill`, `multiFill`,
`legend`, `pointRadius`, `excludedFields`, `sort`, `columnsOrder`, `order`, `maxRecords`,
`goal`, and `configuration`. The binding ID identifies references inside this version.
It is not permission to update another chart's binding.

Use one field selection for capture, comparison, and restore. Check it against the current editor
before implementation. Preserve meaningful array order. Normalize equivalent dates and defaults.
Ignore generated visualization metadata when checking whether a user setting changed.
Preserve renderer-required visualization metadata in storage; do not show it in the UI.

This feature versions chart definitions. It cannot reproduce old source data or reverse a shared
dataset edit. Moving a chart preserves its history. Copying a chart starts a separate history.
Deleting a chart deletes its history through the existing chart deletion flow.

## 4. When to create a version

- New chart: create version 1 when its initial configuration and bindings commit successfully.
  This includes manual creation, quick creation, templates, and AI creation, including temporary charts.
- Existing chart with no history: before its first effective change, save its current configuration
  as version 1, labelled `History started`. Save the changed configuration as version 2.
  Use the capture time; do not invent an earlier author or date.
- Manual change: one version per successful logical save, including binding add, edit, and remove.
  Keep existing input save/debounce behavior. Do not make a version for each unsaved keystroke.
- AI change: one version per committed chart mutation tool call, including all chart, binding,
  and visualization writes in that call. Several committed calls can create several versions.
  Do not hold a database transaction open for a full AI conversation turn.
- Restore: one new version containing the restored settings and the selected source version number.
- Unchanged settings, failed writes, source refreshes, preview, navigation, and excluded fields:
  no new version. A failed refresh after a successful settings save does not remove the version.

If one manual action currently sends dependent saves for included fields, combine those writes
into one server mutation. Independent saves remain independent versions. Do not group unrelated
changes with time windows or a background history worker.

## 5. Storage and shared save process

Add one `ChartVersion` model/table and a `Chart.configurationVersion` integer with default `0`.
Use the existing Sequelize model, migration, and JSON storage patterns for MySQL and PostgreSQL.

| ChartVersion field | Purpose |
| --- | --- |
| `id`, `chart_id`, `version`, `createdAt` | Identity, chart owner, ordering, and save time |
| `user_id`, nullable | Authenticated actor; retain history when an account is removed |
| `origin` | `manual`, `ai`, `restore`, `baseline`, or `system`; assigned by trusted server code |
| `configuration` | Full selected Chart fields and binding configurations |
| `summary` | Short, deterministic user-facing description |
| `restored_from_version`, nullable | Source of a restore |
| `operation_id`, nullable | Retry key for a mutation; supplied by the client or trusted AI dispatcher |

Require unique `(chart_id, version)` and unique non-null `(chart_id, operation_id)` values.
Use the chart/version index for descending history pages. Store no duplicate current snapshot on Chart.
Keep the latest 100 versions per chart, including the current version. Remove older rows in the same
transaction as a successful save. Keep version numbers increasing after cleanup. A failed save
must preserve history. Restore creates a new version and uses the same limit. No age limit applies.
Configuration changes in later releases must retain a reader for stored versions or migrate them.

Add one small module, `server/modules/chartVersions.js`, for the shared transaction and snapshot rules.
Use it from the existing controllers and AI tools. Do not add a generic event store or repository layer.

The shared save process must:

1. Check chart, project, team, and dataset access. Resolve the actor from authentication.
2. Start a transaction and lock the Chart row. Recheck ownership and access under the lock.
   All included mutation paths use this same lock.
3. Detect a committed retry key before applying the write again. Return the current chart or binding and its current version.
4. Compare the caller's `expectedVersion` with `configurationVersion`. Reject a stale write with 409.
5. Read and retain the selected configuration from the database before applying changes.
6. Validate and apply all included chart and binding writes using this transaction. Run existing
   compatibility updates within it. Do not read back through a helper that starts a data refresh.
7. Read the final configuration. If it changed, insert the retained baseline when required,
   then insert the changed version and advance the Chart counter. A no-op creates neither row.
   Commit the settings and version together. Roll back both if any configuration write fails.
8. After commit, use the existing cache invalidation and refresh paths. Return the committed version
   even if data refresh fails. Show a separate refresh error with a retry action.

Chart creation uses its existing transaction and saves one complete initial version before commit.
Pass the transaction through called helpers. Do not create nested independent transactions.
Do not run source requests, AI generation, image rendering, or notifications while holding the lock.
Keep runtime refresh writes out of history. They must not overwrite newer authored settings.
Audit the refresh-time ChartDatasetConfig write in `ChartController.js` as part of this separation.

Update all included writers together: ChartController chart and binding methods, the ChartRoute
callers, AI `updateChart`, chart creation/finalization paths, and template creation.
Search all direct Chart and ChartDatasetConfig writes before implementation. Classify each as an
included mutation, initialization, excluded management action, or runtime update. A controller-only
change is incomplete because the current AI tool writes directly to the models.

## 6. Concurrent changes, retries, and AI identity

Return `configurationVersion` with editor reads and successful writes. All editor mutations of
included fields send `expectedVersion` and a stable operation ID. Include binding DELETE requests.
Serialize dependent saves within one editor. Use the returned version for the next save.

Require the version on included writes. Missing or invalid values return a validation error.
Update all first-party callers in the same release. Document this request contract change for API users.
Do not use `updatedAt` as the conflict token: source refreshes also change the chart.

On 409, keep the user's local input. Show `This chart changed. Reload the latest version before saving.`
Provide `Reload latest`. Warn before that action discards local input. Do not merge or overwrite silently.
On a lost response, retry the same operation ID and expected version. Do not replay an older successful
result over a newer client version; fetch latest when the returned version is behind the editor.

The AI dispatcher must supply the authenticated user, origin, operation ID, and the chart version
used to prepare the tool call. These values must not come from model-generated identity fields.
Pass the base version with chart context. Re-reading the version immediately before a stale AI write
does not make the write safe. On conflict, return a tool error and require fresh chart context.
Use the tool call identity as the retry key. Preserve it across retries of that call.

Use the existing completed chart-change response to refresh the active editor and history list.
Also reload history on open and after restore. No new polling loop or socket channel is required.
If an AI mutation commits and a later tool fails, keep the committed version and report the partial result.

History shows `Name` for manual changes, `Name with AI` for AI changes, and `Former member` when
the user no longer exists. Baseline and system-created rows show no invented actor. Do not store prompts or model names.
Generate summaries from changed field groups, for example `Changed chart type`, `Changed date range`,
`Changed chart data settings`, `Changed chart appearance`, or `Updated chart settings` for mixed changes.
Use `Restored version 3` for restore. Do not call an AI model to write summaries.

## 7. History API and access

Add routes under `/project/:project_id/chart/:chart_id/versions` in the existing chart API:

| Method and suffix | Result |
| --- | --- |
| `GET /?before=<version>` | Latest 25 metadata rows, descending; `nextBefore` and current version |
| `GET /:version` | Saved configuration, summary, date, and restore availability |
| `POST /:version/preview` | Read-only rendering of saved settings with current accessible data |
| `POST /:version/restore` | Restore with `expectedVersion` and `operationId`; return current chart and new version |

List responses omit configuration blobs. Use a positive integer cursor; reject invalid values.
Before the first change on an older chart, GET returns an empty history. Reading must not create a baseline.

Require the existing chart edit permission for history, detail, preview, and restore in this release.
Check that chart belongs to route project and that the version belongs to that chart.
Check binding ownership on mutation routes. Reject cross-chart binding IDs.
Check current access to all referenced datasets before returning saved configuration, preview, or restore.
Return metadata only when a saved dependency is unavailable; do not expose its settings or contents.
Public reports, embeds, share links, and image tokens cannot access version history.
Use current project access after a chart moves. Do not add a new role or entitlement.

## 8. Preview and restore

Preview must not temporarily write old settings to the live chart or create a temporary chart record.
Build a detached chart configuration from the selected version. Resolve current authorized datasets,
apply the saved chart-specific filters, variables, dates, and mappings, then use VisualizationEngine
and the existing client renderer. Reuse current source execution and runtime-filter helpers.

Extract only the render preparation needed from the current refresh flow. The historical path must
not save chart settings, prepared chart results, generated binding colors, alerts, or observation results.
Do not place historical results in the live chart cache. Existing correctly keyed source caches can be reused.
Do not reuse a live prepared chart result when its settings differ from the selected version.
Use current dashboard timezone and shared dataset definitions. Show the actual data freshness state.

The preview banner states `Viewing version 3` and `Saved settings, current data`.
This describes current source state, not a guarantee that the source was refreshed just now.
Changing preview selection must cancel or ignore older responses. Failed preview requests retain the
selected version and show a retry action. Never show another version's chart under the selected label.

Before restore, validate the saved settings, dataset access, visualization, and binding references.
A missing dataset or incompatible saved configuration blocks restore with a useful message.
A temporary source outage can prevent preview without invalidating an otherwise valid restore.
Do not restore missing datasets or change shared queries to make a version work.

Reconcile bindings in the transaction. Update bindings that still belong to this chart in place.
Recreate missing bindings with new IDs and map saved visualization references to them using
`remapVisualizationBindings`. Use explicit matching; reject unresolved references instead of guessing.
Remove bindings absent from the selected version only after checking dependent alerts.
If this would delete or detach an alert, block restore and identify the alert that must be removed first.
Do not silently delete alerts, recreate old alerts, or copy old notification recipients.

Replace every included setting, including cleared values; do not merge old settings over newer leftovers.
Preserve excluded chart fields and shared records. Validate again under the chart lock.
Restoring configuration equal to the current configuration is a no-op. Compare binding contents
and references consistently after remapping; a replacement ID alone is not a user change.
Disable Restore in that state.
After success, return to the current chart and show the new history row. Older rows remain unchanged.

## 9. UI and arrange review

Use existing Chart Studio structure and tokens. Do not import lab CSS or its page shell.
Use installed HeroUI v3 components: Button, ListBox, Modal, and the existing loading/error patterns.
HeroUI ListBox supports single selection, keyboard movement, and selection announcements.
Do not build a custom keyboard list or a second side panel framework.

| Area | Arrangement and behavior |
| --- | --- |
| Entry | Add a secondary `History` action near chart actions. Keep the current Save chart behavior. |
| Left panel | History replaces chat in the same panel. Keep an accessible `Ask AI` action to return. Preserve conversation and composer input. |
| List | Newest first. Use one flat list, with summary above actor/date and `Version N`. Mark the newest row `Current`. Use `Load more` for older rows. |
| Selection | A soft selected fill and explicit selected state. Do not use color alone. The current row returns to the live editor. |
| Preview | Show the banner above the chart. Place `Back to latest` and the primary `Restore version` action together. Keep chart/data views. |
| Settings | Hide editing controls during historical preview. Use the space for the chart preview; keep the summary and date in the history row. No raw JSON or field-by-field diff. |
| Confirmation | `Restore version 3?` Body: `This saves the selected chart settings as a new version. Shared datasets and alerts stay unchanged.` Actions: `Cancel`, `Restore version`. |

Preserve unsaved local input while browsing history. Disable chart save and AI mutation controls during
historical preview. An already running AI operation can finish; it must not replace the historical preview.
Back to latest fetches current state. If local input is now stale, keep it and show the conflict action.
Restoring with unsaved input requires a visible statement that restore discards that input.

Apply these arrange decisions:

- Reuse the 56px panel heading and existing 320px initial panel width, with its 260–440px resize range.
- Use existing 4px spacing steps: 16px list gutters, 12px row padding, 4px between text lines,
  and 8px between related actions. Use 24px between separate detail sections where needed.
- Keep rows left aligned. Let long names and summaries wrap. Do not add nested cards, decorative dots,
  permanent helper paragraphs, redundant badges, or an additional metadata strip.
- At 1600px and above, keep the existing wide preview/results arrangement. At 901–1599px,
  keep Chart/Data tabs. History must not force a narrower chart through an extra right panel.
- At 900px and below, use the existing narrow Studio panel behavior with an accessible HeroUI
  modal surface. Selecting a version closes the overlay so the preview is visible. History reopens
  with selection retained. Wrap preview actions and use natural page scrolling on phones.
- Keep one primary action in historical mode: Restore version. Preserve theme tokens, visible focus,
  44px touch targets, Escape dismissal, focus return, and reduced-motion behavior.
- Use secondary variants for any form controls on primary surfaces. No search field is needed initially.

Required states: loading history; one version; empty older-chart history; load failure with Retry;
preview loading/failure; missing dependency; stale write; restore in progress; restore failure.
Empty older-chart copy: `No earlier versions. History starts with your next saved change.`
Keep essential errors visible. Do not show internal identifiers, storage fields, or stack traces.

Arrange review result: reuse one left panel, preserve chart width, use flat history rows, and keep
restore actions adjacent. Final visual acceptance requires the implemented UI in light and dark
themes at 390, 900, 1280, and 1600px. Check long text, keyboard use, and 200% zoom.
The browser check for this spec covered the lab's desktop history and selected-version view only.

## 10. Implementation order and acceptance checks

1. Add storage and the shared transactional save process. Wire every included manual and AI writer.
2. Add scoped history, detached preview, and restore endpoints. Add conflict and retry handling.
3. Add the History panel and historical preview state to Studio. Keep draft and preview state separate.
4. Run server/client checks and browser review. Do not start a UI dev server unless the user requests it.

Use existing Vitest and Node test tools. Add focused database integration coverage for these cases:

- Manual chart update, binding add/edit/remove, and AI update each capture complete settings once.
- Existing chart gets a baseline; new, copied, template, and temporary charts start separate histories.
- No-op saves, excluded changes, previews, and repeated refreshes create no versions.
- Injected failure between chart and binding writes rolls back both settings and history.
- Concurrent manual/AI writes from the same base allow one commit; the other gets 409.
- A repeated operation ID does not create another version, including restore after a lost response.
- Restore handles deleted/recreated bindings, cleared settings, multiple bindings, and canonical layers.
- Shared datasets, access settings, conversation, and alerts remain unchanged; alert removal blocks restore.
- Historical preview uses saved filters and mappings with current data, with no live chart/cache writes.
- Cross-team, cross-project, cross-chart version/binding IDs, restricted datasets, and public tokens fail.
- Deleted datasets, source outages, and post-commit refresh failure produce the specified recoverable states.
- Pagination has stable order and no duplicate rows when a new version is added.

Client checks cover selection, stale preview responses, conflict input retention, AI completion while
previewing, and return to current state. Use existing chart rendering tests for chart families.
Manually verify list selection, restore confirmation, loading/error states, focus return, and responsive layout.

## 11. Setup and quick verification after implementation

No new environment variables or services are required. Apply the normal database migration:

```sh
npm --prefix server run db:migrate
npm --prefix server run test:integration -- tests/integration/chartVersions.test.js
npm --prefix server run lint
npm --prefix client run test:visualization
npm --prefix client run lint
npm --prefix client run build
```

The integration tests use the existing
isolated test database setup. Run the server's pure tests as well if shared visualization helpers change.

In an existing running app, edit a chart title, change a chart-specific filter, then request an AI change.
Open History and check the saved versions and actors. Preview the earlier settings. Restore them.
Check that restore creates a new version and that the shared dataset remains unchanged.
Open the chart in two tabs and save from both to verify the conflict response.

## 12. Spec review

Reviewed with frontend-design and arrange against `.impeccable.md`, the approved design rules,
the current Studio source, and the running lab. The layout requirements above contain the review result.

Ponytail review scope: the proposed design and implementation work in this spec.
Lean already. Ship.
Implementation review: the shared save path replaces the separate chart and binding write paths.
No new dependencies, flags, queues, or environment variables were added. Removed the unused legacy
`updateDatasets` method and the source-refresh branch inside chart creation transactions.

## 13. Verification results

- Applied the migration to the local development database and an empty, isolated PostgreSQL test database.
- 45 database tests passed across chart history, chart bindings, inline creation, preview placement,
  dashboard layout, and templates. Tests include the 100-version cap, rollback, save conflicts,
  retries, shared dataset preservation, removed binding restore, alert protection, and preview access.
- 52 unit tests passed across client save ordering/retries and related AI chart tools.
- 81 client visualization tests passed. Client and server lint passed; server lint reports existing warnings.
- Client production build passed with its existing bundle-size warning.
- Browser checks passed for manual title changes, a real AI title change, actor labels, preview,
  restore, and chat input retention. The test chart was restored to its original settings.
- Used arrange to check the existing panel structure, spacing, text wrapping, and responsive preview.
  Browser checks covered 390, 900, 1280, and 1600px, with light and dark theme samples.
  Browser zoom at 200% was not tested.

The container test runtime was unavailable. Verification used a separate temporary PostgreSQL
server with the existing test runner. No development data was used by the automated tests.

API clients must send `expectedVersion` from the chart response and a stable `operationId` with
chart, binding, repair, and restore writes. Retry a lost response with the same values. On 409,
load the latest chart before the user repeats the change. Versions removed by the 100-version
limit cannot be restored. Increasing the limit later does not recover removed versions.
