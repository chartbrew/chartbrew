# Responsive Visualization Compositions

Status: draft  
Date: 2026-08-21  
Related: [ECharts Rendering And Data API](FS-20260819-echarts-rendering-data-api.md)

## Overview

Dashboard cards can have the same area but very different shapes. A wide, shallow card, a narrow,
tall card, and a small square card must not receive the same scaled-down chart. Chartbrew will use
container geometry, content density, and preset-specific rules to select a deliberate composition.
Large cards support analysis. Small cards show a clear signal without reducing text below a readable
size.

This applies to graphical ECharts presets, native metric views, chart chrome, and the optional
`KpiChartSegment`. The state is runtime-only. It is not stored in `Chart.visualization` or in prepared
snapshots.

## Goals

- Define one responsive contract for dashboard, editor, embed, export, report, and snapshot surfaces.
- Give every ready preset explicit rules for different widths, heights, shapes, and data densities.
- Make `KpiChartSegment` part of the chart composition instead of reserving a fixed plot offset.
- Provide category summary compositions with a total, hover value, and percentage beside pie-like marks.
- Keep values, ordering, colors, formulas, goals, ranges, and stable series identities unchanged.
- Make the same data and fixed `RenderContext` produce the same composition and output.

## Non-Goals

- A user-facing responsive-mode control.
- Persisting ECharts media options or a selected layout on a Chart row.
- Changing query limits or silently dropping categories to make a chart fit.
- Adding new visualization presets.
- Updating the public API contract. This work does not require an OpenAPI change.

## Responsive Contract

Do not use one linear `full`, `compact`, and `micro` scale. Resolve a layout from independent inputs:

| Input | Initial bands | Purpose |
| --- | --- | --- |
| Width | `narrow < 260`, `regular 260-519`, `wide >= 520` | Horizontal labels, split layouts, legends |
| Height | `shallow < 150`, `regular 150-319`, `tall >= 320` | Axes, KPI rows, category capacity |
| Shape | `panoramic >= 2.2`, `portrait <= 0.8`, otherwise `balanced` | Side-by-side or stacked composition |
| Density | Preset-specific pixels per point, bar, arc, or cell | Ticks, labels, symbols, and grid detail |

The values are starting thresholds and must live in shared serializable metadata. The client and
server keep separate implementation maps. The metadata must not contain React components or ECharts
callbacks.

Use the card content rectangle for chart chrome and KPI composition. Use the remaining plot rectangle
for renderer geometry and density. The resolver must not oscillate when optional content is removed.
Browser rendering uses observed container pixels. Fixed surfaces use `RenderContext.width` and
`RenderContext.height`.

Each preset returns a named composition that is meaningful to that preset, such as `analysis`,
`sparkline`, `side-summary`, `stacked-summary`, `centered-ring`, `side-gauge`, or `dense-matrix`. These names are
internal and must not appear in the product UI.

## Shared Composition Rules

- Keep titles at 12 px or larger, axes at 10 px or larger, and metric values at 24 px or larger.
  Remove secondary information before text becomes smaller.
- Keep the title and menu available. Hide or condense update time and source status when they take
  space required by the result.
- Reduce tick count before font size. Remove the Y axis and grid when they no longer help comparison.
- Show exact values in the unified tooltip. Touch and keyboard users must have an equivalent path.
- Data labels depend on available mark size and overlap risk, not only the saved data-label setting.
  A saved off state always stays off.
- Do not truncate data without a visible rule. A render-only `Other` category is allowed only when it
  aggregates all hidden categories deterministically and uses the same aggregation in the mark,
  breakdown, tooltip, and export.
- Keep light and dark themes, reduced motion, locale, timezone, value formulas, and accessibility
  behavior in every composition.

## KPI And Sparkline Composition

`KpiChartSegment` is optional semantic content for `chart.mode === "kpichart"`; a small layout must
not enable KPI mode by itself.

- Only presets with the shared `kpiOverlay` capability can enter `kpichart` mode. Pie, doughnut,
  polar area, radar, matrix, and gauge do not show the KPI overlay control. The renderer ignores an
  old unsupported `kpichart` value.

- Replace fixed bottom padding with one flex composition that measures the KPI region and lets the
  plot fill the remaining space.
