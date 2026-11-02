# Chart Studio verification

Date: 22 September 2026

## Result

Chart Studio now replaces the full chart editor layout. It uses the existing chart editor handlers and the existing Ask conversation path. The Data view reads the current `chart.render.tabularData` value. It does not run a query or change the chart type.

The automated client and server checks pass. Browser checks pass for the available bar chart. The full manual fixture matrix in the specification was not available in the local workspace. This report does not mark those manual cases as passed.

## Baseline

- Baseline commit: `d0e29f1e9a7d9b25ba13b9f463504a81f2730f48`.
- Baseline subject: `Improve inline chart drafts and fix editor update loop`.
- Baseline date: 22 September 2026, 12:09:07 +0700.
- The only untracked file at the start was `docs/specs/FS-20260922-chart-studio.md`.
- The implementation did not reset or replace the baseline work.
- No branch, commit, or push was made.

## Evidence labels

- **Source**: The existing handler and request path were traced in the changed source.
- **Unit**: A focused unit test covers the result.
- **Integration**: An existing server integration suite covers the request or access boundary.
- **Browser**: The running local application was checked without starting a new development server.
- **Not run**: The required fixture or safe external service was not available for a manual change.

## Available fixtures

| Required fixture | Available evidence | Result |
| --- | --- | --- |
| Two-binding time-series line with formula, breakdown, generated series, dates, filters, and variables | Existing visualization unit tests cover canonical fields, formulas, breakdowns, generated series, goals, dates, and map fields. No matching local browser chart was available. | Unit passed. Full browser case not run. |
| Bar and horizontal comparison | Local chart `4740`, `Visits in the last 30 days`, was a bar chart with one binding. Horizontal transition has existing visualization coverage. | Browser layout passed. Type changes were not saved. |
| Average, accumulated, KPI, and gauge | Existing transition and preset tests cover average, KPI restore, gauge layout, and type gates. | Unit passed. Full browser case not run. |
| Pie, doughnut, radar, and polar | Existing visualization and ECharts tests cover doughnut and radar behavior. | Unit passed. Full browser case not run. |
| Matrix and map variants | Existing visualization and orchestrator map tests cover map requirements, region maps, coordinate requirements, and matrix rendering. | Unit passed. Full browser case not run. |
| Native table with nested rows and formatting | Existing visualization tests cover row-path clearing and table capabilities. The new adapter test covers native `{ columns, data }` output. | Unit passed. Full browser case not run. |
| Empty, false, zero, null, long, failed, inaccessible, and several named results | The new adapter test covers empty output, unavailable output, false, zero, null, empty string, column order, row order, and several named tables. Mobile browser checks used a long title. | Unit and partial browser checks passed. Failed query and denied dataset browser cases were not run. |
| AI role and availability cases | Existing AI client tests and `aiContext` integration tests cover availability and authorization paths. | Automated checks passed. No real AI message was sent in the browser. |

## A. Identity, save, creation, and navigation

| Existing behavior | Old owner or handler | Studio location | Fixture and result | Evidence |
| --- | --- | --- | --- | --- |
| Title edit and submit | `AddChart._onNameChange`, `AddChart._onSubmitNewName`, `_onChangeChart` | Top bar title field | Chart 4740 showed the correct title. No persisted title change was made. | Source, Browser |
| Draft switch | `AddChart` switch and `_onChangeChart({ draft })` | Top bar | The current Draft control was visible. It still calls the same handler. It was not changed in the browser. | Source, Browser |
| Save chart, saved state, loading, and error | `AddChart._onChangeChart` and the existing slice state | Top bar | `Chart saved` was visible. No fake save state was added. Error state was not forced. | Source, Browser |
| Create from dataset and create dataset | `AddChart._onCreateFromDataset`, `_onCreateDataset`, `ChartDescription` | Existing no-chart route before Studio | The pre-chart branch is unchanged. | Source, Not run |
| Loading, no bindings, and inaccessible datasets | Existing AddChart guards and missing-dataset alert | Before or above the Studio shell | The route-ID loading guard was made stricter. The missing-dataset guard and warning remain. | Source, Not run |
| Dashboard and inline editor links | Existing `/dashboard/:projectId/chart/:chartId/edit` route | Same route and back action | Chart 4740 opened with the same ID and dashboard context. | Source, Browser |

