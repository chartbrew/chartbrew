# Chart Studio: editor layout replacement and chart chat

Status: ready for implementation by Sol; implementation has not started under this spec.
Date: 22 September 2026.
Target: `chartbrew-os`.

## 1. Task and controlling rule

Replace the existing chart editor layout with Chart Studio design D. Add a chart conversation panel.
Preserve all existing chart functionality, permissions, defaults, validation, persistence, query behavior,
and entry points. This is a presentation change plus chat, not a new chart editor data model.

**The only new product capability is chat. Do not add, remove, or change any other chart capability.**
The Data view, panel controls, and responsive placement described here are the requested presentation
of existing chart results and settings. They must not introduce new queries, calculations, or mutations.

History is not implemented. A nonfunctional History placeholder is permitted as described in section 9.
Do not implement chart revisions, restore, undo/redo, audit storage, or history APIs.

The user has selected the design direction for this task. Do not repeat the design exploration or ask
for approval of the same direction. Do not copy the lab's simplified behavior into OS.

### Priority when references disagree

1. This task's no-functional-change rule and the user's specific layout decisions.
2. Current `chartbrew-os` behavior, including current uncommitted changes.
3. Design D's layout and approved design-system rules.
4. Earlier design studies, screenshots, and older specs.

If a control is absent from the design sample but exists in the current editor, keep it. If a control
exists only in the sample, do not turn it into a feature. If a conflict cannot be resolved by layout
alone, record the exact conflict and stop only that part. Do not make a product decision silently.

## 2. References and baseline

Paths in this document are relative to the repository root unless stated otherwise.

### Visual reference

- Running lab: `http://localhost:5174/#experiments/chart-studio/final`.
- `../chartbrew-design/src/ChartStudio.jsx`: direction `final`, not A/B/C.
- `../chartbrew-design/src/studio.css`: shared rules and `.studio-final` rules.
- `../chartbrew-design/src/studio.js`: direction definitions and **sample-only** data.
- `../chartbrew-design/DESIGN.md`: theme, typography, surfaces, and section 20.
- `../chartbrew-design/.impeccable.md`: audience and design context.
- `../chartbrew-design/CHART-STUDIO-REVIEW.md`: limitations; its earlier automation proposals are
  superseded by the fourth-direction notes and this spec.

Read the actual reference source if the running lab is unavailable. Do not start a UI dev server
without the user's explicit instruction. Use a running app for browser checks when available.
The experiment navigation, letters A–D, comparison links, sample disclosures, and theme demo controls
are not part of the product editor.

### Source baseline

This spec was checked against the working tree on 22 September 2026, not just committed HEAD.
At the start of the audit, there were existing edits in `ChartDatasetConfig.jsx`, `ChartDatasets.jsx`,
`AiComposer.jsx`, `Chart.jsx`, `ProjectDashboard.jsx`, `InlineChartCreator.jsx`, chart/project routes
and controllers, `chartCreation.js`, and related integration tests. These are existing work. By the final spec check, they were committed in
`d0e29f1e` (`Improve inline chart drafts and fix editor update loop`). That commit is the checked
source baseline; the only uncommitted file from this task is this spec.
Do not reset, overwrite, or replace them with older versions. Run `git status --short` and inspect
relevant diffs before implementation. Recheck source names and behavior if the tree has changed.

### Required source map

