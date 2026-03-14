# Chart Creation From Dataset

Status: draft

## Overview
The add-chart flow should no longer start by asking the user to name a chart or pick a template. Instead, the first step is dataset selection. Users can either pick an existing dataset or create a new one, and the chart should inherit its name from that dataset.

## Scope
- Remove template-based entry points from the add-chart screen.
- Replace the name-first step with a dataset picker that surfaces search, tags, connection type, created by, and last modified.
- Keep the existing dataset-builder route contract for creating a dataset from chart setup.
- Precreate a chart in the background before routing to dataset creation so `chart_id` is preserved.
- Auto-name the chart from the dataset once the dataset is attached.

## Progress
- [x] Replace `ChartDescription.jsx` with a dataset-first picker UI.
- [x] Create charts directly from existing dataset selection.
- [x] Precreate background charts before `/datasets/new?create=true&project_id=...&chart_id=...`.
- [x] Keep chart naming tied to the selected or newly created dataset.
- [ ] Verify the flow end-to-end in the browser.

## Notes
- `created by` is temporarily the current user for every dataset row until dataset authors are modeled explicitly.
- Connection avatars are replaced in this flow with readable connection-type chips.