## B. Preview and chart-wide settings

| Existing control | Old owner or handler | Studio location | Fixture and result | Evidence |
| --- | --- | --- | --- | --- |
| Refresh and cache | `ChartPreview._onRefreshData`, `changeCache` | Preview toolbar | Both controls were visible. They were not used, so no source query was added during layout checks. | Source, Browser |
| Runtime filters and chips | `ChartPreview._onAddFilter`, `_onClearFilter`, `ChartFilters` | Preview filter popover | The same controls and callbacks remain. The bar fixture had no exposed filter. | Source, Not run |
| All exposed chart types | `ChartPreview._onChangeChartType` | Type toolbar | The same line, bar, horizontal bar, average, KPI, gauge, matrix, map, table, pie, doughnut, radar, and polar actions remain. Map keeps its multi-layer restriction. | Source, Browser visual check; changes not run |
| Average and accumulation | `_onChangeChartType`, `_toggleAccumulation` | Type toolbar | Existing transitions are unchanged. | Source, Unit |
| KPI overlay and growth | `ChartPreviewAppearance` handlers | Chart Appearance | The controls use the existing preset gates and `_onChangeChart`. | Source, Unit; browser placement checked |
| Gauge ranges | `ChartPreviewAppearance._onSaveRanges` and range handlers | Chart Appearance | Add, remove, label, color, overlap, empty, and min/max rules remain. | Source, Not run |
| Date range and removal | `ChartSettings._onChangeDateRangeNew`, `_onRemoveDateFiltering` | Chart Data | Existing date controls remain mounted. Mobile width was checked. | Source, Browser visual check |
| Time interval | `ChartSettings` interval select | Chart Data | Existing values remain unchanged. | Source, Browser visual check |
| Missing values and include zero | `ChartSettings` existing `onChange` writes | Chart Data | Existing helpers and values remain. | Source, Unit |
| Point radius, smoothing, and stacking | `ChartSettings` capability gates and `onChange` | Chart Appearance | Same gates and handlers remain. | Source, Unit |
| Legend and data labels | `ChartSettings` and canonical visualization writes | Chart Appearance | Same canonical and compatibility writes remain. | Source, Unit |
| Log scale and dashed last point | `ChartSettings` capability gates | Chart Appearance | Same visibility gates and writes remain. | Source, Unit |
| Axis min/max and clear | `ChartSettings` local min/max inputs and `onChange` | Chart Appearance | Zero checks and clear-to-null code remain unchanged. | Source, Unit coverage for zero semantics; browser change not run |
| X-axis label count | `_onChangeTicks`, `_onConfirmTicksNumber` | Chart Appearance | Preset, custom, apply, and clear code remain unchanged. | Source, Not run |
| Native table rows per page | `ChartSettings` table row options | Chart Appearance | Existing options remain. | Source, Not run |
| Query date-variable format | `_onChangeDateFormat` and existing presets | Chart Data | Existing `start_date` and `end_date` behavior remains. | Source, Not run |

## C. Dataset binding and Data settings