| Source | What must remain authoritative |
| --- | --- |
| `client/src/containers/Main.jsx` | Existing `/dashboard/:projectId/chart` and `/dashboard/:projectId/chart/:chartId/edit` routes and parent access/layout. |
| `client/src/containers/AddChart/AddChart.jsx` | Loading, title, draft, Save chart, create-from-dataset flow, chart updates, cache choice, runtime filters, preview refresh, missing-dataset access warnings. |
| `client/src/containers/AddChart/components/ChartPreview.jsx` | Type transitions, accumulation, KPI overlay, growth, gauge ranges, exposed filters, cache and refresh. |
| `client/src/containers/AddChart/components/ChartSettings.jsx` | Chart-wide date, time, missing-value, display, scale, axis, tick, and table pagination controls. |
| `client/src/containers/AddChart/components/ChartDatasets.jsx` | Dataset search/filter, attach, select, reorder, remove selection recovery, create/edit entry points. |
| `client/src/containers/AddChart/components/ChartDatasetConfig.jsx` | Binding mutations, series styles, label/formula, table settings, variables, removal, source links and shared-dataset edit warning. |
| `client/src/containers/AddChart/components/ChartDatasetDataSetup.jsx` | Canonical field/layer editing, map setup, null policy, generated series limits, goals, date field, filters, and repair. |
| `client/src/components/DatasetFilters.jsx` | Existing condition and variable binding controls and their exposure rules. |
| `client/src/components/TableConfiguration.jsx`, `client/src/containers/AddChart/components/TableDataFormattingModal.jsx` | Existing table field, order, grouping, total, and formatting behavior. |
| `client/src/containers/AddChart/components/DatasetAlerts.jsx` | Binding-owned alert configuration, recipients, delivery channels, timeout, enablement, delete, and prerequisites. |
| `client/src/modules/visualization.js`, `client/src/visualization/presetRegistry.js` | Existing field requirements, capability gates, canonical visualization edits and compatibility behavior. |
| `client/src/slices/chart.js`, `client/src/slices/dataset.js`, `client/src/slices/alert.js` | Existing requests, reducers, error/loading state, and IDs. |
| `client/src/containers/Chart/components/ChartRenderer.jsx` and `TableView/` | Existing render implementations, chart table behavior, theme, and responsive chart rendering. |
| `server/modules/preparedSnapshot.js`, `server/visualization/VisualizationEngine.js`, `server/visualization/compilers/shownExport.js` | Existing `render.tabularData`, including values as shown in the chart. |
| `client/src/containers/Ai/` and `client/src/api/ai.js` | Existing chat components, availability, conversation transport, response actions, and error handling. |
| `server/modules/ai/contextAuthorization.js`, `server/modules/ai/orchestrator/rolePolicy.js`, `server/modules/ai/orchestrator/tools/updateChart.js` | Existing AI context authorization, role limitations, and chart-tool behavior. |
| `client/src/containers/ProjectDashboard/components/InlineChartCreator.jsx`, `client/src/api/chartCreation.js`, `server/api/ChartCreationRoute.js`, `server/modules/chartCreation.js` | A separate existing inline creation/refinement flow. Do not confuse it with Ask or replace it. |

Follow applicable `AGENTS.md` files. Before changing AI server code, read
`server/modules/ai/orchestrator/AGENTS.md`. Before changing server code, read `server/AGENTS.md`.
Source plugins and source runtime changes are outside this task; if a real dependency requires one,
read `source-plugin-guide.md` and report the scope conflict before broadening the task.

## 3. Scope boundaries

### Implement

- A new layout for the existing full chart editor using design D.
- Existing controls reorganized into Data, Appearance, and Automation, with their existing scope.
- Existing chart output in a Chart/Data presentation that responds to settings placement.
- A left conversation panel that uses existing Chartbrew AI infrastructure and current-chart context.
- Accessible collapse, expand, resize, tabs, scrolling, and small-screen presentation.
- Tests and a parity report that prove the manual editor still performs the same operations.

### Do not implement

- New chart types, chart semantics, transformations, aggregation rules, formula syntax, date defaults,
  data sources, alert types, delivery channels, dataset ownership, or access rights.
- A new save transaction model, local revision store, generic command bus, or chart state framework.
- A new general AI engine, provider configuration, or natural-language parser.
- A universal AI permission derived from the manual chart-edit permission.
- New refresh schedules, metric watches, collaboration, sharing, export, or publishing systems.
- New source-query editors inside Studio. Keep existing dataset edit destinations.
- Undo/redo, version creation, history comparisons, or restore, including browser-only chart revisions.
- A dashboard-size simulator. The lab's fixed 520 × 280 preview is not an existing editor feature.
- Feature flags, new dependencies, migrations, or environment variables for the layout.
- Changes to the dashboard inline creator, temporary AI preview placement, public charts, shared links,
  embeds, rendered images, or Data API contracts as a side effect of reorganizing the editor.

## 4. Layout and responsive behavior

Use the Workbench composition with the Canvas collapsed left menu. Preserve OS theme and navigation
context. If the parent dashboard shell uses space that the lab does not, adapt the editor container;
do not change global navigation or global dashboard sizing to make a screenshot match.

### Editor regions

1. Top bar: back to the existing dashboard, chart identity/title, existing save state and actions,
   draft control, and optional disabled History placeholder.
2. Left: conversation panel, or a compact rail with an Ask AI action and optional History placeholder.
3. Main: preview toolbar and output.
4. Settings: Data, Appearance, Automation; selected binding remains clear and selectable.

