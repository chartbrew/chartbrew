---
id: FS-20250924-auto-layout
owner: Raz
status: done
links: ["#auto-layout-feature"]
scope: web
---

# Auto-layout (Tidy Mode)

## Problem

Chartbrew’s current layout has two key drawbacks:

1. New widgets are always positioned at the bottom, leaving unused horizontal gaps and making dashboards unnecessarily tall.
2. Users must manually configure layouts for every responsive breakpoint (xxxl, xxl, xl, lg, md, sm, xs, xxs), which is time-consuming when they just want a clean layout.

## Goals

- Fill empty gaps left-to-right using available widgets.
- When a widget almost fits a gap but leaves a small void, allow stretching of neighbors to erase the void.
- Use the same gap-filling logic when placing new widgets.
- Apply auto-layout at the current breakpoint, or across all breakpoints.
- Keep manual editing intact.

## Non-goals

- Replacing `react-grid-layout`.
- Real-time automatic relayout while dragging/resizing (auto-layout is always user-triggered).
- Complex AI/ML optimization.

## UX & API

### Auto-layout Tidy
- Add an **Auto-layout** button to the layout editor toolbar in ProjectDashboard.js.
- Options:
  - Apply to current breakpoint only.
  - Apply to all breakpoints.
- Show a preview of changes with highlights, then Apply or Undo.

### Smart Positioning for New Widgets
- On create, run the gap-filling algorithm to find the first suitable empty space.
- If no gap fits, place at the bottom (fallback to current behavior).

## Data & Constraints

- Use existing breakpoint definitions: `cols[bp]`, `rowHeight`, `margin`.
- Layout items use RGL shape: `{ i, x, y, w, h, static }`.
- Respect widget constraints:
  - `minW`, `minH`, `maxW`, `maxH`
- If a widget has an explicit size in options, treat as preferred but not mandatory for tidy mode.
- Keep using `react-grid-layout` for the grid system.
- Respect the breakpoints and the grid system defined in layoutBreakpoints.js.

## Algorithm: Gap-First Tidy

1. **Normalize & compact**
   - Clamp items to grid bounds for the current breakpoint.
   - Compact vertically to remove floating holes.

2. **Build occupancy map**
   - Represent used cells in a grid: columns × rows.
   - Track `y + h` for each column (skyline).

3. **Row scan**
   - For each row (group by `y`), sort items left-to-right.
   - Find gaps: `[cursor, item.x)` between items, and `[cursor, cols]` at the end.

4. **Fill gaps**
   - Try to place an unused widget that fits `gapW` and `rowH`.
   - If the widget’s height is too tall and leaves a small void (≤ 1 row), stretch the neighbor above/left to fill it.
   - If multiple fit, pick the first in stable order.

5. **Trailing gaps**
   - If there’s space at row end, expand the last item rightwards if allowed, or drop in another widget.

6. **Equalize minor teeth**
   - Within each row, if widgets differ by ≤ 1 row in height, stretch shorter ones to match the tallest.

7. **Final compact**
   - Compact vertically again and ensure grid bounds are respected.

### Edge cases
- If no candidate fits, leave gap and continue.
- Never break min/max or locked constraints.
- Stretch only within a limit (default: 1 row).
- Each breakpoint is processed independently.

## Implementation Details

### New module: `modules/autoLayout.js`

Exports:

```javascript
export function tidyLayout(layout, widgets, bp, opts = {
  allowStretch: true,
  stretchLimitRows: 1
});

export function placeNewWidget(existingLayout, widget, bp);
```

### Helpers

* `clampItemToGrid(item, bpCols)`
* `compactVertical(items, bpCols)`
* `buildOccupancy(items, bpCols)`
* `findRowGaps(itemsInRow, bpCols)`
* `canPlaceHere(candidate, gap, layout, bpCols)`
* `stretchNeighborIfTinyVoid(...)`
* `equalizeRowHeights(...)`

### Apply to All Breakpoints

* For “All breakpoints,” run `tidyLayout()` separately per breakpoint.
* Optionally seed order from the largest breakpoint, but do not copy absolute positions.

## Risks

* Fragmented layouts may still leave holes if no candidate fits.
* Stretching could make visuals look odd.
* Very large dashboards may require multiple passes.

## Mitigations

* Limit stretching to 1 row by default.
* Keep tidy deterministic and idempotent (same input = same output).
* Provide Undo.

## Definition of Done

* `tidyLayout()` fills gaps left-to-right at the current breakpoint.
* Small voids can be erased by stretching neighbors within limits.
* Smart positioning for new widgets uses the same gap-filling logic.
* Layouts respect all min/max/locked constraints.
* Auto-layout works per breakpoint and across all breakpoints.
* Undo and preview available in the editor.