| Existing control | Old owner or handler | Studio location | Fixture and result | Evidence |
| --- | --- | --- | --- | --- |
| Dataset search, scope, tags, identity, empty, and loading | `ChartDatasets._filteredDatasets` and existing picker | Data | The picker is shown only in Data. It still reads the same accessible dataset selector. | Source, Browser visual check |
| Attach and create dataset | `ChartDatasets._onCreateCdc` and existing create route | Data | Default bindings, color, order, refresh, and route code are unchanged. | Source, Not run |
| Select and reorder bindings | Existing draggable list and `_onReorderCdc` | Selected dataset area in all sections | The list keeps `cdc.id` identity and remains mounted. | Source, Browser single-binding check |
| Binding label | `DatasetLabelField` and `_onUpdateCdc` | Selected dataset Data | The existing save handler remains. | Source, Browser visual check |
| Multiple values and layers | `ChartDatasetDataSetup` | Selected dataset Data | The canonical editor is reused without a new field model. | Source, Unit; multi-value browser case not run |
| Category, time, row, column, and value | `ChartDatasetDataSetup` and `getLayerFieldRequirements` | Selected dataset Data | Existing field requirements and selectors remain. | Source, Unit |
| Aggregation | `ChartDatasetDataSetup` | Selected dataset Data | Existing operations and validation remain. | Source, Browser visual check |
| Breakdown and generated series | `ChartDatasetDataSetup`, existing series handlers | Data and selected dataset Appearance | Limits, hidden series, order, colors, and warnings remain. | Source, Unit |
| Empty category and breakdown values | `ChartDatasetDataSetup` | Selected dataset Data | Existing exclude, label, and preserve writes remain. | Source, Unit |
| Goal | `ChartDatasetDataSetup` | Selected dataset Data | Existing layer-scoped save and remove actions remain. | Source, Unit |
| Map setup | `ChartDatasetDataSetup` and map manifest | Selected dataset Data | Region, point, coordinate, and GeoJSON field rules remain. | Source, Unit |
| Native-table row collection | `ChartDatasetDataSetup` | Selected dataset Data | Existing nested row-path behavior remains. | Source, Unit |
| Date field | `ChartDatasetDataSetup` | Selected dataset Data | The separate date field remains. | Source, Unit |
| Conditions and exposed bindings | `DatasetFilters` | Selected dataset Data | The existing chart-binding condition controls remain. | Source, Not run |
| Formula | `FormulaControl` and formula handlers | Selected dataset Data | Add, edit, apply, remove, examples, help, and errors remain. | Source, Unit |
| Restore chart fields | Existing repair action in `ChartDatasetDataSetup` | Selected dataset Data | The repair action remains. No history restore was added. | Source, Not run |
| Remove binding | `ChartDatasetConfig._onRemoveCdc`, `ChartDatasets._onRemoveCdc` | Selected dataset Data | Existing confirmation, refresh, and selection recovery remain. | Source, Not run |
| Edit shared dataset and source links | `_onEditDataset` and existing links | Selected dataset Data | Existing permission, warning, and route code remain. | Source, Not run |
| Binding ID and dataset ID scope | Existing selectors and mutation handlers | All selected dataset sections | The Studio shell passes the existing chart and active binding. It adds no binding copy. | Source, Integration |

## D. Dataset Appearance

| Existing branch | Old owner or handler | Studio location | Fixture and result | Evidence |
| --- | --- | --- | --- | --- |
| Binding color, line, fill, and opacity | `_onChangeDatasetColor`, `_onChangeFill` | Selected dataset Appearance | Existing handlers remain. | Source, Unit |
| Multi-fill and category colors | `_onChangeMultiFill`, `_onChangeFillColor` | Selected dataset Appearance | Existing palette behavior remains. | Source, Unit |
| Generated-series search, color, visibility, and order | `_onChangeSeriesColor`, `_onToggleSeries`, `_onMoveSeries` | Selected dataset Appearance | Stable series and layer identities remain. | Source, Unit |
| Type-specific controls | Existing `hasDatasetEditorTab` and capability gates | Selected dataset Appearance | The section is hidden when the existing type has no Display tab. | Source, Unit |
| Sort and max records | Existing update handlers | Selected dataset Appearance | Apply, reset, and clear actions remain. | Source, Not run |
| Native table configuration | `_onUpdateTableConfig`, `TableConfiguration`, formatting modal | Selected dataset Appearance | Exclusion, order, grouping, totals, and formatting use the original components. | Source, Unit; browser case not run |
| Label, formula, and source actions | Existing `ChartDatasetConfig` controls | Data or Appearance, based on the existing tab owner | No duplicate editor was added. | Source, Browser partial check |

Chart-wide Appearance and selected dataset Appearance use separate bordered groups and headings. Browser checks confirmed both groups at 1280 px.

## E. Automation

| Existing behavior | Old owner or handler | Studio location | Fixture and result | Evidence |
| --- | --- | --- | --- | --- |
| Alert list, create, edit, delete, thresholds, anomaly rules, recipients, channels, timeout, one-time mode, active state, errors, roles, and prerequisite warning | Existing `DatasetAlerts` | Selected dataset Automation | The original component and binding are reused. No alert was created because it could send a real notification. | Source, Browser visual check; mutation not run |
| Dataset variables, default value, save, reset, remove override, and empty state | `_onSaveVariableValue`, `_onClearVariableOverride`, existing local input reset | Selected dataset Automation | The original controls and chart-binding writes are reused. The local fixture had no safe variable change. | Source, Browser visual check; mutation not run |