There is no chat button next to Save or Publish. Open and close chat from the left side only.
A mobile left-side toolbar can open the chat drawer. It must remain available when chat is closed.
Closing chat must not clear the draft, transcript, pending response, selected dataset, or manual edits.

### Width rules

Use the same 1600px viewport breakpoint in rendering logic and CSS. Count CSS pixels, not physical
monitor pixels. The 900px breakpoint is the small-screen drawer boundary from the design reference.

| Width | Settings | Preview | Chat |
| --- | --- | --- | --- |
| `>= 1600px` | Right panel, initial width about 384px | Chart above a separate expanded Data/Results table. No Chart/Data tabs. | Left panel or collapsed rail. |
| `901–1599px` | Bottom panel | Chart and Data tabs. Exactly one view is visible. No separate table under the chart. | Left panel or collapsed rail. |
| `<= 900px` | Bottom content in normal page flow | Chart and Data tabs. No separate table. | Accessible drawer opened from the left toolbar. |

Keep a single selected preview-tab state. Switching to wide mode displays both chart and table without
changing that state. Switching back restores the prior Chart or Data tab. The resize itself must not
write chart data, run a query, change chart type, or reset form values.

At wide sizes, chart and table share the main column. Settings align with the preview toolbar at the
top. Give chart and data separate usable scroll areas. Do not stretch the chart to consume the whole
height of a large monitor while hiding the results. At bottom-settings sizes, settings stay reachable
while preview content scrolls; do not place a second results table before the settings.

Use the reference's 56px aligned panel toolbars, 16–24px gutters, and 4px spacing scale. Start the chat
panel at about 320px. Keep its existing reference resize range of about 260–440px. Bottom settings can
expand/collapse and resize within the available height. These dimensions are UI preferences only.
Never save them into `Chart`, a binding, or visualization configuration. Session-local state is enough;
do not add a persisted preference service.

Keep minimum chart height sufficient for the existing responsive renderer. Measure the actual chart
container with the existing resize pattern. Do not pass a hard-coded 300px height to a different-sized
container. Reuse renderer capabilities; do not alter renderer algorithms to fit this layout.

### Visual and accessibility rules

- Use existing HeroUI v3 components and Chartbrew fonts, colors, and radius tokens.
- Use secondary form controls on primary surfaces.
- No eyebrow labels. No subtitles or helper paragraphs that repeat the control.
- Keep required errors, access warnings, and destructive consequences visible.
- Optional explanations can use accessible tooltips. Do not hide critical setup in a tooltip.
- Use one neutral focus outline around the complete chat field. Remove the textarea's separate blue
  underline/shadow only inside this composition. Keep visible keyboard focus elsewhere.
- Do not include sample chat suggestions, “Try a bar chart”, or a prefilled sample conversation.
- Resize controls must support pointer and keyboard use with names and current/min/max values.
- Tabs must have unique accessible labels: `Preview view` versus `Chart settings`.
- The mobile drawer must trap focus, close with Escape, and return focus to its trigger.
- Long titles, field names, series lists, and translations must wrap or scroll without page overflow.
- Do not remount the editor, query owner, or chat session when changing layout or tabs.

## 5. Manual control parity: required inventory

Before moving controls, record the current editor's reachable controls and request behavior against
representative charts. The following is the required starting inventory, not permission to omit a
control added to OS after this spec. Trace each conditional rendering branch, not only a revenue line
chart. For each row, record the old component/handler, new location, and verification evidence.

### A. Chart identity, save, creation, and navigation

| Existing behavior | Studio placement and requirement |
| --- | --- |
| Title edit and submit in `AddChart` | Top bar; preserve actual submission and update behavior. Do not use the lab's blur-save behavior without proving it matches OS. |
| `draft` switch | Top bar; keep the existing field and reverse action. The lab's `published` boolean does not exist as the save contract. Prefer the existing Draft control for this task. |
| `Save chart` / `Chart saved`, loading and error state | Top bar; keep the existing save action and automatic per-control writes. Do not replace it with a fake “Saved” label or a new publish-only commit. |
| New chart from dataset and create-new-dataset redirect | Keep the no-chart-ID route and existing `ChartDescription` flow, initial bindings, run, navigation, and automatic naming. |
| Loading, no bindings, inaccessible datasets | Preserve recovery paths and the project-role “Dataset access required” warning. Do not present a permission failure as an empty dataset. |
| Existing editor links from dashboard and inline creator | Continue to resolve to the same chart ID and dashboard. No duplicate chart creation on entry. |

