# Dataset Picker UX Refresh

## Overview
Creating a chart currently drops users into an empty canvas and forces them to leave the flow to pick datasets one by one. This spec introduces a guided picker that appears both when a chart is created and whenever another dataset is added to the chart. The picker surfaces dataset metadata, enables search/filtering, and streamlines duplication and selection so users can get a chart populated in a few clicks. Scope is limited to the picker experience; dataset internals and chart rendering stay unchanged.

## Goals
- Display a modal (or panel) immediately after chart creation prompting the user to select one or more datasets.
- Reuse the same picker when clicking “Add dataset” inside an existing chart.
- Provide dataset discovery tools: search, filter by connection/source, filter by tags/team, show recent/favorites.
- Surface key dataset metadata in the picker (name, source icon, last run, preview fields) so users can make informed selections without leaving the flow.
- Offer quick actions straight from the picker: duplicate dataset, open dataset in new tab, run preview.

## Non-Goals
- No changes to dataset schema, chart rendering, or pipeline behavior.
- No new dataset tagging system beyond what already exists; picker reuses existing metadata (connection type, owner, updatedAt).
- No redesign of the chart editor beyond the dataset picker entry point.

## User Experience
1. **Chart creation flow**
   - After the user names a chart & chooses type, the picker modal opens.
   - Modal lists datasets with:
     - Title + connection badge (icon + connection name).
     - Chip with last run time (“5m ago”) and status.
     - Inline field summary (e.g., `x: date`, `y: revenue`).
   - Toolbar: search box, dropdown filters (Connection, Owner, Last updated), sort toggle (Recent, Name).
   - Primary actions: “Add to chart” (multi-select checkboxes) and “Skip for now”.
2. **Adding datasets later**
   - Clicking “Add dataset” inside chart editor opens the same modal, preserving last filter/search state for the session.
3. **Quick actions**
   - Hover reveals icons: duplicate (creates copy and refreshes list), open dataset editor (new tab), run preview (shows spinner + success/failure toast).
4. **Empty states**
   - If no datasets exist, modal shows CTA buttons for “Create dataset” and “Quick create” plus doc links.

## Functional Requirements
- Picker consumes `/team/:team_id/datasets?search&connection_id&sort` endpoint; add query params if missing.
- Modal supports multi-select; upon confirmation, selected dataset IDs are added sequentially to the chart (existing backend call stays the same).
- Client caches the most recent search/filter state in local storage keyed per team.
- Duplicate action calls existing dataset duplication endpoint, then refreshes list with optimistic UI.
- Preview action triggers `POST /team/:team_id/datasets/:dataset_id/request` with `skipSave: true`; show spinner per row and stop repeats while running.
- “Skip for now” closes modal without altering chart state.

## Technical Notes
- Implement picker as reusable component (`DatasetPickerModal.jsx`) inside the chart builder bundle.
- Use virtualized list (e.g., `react-window`) if dataset count exceeds 100 to keep interactions snappy.
- Ensure modal is keyboard accessible: search autofocus, arrow navigation, `Enter` to add.
- For filter dropdowns, reuse existing Select components to avoid new dependencies.
- Memoize dataset cards to prevent re-renders while preview polling is active.

## Telemetry
- Track events: `dataset_picker_opened`, `dataset_picker_dataset_added` (count), `dataset_picker_duplicate_clicked`, `dataset_picker_preview_run`, `dataset_picker_skipped`.
- Attributes: team_id, chart_id, dataset_id(s), filter/search tokens, duration between open and confirmation.

## Rollout & Flags
- Guard UI behind `datasetPickerRefresh` flag (team-level). Default off; enable for internal workspaces first.
- Provide CLI script or admin toggle to flip the flag per team/project for gradual rollout.

## Risks & Mitigations
- **Overwhelming list**: mitigate via search + filters + virtualization.
- **Preview load**: throttle to one preview request per dataset at a time and cancel if modal closes.
- **Workflow disruption**: allow “Skip for now” so advanced users who already know the flow are not blocked.