No dashboard schedule or watched-metric control was added.

## Data view

- `ChartDataView` reads only `newChart.render.tabularData` from the same render object as the chart.
- `normalizeChartTables` supports ordinary named row arrays and native `{ columns, data }` tables.
- It keeps table names, row order, column order, zero, false, empty string, and null.
- It does not sort, filter, aggregate, round, rename, mutate, or run a query.
- It uses HeroUI Table, Tabs, and Pagination. The page size is 25 rows.
- Several named tables stay available by their server names.
- Empty output and unavailable output have different states.
- At 1599 px, Chart and Data are exclusive tabs. At 1600 px, chart and data are both visible.
- The selected narrow tab is kept while the viewport is wide. It is restored when the viewport becomes narrow again.

The focused adapter and responsive tests pass.

## Chat

- `ChartStudioChat` uses the existing `useAiChat` hook and `AiChat` component.
- The context is exactly `[{ entity_type: "chart", id: chartId }]`.
- State is keyed by the current user, team, project, and chart.
- The composer says `Ask about this chart…` and shows `This chart`.
- No sample prompt or fake transcript was added.
- The chat component stays mounted when its panel is closed.
- Browser checks confirmed that a draft survived close and open.
- The mobile drawer traps focus, closes with Escape, and returns focus to the Ask AI button.
- Pointer and keyboard resize paths are present. Keyboard checks changed the panel values by 20 px.
- A completed `update_chart` action for the active chart calls the existing chart fetch. A result for another chart does not do this.
- A refresh failure shows an error and does not repeat the write.
- The existing availability and role checks remain in the shared AI components.
- No inline-refinement endpoint or new AI endpoint is used.

No real AI request was sent during the browser check. Disabled AI, role denial, multi-binding ambiguity, and network failure were covered only by existing automated access and AI tests where available.

## AI sparse-update safety

The existing `update_chart` tool applied a default specification when `spec` was absent. A sparse name update could therefore reset unrelated chart fields. The tool now uses an empty object when `spec` is absent.

The focused regression uses these unrelated non-default fields:

```json
{
  "displayLegend": false,
  "includeZeros": false,
  "pointRadius": 8,
  "stacked": true
}
```

The update request changes only the name. The tested database update payload is:

```json
{
  "name": "Renamed"
}
```

The test confirms that the tool reports only `name` as an updated chart field.

## Browser checks

The running local application at `http://localhost:4018` was used. No UI development server was started.

| Viewport and theme | Check | Result |
| --- | --- | --- |
| 1280 × 800, dark | Bottom settings, Chart/Data tabs, chat open and closed, Data table, Data/Appearance/Automation sections | Passed |
| 1599 px wide, dark | Tabs shown, one preview view, selected Data state after return from wide mode | Passed |
| 1600 × 900, dark | No preview tabs, chart and table visible, 384 px right settings | Passed |
| 2560 × 1440, dark | Chart, data, and right settings stay visible with usable regions | Passed |
| 390 × 844, dark | Left Ask AI rail, drawer focus and Escape, title, type toolbar, chart resize, internal control scrolling | Passed |
| 390 × 844, dark, final | `document.documentElement.scrollWidth` was 390 px at a 390 px viewport | Passed |
| 1280 × 800, light | Theme surfaces and borders | Passed |

The browser tool attached the screenshots to this task. It did not provide stable file paths, so this report has no repository screenshot links. A 1920 × 1080 capture was not made. The 1600 and 2560 wide states were checked instead.

## Persistence and request comparison

- Browser checks did not change persisted chart, binding, alert, dataset, or variable data.
- Manual Studio controls still call the original chart, binding, visualization, alert, and variable handlers.
- Layout changes, tab changes, chat close/open, and viewport changes did not call a new write or query path.
- The server sparse-update regression proves that an AI name change writes only `{ name: "Renamed" }` when `spec` is absent.
- The database suites passed for binding updates, AI context access, inline chart creation, and public chart access.
- A full before-and-after database comparison for every required manual fixture was not possible because those seeded fixtures were not available in the local browser workspace.

## Commands

