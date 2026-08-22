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
- Provide a wide category composition with a value and percentage breakdown beside pie-like marks.
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
`sparkline`, `split-breakdown`, `centered-ring`, `side-gauge`, or `dense-matrix`. These names are
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
| Line | Sparkline; no Y axis, grid, legend, or point symbols; at most first/latest X context | Limited ticks and subtle grid; keep the legend | Full axes, goals, legend, and user-enabled points |
| Area | Line sparkline with restrained fill; same KPI rules as line | Limited ticks and low-opacity fill | Full axes, goals, stacking, and legend |
| Vertical bar | Hide data labels when bar width is insufficient; reduce ticks and grid | Keep readable category ticks and conditional inside labels | Full axes, stacking, goals, and legend |
| Horizontal bar | Keep category labels; calculate visible row height; use an explicit scroll or overflow treatment when all rows do not fit | Show all rows that meet minimum height | Full ordered category analysis; never invert prepared sort order |
| Doughnut | Center total, hide labels and external legend, use tooltips | Centered ring with conditional labels | Use `split-breakdown`: category rows with color, value, and percent beside the ring |
| Pie | Hide labels that do not meet minimum arc length; use tooltips | Centered pie with conditional labels | Use `split-breakdown` beside the pie; no center total |
| Polar area | Remove external legend and labels when arcs are too small | Centered polar mark with tooltips | Use the category breakdown when it improves comparison |
| Radar | Hide point labels that overlap; keep the shape and tooltip | Reduce indicators only through visible wrapping or rotation rules, not data removal | Full indicators and multi-series legend |
| Matrix | Hide axes before cells become unreadable; preserve all cells as a dense map | Square cells with bounded axis labels | Larger square cells, full week/row labels, and useful gutters |
| Gauge | Use the approved value-plus-gauge composition for panoramic shallow cards; use value and active range when the pointer cannot remain clear | Centered gauge with value inside | Larger centered gauge with range labels when space permits |
| KPI / Average | Primary value, optional growth, and optional goal progress; never shrink the value below its minimum | Support multiple metrics when each has enough width | Full metric set with goal and comparison context |
| Table | Preserve headers and horizontal scrolling; fit rows from available height | Normal pagination and column sizing | More rows and columns without changing the data contract |
| Markdown | Preserve readable text and scrolling; do not line-clamp essential content | Normal document flow | Use available width without making lines excessively long |

## Wide Category Breakdown

For doughnut, pie, and applicable category presets, `split-breakdown` places a compact breakdown on
the left and the mark on the right. Each row contains the stable color marker, category label,
formatted value, and percentage of the displayed total. The row count comes from available height.
If rows do not fit, combine the remaining categories into one deterministic `Other` row and matching
mark segment. Hover or focus links a row and its segment. The doughnut keeps its total in the center.

The breakdown is presentation output compiled from `PreparedData`; it is not a new dataset, series,
or persisted visualization field.

## Architecture

1. Add shared serializable geometry bands and supported composition names beside the preset manifest.
2. Add a pure resolver that accepts preset, content width, content height, point/category count, and
   optional KPI state.
3. Keep server compiler implementations pure JSON. Use ECharts `media` only where it can express the
   complete rule without client callbacks.
4. Keep client implementation maps for measured geometry such as matrix cells, split breakdowns,
   KPI allocation, and chart chrome. Remove duplicate hard-coded thresholds from components.
5. Add the same fixed-size corpus to compiler and browser tests so client and fixed-surface behavior
   cannot drift.

## Delivery Order

1. Shared geometry, density resolver, chart chrome allocation, and KPI composition.
2. Line and area, including KPI plus sparkline.
3. Vertical and horizontal bar.
4. Doughnut, pie, and polar area, including `split-breakdown`.
5. Matrix and gauge.
6. Radar, KPI, average, table, and markdown.
7. Cross-surface visual review and fallback removal only after all gates pass.

## Implementation Progress

- [x] Add shared geometry metadata and matching client/server resolvers.
- [x] Add line `analysis`, `limited`, and `sparkline` compositions.
- [x] Replace the fixed KPI plot offset with measured flex allocation for KPI plus line charts.
- [x] Add vertical bar `analysis`, `limited`, and `sparkline` compositions.
- [ ] Apply the contract to area, horizontal bar, and the remaining presets in the delivery order.

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
