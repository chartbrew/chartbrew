---
id: FS-20260318-visualization-pipeline-v2-screen-spec
owner: Raz
status: draft
links: ["FS-20260317-visualization-pipeline-v2", "FS-20260314-chart-create-from-dataset", "FS-20251222-dataset-picker-ui"]
scope: web
---

## Overview
This document is the screen-by-screen UX attachment for `FS-20260317-visualization-pipeline-v2`.

The goal is to make chart creation question-first without breaking Chartbrew's current information architecture:
- datasets remain reusable source definitions
- dashboards remain the publishing/layout container
- saved charts still belong to exactly one dashboard in the initial V2 rollout
- chart drafting can begin outside dashboard context

This spec focuses on user journey, screen structure, draft behavior, and entry points. It does not redefine the underlying visualization pipeline; that remains in the main V2 spec.

## UX Principles
- Start from the user's question, not from dashboard placement.
- Keep datasets reusable and discoverable.
- Separate data preparation from chart question building.
- Make filter scope explicit: dataset, chart, dashboard, variable.
- Allow drafting outside dashboards, but require explicit publish destination.
- Preserve current dashboard ownership in the first rollout to avoid premature model complexity.

## Primary Journey
Assumption: the user already has at least one connection.

1. User clicks `New chart` from the homepage/sidebar, a dataset page, or an existing dashboard.
2. User chooses an existing dataset or starts from a connection.
3. If starting from a connection, Chartbrew creates a draft dataset and opens data preparation.
4. User prepares the dataset once: request, joins, row extraction, fields, reusable filters, variables.
5. User clicks `Visualize` and builds the chart question.
6. User previews the result and configures chart filters or dashboard bindings if needed.
7. User saves the chart and chooses a dashboard destination if none was preselected.
8. Chart becomes a published chart on exactly one dashboard.

## Screen Inventory
### Screen 1: Home / Global Entry
Purpose:
- Give users a chart-first entry point without requiring them to open a dashboard first.

Entry points:
- Homepage quick action
- Sidebar CTA
- Datasets page CTA
- Dashboard page CTA

Key UI:
- Add a primary `New chart` CTA to the homepage and persistent navigation.
- Keep `New dataset` and `New connection` CTAs.
- If launched from outside a dashboard, the flow starts with no dashboard assigned.

Behavior:
- If the user starts from a dashboard, pass `project_id` as a preselected destination.
- If the user starts from a dataset, pass `dataset_id` as a preselected source.
- If the user starts from an existing chart and opens dataset editing from there, preserve `chart_id` and destination dashboard context in the route so the flow can return to the same chart.

### Screen 2: New Chart Start
Purpose:
- Let the user decide whether they are reusing prepared data or creating a new reusable dataset.

Primary choices:
- `Use existing dataset`
- `Create from connection`

Secondary information:
- Show recent datasets if they exist.
- If a dashboard destination is already known, show a small badge such as `Will be saved to: Sales Dashboard`.
- If no dashboard is selected yet, show `Draft chart, dashboard chosen on save`.

Initial rollout constraints:
- Optimize the first-create path for one starting dataset.
- Additional datasets can still be added later inside the chart builder if the chart type supports it.

Empty states:
- If there are no datasets, emphasize `Create from connection`.
- If there are no connections, route to connection creation first.

### Screen 3: Dataset Picker
Purpose:
- Make reuse the default behavior when a suitable dataset already exists.

Key UI:
- Search input
- Filters by connection/source, owner, recency
- Dataset cards with:
  - dataset name
  - source/connection badge
  - last updated / last run
  - top fields or metadata summary
  - status badges such as `Draft`, `Fields ready`, `Needs scan`

Primary actions:
- `Use dataset`
- `Preview dataset`
- `Open dataset`

Secondary actions:
- `Duplicate dataset`
- `Create from connection`

Behavior:
- Picking a dataset creates or resumes a draft chart and routes into the chart builder.
- If the chart already has a dashboard destination, keep it attached through the flow.
- If the user is editing an existing chart draft, reusing a dataset should resume that same chart when possible instead of creating a parallel draft.

Notes:
- This screen should reuse and extend the existing dataset picker work in `FS-20251222-dataset-picker-ui`.

### Screen 4: Draft Dataset Builder
Purpose:
- Prepare source data into a reusable dataset before asking the chart question.

When shown:
- User chose `Create from connection`.
- User launched chart creation from a connection-focused flow.

Draft semantics:
- Create a draft dataset automatically at flow start.
- Autosave changes to the draft dataset.
- If the user abandons the flow, keep the dataset as a draft or apply cleanup rules defined by product/backend policy.

Main areas:
- `Request`
- `Join data`
- `Transform`
- `Preview`

Connection-specific behavior:
- SQL:
  - query/table selection
  - join support
- API / NoSQL:
  - explicit row extraction or unnest selection
  - nested path handling must be visible, not implicit

Primary CTA:
- `Visualize`

Secondary CTA:
- `Save draft dataset`

Navigation:
- Breadcrumbs should let the user return to:
  - `Datasets`
  - the chart builder when the dataset was opened from a chart
- `Visualize` should return to the existing chart when `chart_id` context is present.

### Screen 5: Dataset Fields, Reusable Filters, And Variables
Purpose:
- Expose dataset-level semantics that improve reuse across many charts.

Subsections:
- `Fields`
- `Reusable filters`
- `Variables`

Fields:
- inferred type
- label / description
- role hints such as dimension/metric/date/filterable
- aggregation defaults
- visibility or hidden state
- high-cardinality warnings

Reusable filters:
- define dataset-level row filters shared by charts using this dataset
- allow exposure metadata, but do not mix them with chart-only filters