| Command | Result |
| --- | --- |
| `npm --prefix client run lint` | Passed |
| `npm --prefix client run test:visualization` | Passed: 79 tests |
| `npm --prefix client run test:ai` | Passed: 20 tests |
| `npm --prefix client run build` | Passed |
| `npm --prefix server run lint` | Passed with existing warnings in unrelated tests |
| `npm --prefix server run test:pure` | Passed: 1159 tests in 116 files |
| Focused `server/tests/unit/orchestratorMaps.test.js` | Passed: 7 tests |
| `npm --prefix server run test:database -- tests/integration/chartController.cdcBindings.test.js tests/integration/aiContext.test.js tests/integration/inlineChartCreation.test.js tests/integration/chartRoute.publicAccess.test.js` | Passed: 44 tests in 4 files |
| `git diff --check` | Passed before the final report; run again at handoff |

The first database test attempt could not reach Docker from the restricted environment. The same command passed with local machine access. NPM reports an existing unknown `python` config warning. The production build reports the existing large chunk warning.

## Scope review

- History is omitted. No history, revision, restore, undo, or redo code exists.
- Lab navigation, A-D labels, comparison links, sample data, theme demo controls, fake chat replies, and sample suggestions are omitted.
- No feature flag, dependency, migration, environment variable, endpoint, renderer, query path, source editor, dashboard schedule, export control, or raw-data mode was added.
- Public charts, shared links, embeds, rendered images, inline chart creation, and AI preview placement were not changed.

## Changed files

- `client/package.json`
- `client/src/containers/AddChart/AddChart.jsx`
- `client/src/containers/AddChart/chartStudioState.js`
- `client/src/containers/AddChart/chartStudioState.test.js`
- `client/src/containers/AddChart/components/ChartDataView.jsx`
- `client/src/containers/AddChart/components/ChartDatasetConfig.jsx`
- `client/src/containers/AddChart/components/ChartDatasets.jsx`
- `client/src/containers/AddChart/components/ChartPreview.jsx`
- `client/src/containers/AddChart/components/ChartSettings.jsx`
- `client/src/containers/AddChart/components/ChartStudio.jsx`
- `client/src/containers/AddChart/components/ChartStudioChat.jsx`
- `client/src/containers/Ai/AiChat.jsx`
- `client/src/input.css`
- `server/modules/ai/orchestrator/tools/updateChart.js`
- `server/tests/unit/orchestratorMaps.test.js`
- `docs/specs/FS-20260922-chart-studio-verification.md`

The untracked specification file was supplied before implementation and was not changed.

## Unverified manual conditions

- Full control walks for every required chart family and multi-binding fixture.
- Persisted manual edits for every inventory row, followed by reload.
- Real alert delivery paths. These were not used to avoid external messages.
- Real AI questions and mutations for enabled, disabled, denied, cross-team, ambiguous multi-binding, and network-failure cases.
- Shared and embedded chart browser smoke checks.
- The exact 1920 × 1080 browser size.

These limits do not hide a known failed automated check. All commands in the command table passed.

## Chart Studio space update — 22 September 2026

- Hide the app top bar on existing chart edit routes. Keep the chart title and chart actions.
- Use the full viewport height. Remove the unused mobile breadcrumb styles and the footer space on this route.
- Pass the collapsed state from UserDashboard to Sidebar and SidebarDashboards. In Chart Studio, use the collapsed view without changing the saved setting.
- Browser check at 1280 × 720: the app top bar is absent and the sidebar is 64px wide. With the expanded setting, leaving the editor restores the 256px sidebar and the app top bar. With the collapsed setting, leaving the editor keeps the collapsed sidebar. The original collapsed setting was restored after the check.
- Lint, all 79 visualization tests, production build, and `git diff --check` passed. The build reports large output chunks.
- Repeat the check: expand the sidebar on a dashboard, open an existing chart, then select Back to dashboard. Repeat with the sidebar collapsed. No setup changes are required.

## Chart type selector update — 22 September 2026

- Replace the icon toolbar in ChartPreview with a HeroUI Select. Keep all 13 types in four named groups, with icons in the menu. Use the existing preset labels.
- Keep the existing type-change handler, bar options, and map restriction. Selecting the current type does not send an update.
- Put the selector beside refresh and cache controls. Remove the extra separators, spacing, and unused toolbar CSS.
- Move accumulation to Appearance with the same update handler and supported types. DatasetBuilder uses the shared selector and retains accumulation in its appearance controls.
- Browser checks passed at 1280 × 720 and 390 × 844: groups and current selection appear, Escape closes the menu, selecting the current type closes it, and the page has no horizontal overflow at 390px. Accumulation is disabled for the doughnut chart as before.
- Lint, all 79 visualization tests, production build, and diff whitespace checks passed. The build reports large output chunks. Changes to persisted chart types and the DatasetBuilder page were not tested in the browser.
- To use: open a chart and select its type from the first control above the preview. Accumulation is under Appearance. No setup changes are required.