- In shallow cards, place the KPI value and optional growth chip in a compact top row. Put the
  sparkline directly below it.
- In panoramic cards, the KPI row can remain above the sparkline or move to the left when this gives
  the plot more useful height.
- In narrow cards, show the primary series first. Show more series only when each metric keeps its
  minimum readable width. Represent omitted metrics with an accessible overflow summary.
- Use the KPI series color and label consistently with the sparkline. Do not repeat the same label in
  both regions when one clear label is sufficient.

## Preset Rules

| Preset | Shallow or dense | Balanced regular | Wide or tall |
| --- | --- | --- | --- |
| Line | Sparkline; no Y axis, grid, legend, or point symbols; preserve the optional fill and at most first/latest X context | Limited ticks and subtle grid; keep the legend and low-opacity fill when enabled | Full axes, goals, legend, user-enabled points, and optional fill |
| Vertical bar | Hide data labels when bar width is insufficient; reduce ticks and grid | Keep readable category ticks and conditional inside labels | Full axes, stacking, goals, and legend |
| Horizontal bar | Compact comparison: keep category and value axes, hide legend and direct labels | Clear top value axis, ordered categories, optional end labels, row hover | Full comparison view, stacking, goals, legend, and linked row emphasis |
| Doughnut | Use `micro`, `side-summary`, or `stacked-summary` from the independent width and height bands | Centered ring with conditional labels and center total | Use `side-breakdown` when wide and `stacked-breakdown` when tall; keep the ring and value list linked on hover and focus |
| Pie | Use `micro`, `side-summary`, or `stacked-summary` from the independent width and height bands | Centered pie with conditional labels and no center total | Use `side-breakdown` when wide and `stacked-breakdown` when tall; keep the pie and value list linked on hover and focus |
| Polar area | Remove external legend and labels when arcs are too small | Centered polar mark with tooltips | Use the category breakdown when it improves comparison |
| Radar | Hide point labels that overlap; keep the shape and tooltip | Reduce indicators only through visible wrapping or rotation rules, not data removal | Full indicators and multi-series legend |
| Matrix | Use `dense`: hide both axes, reduce cell gaps, preserve every cell, and use the tooltip for detail | Use `bounded`: square cells with overlap-safe axis labels | Use `labeled`: larger square cells, full row context, and useful gutters; fall back to `bounded` when column density is high |
| Gauge | Use `micro` when width and height are both small: keep only the mark and the card title. Use `side-summary` for shallow regular/wide cards and `compact` for narrow cards that still have height | Use `centered`: value and active-range marker inside, with the muted metric label below | Use `large`: larger centered value, active-range marker, and muted metric label below |
| KPI / Average | Primary value, optional growth, and optional goal progress; never shrink the value below its minimum | Support multiple metrics when each has enough width | Full metric set with goal and comparison context |
| Table | Preserve headers and horizontal scrolling; fit rows from available height | Normal pagination and column sizing | More rows and columns without changing the data contract |
| Markdown | Preserve readable text and scrolling; do not line-clamp essential content | Normal document flow | Use available width without making lines excessively long |

### Horizontal Bar Comparison Contract

- `horizontalBar` is a canonical preset. It is not an orientation option on `bar`.
- `bar` always uses a vertical category axis. `horizontalBar` always uses a horizontal value axis.
- Keep prepared category order and show the first category at the top.
- Place the value axis at the top. Keep the baseline and split grid visible in compact and comparison states.
- For stacked data, the axis tooltip lists every series for the active category. Hovering one segment
  emphasizes all segments in that category.
- Migrate stored `bar` charts with `horizontal = true` to `type = horizontalBar`. Update active layer
  marks and prepared snapshot result marks in the same migration.

## Category Summary Compositions

For doughnut and pie, the resolver uses these states:

- `micro`: narrow and shallow. Hide legend, labels, values, and total. Use the full plot for the mark.
  Hover or focus shows one compact tooltip: `{trimmed label}: {formatted value} {percentage}`.
- `side-summary`: regular or wide and shallow. Put the summary on the left and the mark on the right.
  Hide the legend and all mark labels, even when data labels are enabled.