### B. Preview and chart-wide settings

| Controls to preserve | New grouping |
| --- | --- |
| Refresh chart and Use cached data | Preview toolbar. Same query path and cache default. |
| Exposed runtime filters, selected-filter chips, clear | Preview toolbar/filter popover. Runtime values remain separate from saved defaults. |
| All currently exposed types | Type selector in toolbar. Preserve type/subtype/mode transitions exactly. |
| Average and accumulation | Reachable next to type or in chart Data settings; retain current type gates and transitions. |
| KPI overlay, show growth, invert growth | Chart Appearance; use current preset capability gates. |
| Gauge ranges, labels, colors, add/remove, validation and save | Chart Appearance; no simplified fixed range. |
| Date range and remove range; fixed start/current end | Chart Data/date control, using the existing date selector and date semantics. |
| Time interval from second through year | Chart Data; same options and default. |
| Missing values: preserve gaps or zero, and applicable legacy include-zero behavior | Chart Data; same canonical settings helpers. |
| Point radius, line smoothing, stacking | Chart Appearance; same mark/capability rules. |
| Legend, data labels, percentage/value label format | Chart Appearance; preserve canonical and legacy compatibility writes. |
| Logarithmic scale, dashed last point | Chart Appearance; same visibility gates. |
| Axis min/max, including zero and clear-to-null | Chart Appearance; horizontal charts use the correct axis name and semantics. |
| X-axis label count presets and custom value | Chart Appearance; same apply/clear behavior. |
| Default rows per page for native table charts | Chart Appearance; retain all existing options. |
| Query date-variable format and presets | Chart Data/advanced; keep `{{start_date}}` and `{{end_date}}` behavior. |

Current type controls in `ChartPreview` include line, bar, horizontalBar, avg, kpi, gauge, matrix, map,
pie, doughnut, radar, and polar, plus native table. Preserve any other currently reachable editor path.
Do not add a selector item merely because a renderer registry contains a type; markdown and future
registry entries are not authorization for new editor capabilities. Existing render compatibility must
still work. Map selection currently has a multiple-layer restriction; retain it.

### C. Dataset binding and Data settings

| Controls to preserve | Requirement |
| --- | --- |
| Dataset picker search, This project/All, tags, source identity, empty/loading states | Use the current filtered accessible dataset list. “All” does not bypass access. |
| Attach dataset and create dataset | Same default bindings, color selection, order, refresh, and route behavior. Keep current type restrictions such as map attachment. |
| Select and reorder chart datasets | Keep `cdc.id` identity and persisted order. Do not confuse it with `dataset_id`. |
| Binding label | Same current input/save behavior; changing it must not rename the reusable Dataset. |
| Multiple values/layers, selected value, add/remove | Keep all supported marks and minimum-layer restrictions. Do not collapse everything into one value. |
| Category/time/row/column and value selectors | Use `getLayerFieldRequirements`, field schema, and existing helpers. No four-field revenue-only form. |
| Aggregation | Same available operations and validation for the selected layer. |
| Breakdown and generated-series controls | Preserve field selection, limits, Other grouping, hidden/ordered series, and warnings. |
| Empty categories and empty breakdown values | Preserve exclude/label/preserve choices, custom group labels, and apply behavior. |
| Goal | Preserve save/remove and applicable chart/layer scope. |
| Map display, area, region/location, point mode, coordinate format, lat/long or GeoJSON Point | Reuse actual map setup and manifest; retain field requirements and warnings. |
| Native-table row collection | Keep nested row-path behavior. |
| Date field | Keep separate from display/category fields and preserve dashboard filter integration. |
| Dataset conditions and exposed filter/variable bindings | Use chart-binding conditions. Do not accidentally edit the reusable dataset. |
| Formula add/edit/apply/remove, examples, help, errors | Preserve current formula execution and syntax. Do not replace it with a new calculation language. |
| Restore chart fields | Keep the current repair action when canonical fields are missing. This is repair, not version restore. |
| Remove binding | Preserve confirmation, refresh, selection recovery and last-binding behavior. It must not delete the Dataset. |
| Edit shared dataset and source links | Same permissions, warning, target route, and scope. Do not move source configuration into the chat or chart save. |

### D. Dataset Appearance

Retain all branches in `ChartDatasetConfig`, including canonical and compatibility branches:

- Binding color, line/fill settings and fill opacity.
- Multi-fill/category/slice colors and current palette behavior.
- Generated-series search, colors, visibility and order, using stable series/layer identity.
- Chart-type-specific controls and capability gates; do not show every option for every chart.
- Sort ascending/descending/clear, max records apply/reset.
- Native table configuration: field exclusion, column ordering, grouping, totals, and formatting.
- Dataset label, formula, and relevant source actions remain reachable even if their placement changes.

Chart-wide Appearance and selected-binding Appearance must be visually distinct through headings and
spacing. Do not let a selected binding change a chart-wide setting's scope. No eyebrow is needed.

### E. Automation

Automation contains exactly the existing editor features:

1. `DatasetAlerts` for the selected chart binding.
2. Variables from that dataset, with chart-binding values/overrides.

Preserve alert list/create/edit/delete; milestone, above/below/between/outside threshold and anomaly
options where currently supported; threshold validation; email recipients and existing integration
channels; refresh/create-integration entry points; timeout units; one-time alerts; active state;
loading/errors; role-based recipient filtering; and the existing automatic-update prerequisite warning.

Preserve variable default display, save value, reset unsaved input, remove saved override, and the
no-variables state. Do not display the lab's “No variables” state for a dataset that has variables.

Do not add dashboard refresh schedules or a separate watched-metric control here. Those features have
other owners. Do not remove their existing controls from those other locations. The alert prerequisite
warning remains necessary even though schedule editing does not move into Studio.

## 6. State, requests, and rendering

### Preserve the current write boundary

`AddChart._onChangeChart` currently dispatches `updateChart` for individual changes. It distinguishes
refresh-data and refresh-preview paths and treats title changes separately. `ChartDatasetConfig` has
its own binding and visualization update handlers. Keep those operations and the existing reducers.

Refactor presentation around them before changing ownership. Small component extraction is allowed
when needed to place controls. Do not create a second copy of chart settings in Studio and synchronize
it through competing effects. Keep the existing canonical visualization helpers and legacy
compatibility path. Never replace a full visualization object with a reduced object from the lab.

On any manual operation, compare the resulting payload and stored fields with the baseline. Chart ID,
binding IDs, dataset IDs, all unrelated layer settings, alert resources, and shared datasets must stay
unchanged unless that same existing operation changes them today.

Keep current invalid-input handling and explicit Apply/Save buttons. A layout-only remount must not
submit a form. Preserve local unfinished values when switching tabs, resizing, or opening chat.
Do not remove the current missing-dataset fetch guard; its comment documents a previous remount loop.

### Refresh and filters

Keep `runQuery` and `runQueryWithFilters` semantics, including `noSource`, `skipParsing`, `getCache`,
and runtime filter/variable handling. Do not turn changing tabs or moving panels into a refresh.
Preserve cancellation/stale response protection where present. Do not change source query execution,
timezone handling, cache invalidation, or dashboard filter behavior.

### Data view: use the existing output

The authoritative input is `chart.render.tabularData` from the **same current render response** as the
chart. `preparedSnapshot.buildRenderEnvelope` already includes it. No new results endpoint is needed.

- `VisualizationEngine` uses native table configuration for a table preset and `compileShownExport`
  for ordinary charts. Ordinary output is an object of named tables containing row-object arrays.
- The existing native table shape can contain `columns` and `data`. Handle both actual shapes.
- `TableContainer` expects native table configuration and indexes datasets; do not pass every generic
  shown-export array into it without adapting the shape and table identity.
- `QueryResultsTable` is currently used by source query builders, not by `AddChart`. It expects a JSON
  string and has different data semantics. Do not make it the source of truth for chart results.
- Use existing HeroUI table/pagination components. Add only a small presentation adapter if required.
  It must not aggregate, filter, sort, round, rename, or re-query the data as a side effect.
- Preserve zero, false, empty string, null, row order, column order, and multiple named results.
  Do not use `value || ""` for cell values. Distinguish empty results from unavailable results.
- For several named tables, keep each accessible with its real name. Do not invent a one-to-one
  binding mapping from the table title or use the sample's single Revenue dataset.
- Show current results as provided by the server. Keep any existing stale/loading/error treatment
  coherent with the chart; do not combine rows from an earlier filter response with a newer chart.
- Data view is read-only. It must not set `chart.type = "table"` or change native table settings.
- No source-data mode, export button, query editor, new data API key, or raw source payload is added.

## 7. Chat: the only new capability

### Integration choice