## Equal default panel heights — 22 September 2026

- Bottom settings now use half the available height by default, excluding the 7px divider. Remove the 500px limit so tall screens also use equal panels.
- Keyboard resizing starts from the current panel height. Drag and keyboard limits keep at least 240px for the preview and 220px for settings.
- Browser checks: at 1280 × 1100 both panels measured 518.5px. Arrow Up increased settings to 538.5px and reduced the chart to 498.5px. Lint, all 79 visualization tests, and diff whitespace checks passed.
- To use: reopen the chart editor for the equal default split. Drag the divider or focus it and use the arrow keys to resize.

## Settings card consistency — 22 September 2026

- Use one 16px padding layer for Studio cards. Remove the extra ChartSettings, appearance wrapper, and dataset tab-panel padding.
- Use 14px, weight 600 headings for dataset and chart-wide settings. Use 14px body text within the cards.
- Remove the separator below the chart-wide heading. Add internal separators only when a preceding settings group is visible. Do not render an empty chart-wide card or a dataset separator without visible configuration.
- Remove the repeated dataset introduction.
- Browser checks on the map chart: Selected dataset and Chart appearance both use 16px card padding and 600 14px Inter headings, with the same left edge. Datasets and Chart data have the same measurements. The Build panel has zero additional padding. The map Appearance card has no stacked separators.
- Lint, all 79 visualization tests, and diff whitespace checks passed. No chart settings were changed during browser checks.
- Reload Chart Studio and open Data or Appearance to see the changes. No setup changes are required.

## Settings tab spacing — 22 September 2026

- Reduce the settings heading from 56px to 44px and remove its full-width bottom border.
- Reduce content top padding from 16px to 4px. Keep the selected-tab indicator and the chart resize handle.
- Use the same compact top spacing on phones and align the heading with the content gutters.
- Lint and diff whitespace checks passed. Reload the editor to see the spacing change; no setup is required.

### Chat update refresh

- Studio chat now runs the chart data request after a completed chart update instead of loading only the chart record.
- Studio messages omit chart preview cards; the original response remains available to detect chart updates.
- Browser check: asked chart 4848 to show the top 3 results sorted by visitors descending, keeping its name, colors, and type. After completion, the chart showed 554, 473, and 250 without a manual refresh. The selected label remained Top pages. Chat showed the answer and operations without a preview card.
- Client lint, 80 visualization tests, and 20 AI tests passed.

### Settings layout review

- Related fields use two columns when the settings card has at least 560px of content width. The right panel and phone layouts use one column. This depends on the card width, not the window width.
- Dataset label and Edit dataset share a row when they fit. Field mappings, primary color/fill, sorting/record limit, date options, and axis limits use the available width. Long remove-dataset labels wrap. Gauge ranges have visible field labels and wrap as a group.
- Date inputs wrap without clipping. The shared date-range popover stacks its two months below 640px and keeps scrolling within the viewport.
- Browser checks used the actual components with sample Redux data and disabled request dispatch. All 13 chart types were checked across Data, Appearance, and Automation at 390px, 1280px, and 1720px. Extra cases covered region/point/GeoJSON maps, multiple values, generated series, long dataset labels, and empty charts.
- Extra checks covered 320px, 1599px/1600px, populated table columns, formula input, date popovers, light/dark themes, and hiding/restoring settings and phone chat. Width checks compare controls against their settings cards; screenshots verify representative compositions. These are layout checks, not source-query or chart-calculation tests.
- The temporary browser fixture was removed after review. To repeat manually, open a chart, inspect all three settings tabs, resize below/above 1600px, and open the date picker at phone width.
- The real chart was also checked at phone, compact desktop, and wide desktop widths. Long chart titles now truncate within the header and keep the edit button visible.
- Client lint, 80 visualization tests, 20 AI tests, and the production build passed. The build still reports large output chunks.