- `stacked-summary`: narrow and regular or tall. Put the summary above the mark. Hide the legend and
  all mark labels, even when data labels are enabled.
- `side-breakdown`: wide and not shallow. Put a scrollable category list on the left and the mark on
  the right. Each row shows the stable color, label, formatted value, and percentage.
- `stacked-breakdown`: tall and not wide. Put the mark above a scrollable category list. Each row
  shows the same fields as `side-breakdown`.
- `centered`: all other geometry. Apply the saved legend and data-label settings. Doughnut shows the
  total in the center. Pie does not show a center total.

The side and stacked summaries show `Total` and the formatted total at rest. Segment hover or focus
replaces that content with the stable color marker and category label, formatted value, and
percentage on separate lines. These summary compositions do not also show a floating tooltip.

The large breakdown list and chart use one active category. Hover or keyboard focus on a list row
highlights the matching segment and dims the other segments. Segment hover highlights the matching
row and dims the other rows. Doughnut shows the active formatted value in its center and restores the
total when the pointer or focus leaves. Pie keeps its center empty. The list remains scrollable so the
renderer does not remove categories.
Fixed SVG and PNG output uses the same list placement. When a fixed surface cannot fit every row, it
shows a visible `+N more` row instead of silently removing categories.

The summary is presentation output compiled from `PreparedData`; it is not a new dataset, series, or
persisted visualization field.

## Architecture

1. Add shared serializable geometry bands and supported composition names beside the preset manifest.
2. Add a pure resolver that accepts preset, content width, content height, point/category count, and
   optional KPI state.
3. Keep server compiler implementations pure JSON. Use ECharts `media` only where it can express the
   complete rule without client callbacks.
4. Keep client implementation maps for measured geometry such as matrix cells, category summaries,
   KPI allocation, and chart chrome. Remove duplicate hard-coded thresholds from components.
5. Add the same fixed-size corpus to compiler and browser tests so client and fixed-surface behavior
   cannot drift.

## Delivery Order

1. Shared geometry, density resolver, chart chrome allocation, and KPI composition.
2. Line with optional fill, including KPI plus sparkline.
3. Vertical bar, then the separate `horizontalBar` comparison preset.
4. Doughnut and pie category summaries, then polar area.
5. Matrix and gauge.
6. Radar, KPI, average, table, and markdown.
7. Cross-surface visual review and fallback removal only after all gates pass.

## Implementation Progress

- [x] Add shared geometry metadata and matching client/server resolvers.
- [x] Add line `analysis`, `limited`, and `sparkline` compositions.
- [x] Preserve the saved fill treatment in every responsive line composition.
- [x] Replace the fixed KPI plot offset with measured flex allocation for KPI plus line charts.
- [x] Add vertical bar `analysis`, `limited`, and `sparkline` compositions.
- [x] Add the canonical `horizontalBar` preset with `comparison` and `compact` compositions.
- [x] Migrate legacy `bar` charts with `horizontal = true`, including prepared snapshot marks.
- [x] Add doughnut and pie `centered`, `side-summary`, `stacked-summary`, and `micro` compositions.
- [x] Add matrix `labeled`, `bounded`, and `dense` compositions with square cells in every state.
- [x] Add gauge `large`, `centered`, `side-summary`, and `compact` compositions with active-range context.
- [x] Limit KPI overlays to presets with the shared `kpiOverlay` capability.
- [ ] Apply the contract to the remaining presets in the delivery order.

## Testing And Acceptance

- Cover at least `189x80`, `189x104`, `189x231`, `307x231`, `424x80`, `424x104`, `424x173`,
  `424x231`, `424x335`, and one wide export size for every applicable preset.
- Add sparse, normal, and dense fixtures, including multiple series and long category labels.
- Verify KPI on/off, growth on/off, goals, data labels, legends, tooltips, and light/dark themes.
- Verify dashboard, editor, embed, report, snapshot, and export behavior at declared sizes.
- No layout clips, overlaps, unreadable text, inverted order, or unexplained missing data.
- Browser and fixed `RenderContext` runs select equivalent compositions for the same dimensions.
- Resize transitions do not flash the legacy renderer and do not leave stale labels or titles.
- Each ready preset lists and tests every responsive composition that it supports before Phase 4 is
  complete.