Use the existing Ask conversation path as the initial Studio conversation implementation:
`useAiChat`, `respondAi`, existing transcript/action components, `AiComposer`, and AI availability.
Do not copy the lab's regex-based bar/line replies or preloaded messages.

Bind the conversation to the current authenticated team and exact chart context, using the existing
context shape `[{ entity_type: "chart", id: chart.id }]`. The server must resolve and authorize the
entity through the current context-authorization path. Do not trust a client-supplied chart snapshot,
source credentials, or prompt text as authorization. A fixed “This chart” context indication is enough;
do not add a global context picker to this editor as part of the task.

Do not introduce a separate planner, chat endpoint, or new mutation tools. Preserve current Ask tool
availability and confirmation rules. Reuse existing pending-action UI when the server actually returns
one; do not impose a new confirmation step on every manual chart edit or claim every AI write has one.

### Important limits in the current tree

The two existing AI paths are not interchangeable:

- `useAiChat` uses `/ai/respond`. `rolePolicy.js` currently limits project-editor Ask sessions; manual
  chart-edit access does not grant unrestricted Ask chart/source mutations. Keep those limits.
- The inline creator uses chart-scoped `/refinements`, `expectedVersion`, request IDs, status polling,
  and cancellation. `chartCreation.js` rejects multiple-binding refinement and has its own access
  policy. Do not send all Studio changes through it, replace its existing UI, or fall back to it to
  bypass an Ask denial.
- `tools/updateChart.js` has a default `spec` and can locate a first matching binding. A tool named
  `update_chart` is not proof that a sparse request preserves every existing field or uniquely selects
  a binding. Inspect this path before claiming safe chart editing in Studio.

The new panel may use only existing authorized operations. Unsupported or ambiguous requests must
produce a clear response and leave the chart unchanged; manual controls remain available. Do not add
new multi-binding AI editing, shared-dataset editing, or role grants to satisfy a chat example.
If the existing tool path would reset unrelated settings, treat that as a blocking integration defect,
not permission to ship the reset. Apply only the smallest necessary preservation/scoping fix with a
regression test, or report the specific unsupported operation. Do not broaden the AI subsystem.

### Interaction and lifecycle

- Start with an empty transcript and a plain composer. No prompts, sample recommendations, or fake
  assistant analysis. Use a concise placeholder such as “Ask about this chart…”.
- Reuse current AI enablement/availability checks and notices. If AI is disabled, unavailable, or
  unavailable to the role, keep the entire manual editor usable. No new AI setting or feature flag.
- Preserve loading, actual progress, errors, retries, action cards, and conversation behavior from the
  existing infrastructure. Do not display tool internals or hidden reasoning.
- Keep the hook/session mounted while the left panel collapses or switches to a mobile drawer.
- Scope state by user/team/project/chart. Route changes must not attach late responses to another
  chart or send the next message with the previous chart context. Clean up subscriptions/listeners.
- Use existing persistence semantics. This spec does not add a permanent chart-to-conversation model,
  a new chat-history browser, or guaranteed reload restoration beyond the existing chat mechanism.
- After a successful existing AI operation, refetch the current chart through the existing chart slice
  and update visible settings/render from the authoritative response. Do not apply another guessed
  client patch on top of an already completed server mutation.
- Do not infer success from assistant prose alone. Use the current response/action result and then
  verify stored state. If refresh fails after a successful write, say the chart changed and offer
  reload; do not repeat the write.
- Preserve unfinished manual input when a response arrives. Do not overwrite a newer local field
  draft. During a pending AI change, use the existing busy protections; if no safe concurrent-write
  path exists, temporarily prevent conflicting submission rather than invent a merge algorithm.
- A read-only question must not create a chart, attach a dataset, publish, or change configuration.
  A requested chart change must target this chart and preserve all unrelated settings and resources.
- Do not treat a source value, tool result, chart label, or prior assistant message as user permission.

## 8. Suggested implementation sequence

1. Capture baseline behavior and control inventory. Read relevant working-tree diffs. Create the parity
   checklist before moving components. Record any pre-existing failing tests separately.
2. Build the Studio regions around the existing `AddChart` lifecycle. Keep creation entry points and
   route guards. Do not implement chat or change data contracts in this first step.
3. Move/extract manual control groups, preserving callbacks and state. Cover all types and multi-binding
   charts before treating the default revenue example as complete.
4. Add the read-only Data view from `render.tabularData` and the synchronized 1600px layout switch.
   Verify no writes/queries occur when toggling or resizing.