Variables:
- dataset and request variable bindings
- defaults and required flags
- clear indication whether a variable is source-level, reusable, or intended for dashboard/chart binding later

Primary CTA:
- `Visualize`

### Screen 6: Chart Builder / Visualize
Purpose:
- Turn a dataset into a chart question and live preview.

Main layout:
- Left: question builder
- Center: live chart preview
- Right or top rail: chart type, save status, destination, and advanced display options

Builder sections:
- `Metrics`
- `X axis / Time`
- `Break out by`
- `Filter`
- `Sort`
- `Limit`
- `Chart type`
- `Display`

Rules:
- Dataset-level filters must appear separately from chart-level filters.
- Exposed chart filters must be clearly marked as controls, not permanent dataset edits.
- Dashboard-bound filters must show target binding status.
- If no dashboard is selected yet, show a draft banner such as `This chart is not published yet`.
- The screen must also expose the existing advanced CDC-backed configuration without forcing the user into the legacy editor:
  - series colors / fill colors
  - formulas
  - goals
  - variable overrides
  - alerts

Additional dataset handling:
- `Add dataset` can remain available for supported chart types.
- Initial rollout should validate that all CDCs on the chart use the same engine version.
- The builder should show the list of attached datasets and let the user:
  - switch the active dataset they are configuring
  - add another reusable dataset to the chart
  - remove a dataset when more than one is attached

Primary CTA:
- `Save chart`

Secondary actions:
- `Migrate chart` for legacy charts
- `Add dataset`
- `Open dataset`

Navigation:
- Breadcrumbs should be:
  - `Dashboards > {dashboard} > {chart}` when a dashboard destination exists
  - `Dashboards > New chart` when the chart is still an unattached draft
- `Open dataset` must keep authoring context so dataset editing returns to the same chart instead of starting a new chart flow.

### Screen 7: Filter Configuration Surfaces
Purpose:
- Make filter scope obvious and prevent today’s mixing of dataset, dashboard, and chart filters.

Recommended filter UI model:
- `Dataset filter`
  - reusable across charts
- `Chart filter`
  - only this chart question
- `Expose on chart`
  - chart widget/control
- `Bind to dashboard`
  - controlled by a dashboard filter
- `Bind to variable`
  - controlled by variable values

Recommended interaction pattern:
- Adding or editing a filter opens a drawer or inline panel with:
  - target field
  - operator
  - value source
  - scope
  - exposure/binding settings

Date filters:
- Must work with explicit field or variable bindings for V2.
- Must not depend solely on legacy `dataset.dateField`.

### Screen 8: Save / Publish To Dashboard
Purpose:
- Convert a draft chart into a published chart while preserving single-dashboard ownership.

When shown:
- User clicks `Save chart`.

Fields:
- chart name
- destination dashboard
- optional description or subtitle if supported

Behavior:
- If the user started inside a dashboard, the destination is prefilled.
- If the user started from the homepage or dataset flow, the destination is required here.
- Publish converts the draft chart into a normal saved chart on one dashboard.
- Prevent publish if no dashboard is selected.

Important rule:
- In the initial V2 rollout, a saved chart can belong to one dashboard only.
- Do not introduce multi-dashboard publishing from this modal.

### Screen 9: Published Dashboard
Purpose:
- Show the saved chart in its final layout context.

Expected behavior after publish:
- Route user to the dashboard with the new chart inserted.
- Preserve the chart's configured question, chart-local filters, and dashboard bindings.
- If the chart was created from a draft dataset, that dataset remains reusable for future charts.

## Alternate Entry Flows
### Starting From A Dashboard
- Uses the same chart flow.
- Dashboard destination is preselected from the start.
- User can still create a draft dataset or reuse an existing one.

### Starting From A Dataset
- Skip the source selection screen.
- Open directly in the chart builder with that dataset attached.
- User still chooses the destination dashboard on save if not already known.

### Starting From A Connection
- Create a draft dataset first.
- Route to data preparation before chart building.

## Empty States And Edge Cases
### No Connections
- `New chart` should explain that a connection is needed first.
- Primary CTA becomes `Create connection`.

### No Datasets
- Dataset picker should emphasize `Create from connection`.

### Abandoned Drafts
- Draft charts created outside dashboards must not become orphaned published records.
- Use either:
  - explicit draft/staged chart records, or
  - temporary records that are finalized only on publish
- Cleanup policy should be defined during implementation.

### Legacy Charts
- Opening an existing legacy chart stays in current behavior with explicit migration entry points when conversion is supported.

## Initial Rollout Constraints
- Saved charts belong to one dashboard only.
- Multi-dashboard chart ownership is out of scope.
- Mixed V1/V2 CDCs inside one chart are blocked.
- The first-create flow should optimize for one starting dataset even if add-dataset remains supported later.

## Implementation Notes
- Reuse the existing chart-create-from-dataset work where possible instead of inventing a separate start flow.
- Prefer one draft flow that can be entered from homepage, dataset, connection, or dashboard contexts.
- Keep the route/state model explicit:
  - draft dataset state
  - draft chart state
  - optional destination dashboard state
- Homepage/sidebar `New chart` should be treated as a core product entry point, not just a quick action.

## Acceptance Criteria
- Users can start chart creation from the homepage without opening a dashboard first.
- Users can reuse an existing dataset or create a draft dataset from a connection.
- Dataset preparation and chart question building are clearly separated in the UI.
- Filter scope is explicit in the chart builder.
- Saving a draft chart requires a dashboard destination if one is not already selected.
- Saved charts still belong to exactly one dashboard in the initial rollout.