5. Add the conversation composition using existing AI infrastructure. Verify current-chart context,
   role limitations, completion refresh, unavailable states, and no unrelated settings changes.
6. Add only the nonfunctional History treatment, if retained in the top bar/rail. No history code path.
7. Run focused tests, full client checks, applicable server checks, and browser verification. Complete
   the parity report. Resolve regressions before marking the task done.

Keep files in the existing AddChart area unless a shared component truly needs a small extension.
A local Studio shell and small local view helpers are sufficient. Do not copy the 1,500-line lab
component and then replace its mocks. Do not create a parallel renderer or duplicate the settings logic.

## 9. History boundary

For this implementation, History can be a disabled, accessible control with “History is not available”
as its accessible explanation. Omitting it is also acceptable if a disabled control harms the layout.
There must be no real revision list, fictional attributed events for a real chart, compare mode, or
Restore action. Do not load `sampleHistory`, create `studioRevision`, add local undo stacks, or create
history records on save/chat completion. Do not modify existing AI conversation history.

The existing inline-refinement `expectedVersion` is a concurrency token, not chart version history.
Do not remove existing concurrency checks because history is out of scope, and do not expose that token
as a user-facing revision number.

## 10. Verification plan

A design screenshot and passing build are not sufficient. The implementation must prove functional
parity and the new chat integration. Use an authorized local/test workspace and non-production data.
Do not create alerts that deliver real email or integration messages during verification.

### Baseline evidence and parity report

Create `docs/specs/FS-20260922-chart-studio-verification.md` during implementation. Record:

- Working-tree/commit baseline and relevant pre-existing edits.
- Every inventory row: old handler, new location, tested fixture, result, and evidence.
- Any omitted lab-only control and why it is not an OS feature.
- Commands run, results, warnings, pre-existing failures, and unverified conditions.
- Before/after persisted chart and binding comparisons for representative edits, with sensitive data
  removed. Compare semantic configuration, not generated timestamps/cache metadata.
- Screenshots at the required sizes and themes, with paths or links.
- No-history and no-extra-feature review, and final changed-file list.

Do not mark an untested behavior as passed. A server or test-database limitation must be explicit.
Do not use it to hide incomplete manual parity.

### Required fixtures

Use current tests/fixtures and seeded accessible records where possible:

1. Time-series line with two bindings, multiple values, breakdown, generated-series styling, a formula,
   a non-default date range, and exposed filter/variable values.
2. Bar and horizontal comparison charts with stacking/axis settings where supported.
3. Average/accumulated chart; KPI with growth/inversion; gauge with multiple ranges.
4. Pie/doughnut and radar/polar to check category colors and type-dependent controls.
5. Matrix and maps: region mode, coordinate fields, GeoJSON Point, and invalid/unmatched locations.
6. Native table with nested rows, excluded/reordered columns, formatting, sorting, limit, and totals.
7. Empty data, null/zero/false values, missing canonical fields, loading, failed query, stale data,
   inaccessible dataset, long labels, and several named result tables.
8. AI enabled/disabled/unavailable; team owner/admin, project-scoped editor, denied project/viewer
   access, and another team's chart ID.

Do not create new capabilities to manufacture a fixture that the current app cannot configure.

### Focused automated checks

Add tests for new behavior and risky seams, using existing test tools. Do not add a new test framework.

- Responsive presentation: at 1599px there are Chart/Data tabs and no expanded table; at 1600px there
  is one chart and one expanded table, with no preview tabs. Transition back restores selected tab.
- Data adapter, if introduced: both actual payload shapes, multiple named tables, row/column order,
  zero/false/null/empty string, empty/unavailable payload, and no mutation of its input.
- Manual relocation: representative chart, binding, layer, variable and alert actions call the same
  existing operations with the same payload. Include a clear-to-null and a zero-value case.
- Mount/layout/tab changes cause no writes and no extra source runs. Query owners are not duplicated.
- Chat context uses the exact active chart; old-chart responses cannot affect a new route; collapse
  preserves draft/session; failures do not show success or repeat completed writes.
- Read-only AI question leaves persistent records unchanged. Supported chart change affects only the
  requested fields on the target chart. Seed non-default unrelated settings to detect resets.
- Unauthorized AI mutation and cross-team context are rejected by the server. The client does not
  substitute the inline-refinement endpoint to bypass the rejection.
- Native table settings continue to use the original table configuration, not the Data-view adapter.

Prefer integration tests around observable behavior and existing handlers. Do not test CSS text or
mock an operation so completely that its real payload/permission behavior is never exercised.

### Existing command baseline

From repository root:

```sh
npm --prefix client run lint
npm --prefix client run test:visualization
npm --prefix client run test:ai
npm --prefix client run build
```

Run new client tests explicitly if the current scripts do not include them. Add them to the appropriate
existing test script so a future run cannot silently skip the new coverage. The default `client test`
script currently runs visualization tests only.

For changed server code, use applicable existing suites:

```sh
npm --prefix server run lint
npm --prefix server run test:pure
npm --prefix server run test:database -- tests/integration/chartController.cdcBindings.test.js tests/integration/aiContext.test.js tests/integration/inlineChartCreation.test.js tests/integration/chartRoute.publicAccess.test.js
```

Check `server/vitest.test-groups.js` and the current Vitest configurations when choosing tests; some
unit-named tests require a database. Add focused AI tests for any tool scoping/preservation change.
Relevant current pure coverage includes visualization helpers, shown/prepared/tabular output,
compatibility updates, runtime filters, and rendering. Relevant integration coverage includes binding
updates, AI context authorization, inline creation/refinement, preview placement, and public access.
Do not change expected outputs to accept a regression.

Database suites use an isolated test database and may start containers. Read
`server/docs/agents/testing-guide.md`. Never point `CB_TEST_DB_REUSE=1` at a development or production
database: the tests clean/truncate tables. Keep existing environment setup; no Studio environment
variable is needed. No UI dev server needs to be started for command-line checks.

### Browser acceptance script

Use the existing running OS and lab tabs. Keep the browser test independent from CSS source inspection.

1. Open an existing chart via its dashboard. Confirm correct ID/title, data, bindings, and saved state.
2. At 1280 × 800, test Chart → Data → Chart. Confirm the table replaces the chart and settings remain
   at the bottom. Select Data, resize to 1920 × 1080, then return: both views appear wide, and Data
   selection returns narrow. Repeat at 1599/1600px and at 2560 × 1440.
3. Check 390 × 844 and a short laptop viewport. No horizontal page overflow; tables can scroll within
   their region; all controls remain reachable. Repeat representative states in dark mode.
4. Collapse/open chat through the left controls. Test keyboard focus, Escape, drawer return focus,
   resize handles, and composer focus. There is no top-right chat button or suggested prompt.
5. Walk every control-inventory row on the relevant fixture. Reload after persisted changes. Confirm
   values, generated series, ordering, alerts and variable overrides survive as before.
6. Change chart type through all currently available families. Verify capability gates, type transitions,
   preview, and table data. Data tabs must never persist a chart-type change.
7. Attach/reorder/remove bindings, switch active values, edit a shared dataset through its existing
   warning/route, and test a denied dataset. Confirm no shared resource is accidentally changed.
8. Test refresh with cache on/off, configured dates, exposed runtime filters, and reset. Compare chart
   and Data output from the same response. Resize/tab changes must not issue source queries.
9. Test AI disabled and failed availability while manually editing. Test a real supported chat question
   and a supported change with deterministic test coverage. Confirm server state, preview, and controls
   agree. Test a role-denied change, ambiguous multi-binding request, and network failure.
10. Visit existing dashboard, inline editor, AI preview, shared and embedded chart paths. Confirm no
    regression from extracted components, styles, or AI hook changes.

## 11. Completion criteria and handoff

The task is complete only when:

- Design D is the full-editor layout, with the exact bottom-tab/right-expanded-table behavior.
- Every existing editor control is reachable with the same scope and behavior, including advanced
  cases absent from the sample. Manual editing works without AI.
- Chat is real, scoped to the current chart, uses existing authorized infrastructure, and has verified
  error/lifecycle behavior. No fake responses or new general AI capabilities are present.
- History is nonfunctional or absent. No revisions, undo/redo, or restore are implemented.
- Existing create, save, draft, dataset, alert, query, render, access, and public-view contracts are intact.
- The parity report contains evidence and honestly states any environment limits.
- Lint, relevant tests, production build, and browser checks pass, or a specific pre-existing failure is
  documented with evidence and not incorrectly reported as a passing check.
- The final response links the implementation and verification report and gives a short run/check guide.
  No setup changes should be required beyond existing OS and AI configuration.

Do not commit or push unless requested. If requested, run the required `/ponytail-review` on the exact
staged/outgoing diff before each commit or push. Do not use `--no-verify`.
