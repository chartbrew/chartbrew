# Predictable dashboard layout

Status: implemented. The checks and setup steps are below.

## Decision

Treat a dashboard as an ordered report. Use one reading order and simple rows
for automatic layout. Keep manual positions as explicit custom layouts.

Keep react-grid-layout and the current breakpoint coordinates. Replace the
competing placement rules, not the drag-and-resize library.

The order of priorities is: preserve user work, preserve reading order, keep
charts readable, then reduce empty space. Filling every gap is not a goal.

## Evidence from the current code

- Client placement is repeated in AddChart, Dataset, DashboardStarter, and
  ProjectDashboard. Server placement and template placement use separate rules.
- Manual creation uses a different XL width from server creation. Generic
  placement does not use the chart type.
- The current Tidy grows a 4-column widget to 6 columns, then 9 on a second run.
- Tidy can create overlaps when it stretches a widget beside a taller widget.
  Its fallback can also retain overlapping input positions.
- Editor breakpoint selection differs from the grid's width selection.
- Layout saving sends separate chart updates and closes before they finish.
  Adding a staged text widget uses a separate save path that skips normal edits.
- Chart.dashboardOrder is marked deprecated but still has readers and writers.
  It cannot safely become the new order contract without changing those callers.

## User-visible contract

| Action | Result |
| --- | --- |
| Add one widget | Append after the existing content. Keep every existing position and size. |
| Add an AI or template batch | Auto-arrange the batch below existing content. Keep existing widgets fixed and save the new visual reading order. |
| Tidy | Close vertical gaps. Preserve each widget’s horizontal position, width, and height. |
| Auto-arrange | Group KPI cards, pair charts, and fill rows. Keep text and tables between groups. Preview before saving. |
| Manual move or resize | Keep the user's choice. Do not run automatic packing after the edit. |
| Undo | Restore the layout before the last layout action. |
| Save | Save the complete edit in one transaction. Leave the editor open on failure. |

Tidy preserves sizes and horizontal positions. Process widgets in visual order
and move each widget up to the bottom edge of the widgets above it in the same
columns. This closes the gap below short cards beside taller charts. Invalid
sizes require Auto-arrange or manual resizing.

Auto-arrange may change size and local order. Between text widgets and tables,
put KPI cards first, then normal charts. Keep the order within each group. Use
up to four KPI cards per row on wide screens, two on smaller screens, and one
on mobile. Pair charts on non-mobile screens. Divide each row's full width
between its widgets, including the last row. Text and tables use full width.
Respect explicit template size overrides as boundaries.

Use one 150px height unit for KPI cards; use two units (312px with the
existing margin) for charts, tables, and new text widgets. New text widgets
start at half width on larger screens and full width on mobile. Auto-arrange
uses full-width text rows to keep group boundaries clear. Table content keeps its existing scroll
and pagination controls. Do not fetch data to calculate a layout.

New batches use the same Auto-arrange function. A single new widget keeps its
default size and starts below the greatest existing bottom edge. No append
operation changes an existing widget. Derived screen widths use the Desktop
column edges to avoid rounding gaps. Custom screens stay unchanged.

The bottom editor bar uses the available width. Keep screen controls on the
left, Auto-arrange and layout actions in the middle, and Cancel/Save on the
right. Use an accessible Undo icon. Put extra screen sizes in a menu, and use
that menu for all sizes on narrow screens. Labels must not wrap.

Keep the current column counts, margins, and 150px row unit. Do not migrate
existing coordinates. RGL still handles dragging, resizing, and collisions;
its automatic compaction stays disabled. Validate the final saved layout.

## Reading order and compatibility

Add one dashboard-level layoutOrder array of chart IDs. It is the order for new
automatic layouts, DOM rendering, and dashboard consumers that display a sequence.
Do not create another order field inside layoutIntent.

For an existing dashboard, initialise the order from the saved Desktop layout,
sorted by y, then x, then chart ID. If Desktop is missing, use the nearest saved
desktop-size layout. Append charts missing from that layout in stable ID order.
Initialising order must not change any saved coordinates.

Update the order when widgets are added, deleted, copied, or moved between
dashboards. New copies get a new place at the end. A saved edit to the main
Desktop layout updates report order from that layout's visual order. An edit to
another screen size changes only that screen's positions.

Route existing order controls and readers through this contract. Stop legacy
dashboardOrder writes from independently changing the same report. Keep legacy
schema removal outside this release. Check public dashboards, embeds, and report
exports so they use the resolved layout and order, rather than a competing sort.

Custom layouts may intentionally differ from report order. Preserve those visual
overrides; canonical order governs automatic layouts and sequential access.

## Responsive layout: second delivery

First deliver reliable placement and saving with the existing eight layouts.
Then add automatic derivation for screen sizes that the user has not customised.

- Keep the eight internal keys for compatibility. Use Desktop, Tablet, and Mobile
  as the main previews, with the other sizes under More sizes.
- Use a single width-to-breakpoint function with the same threshold behaviour as
  the installed grid. Test the exact boundaries. Do not mix chart-rendering size
  detection with dashboard breakpoint selection.
- Treat the main Desktop arrangement as the source for order and preferred size.
  Derive other sizes through the shared row algorithm and width constraints.
- Track custom screen layouts explicitly at dashboard level. Saved coordinate
  presence alone cannot tell us whether a user made a manual edit.
- Treat every existing saved screen layout as custom. Do not guess which ones
  were generated. Offer Reset to automatic for a selected size, with preview.
- New dashboards derive the other sizes by default. A manual edit makes that
  screen size custom. Main-layout changes update only derived sizes.
- Adding a widget still appends it to custom layouts without moving old widgets.

Do not automatically rebuild old dashboards on read or after deployment.

## One server write path

Add a dashboard layout endpoint using the existing project route and access
checks. Submit the order, changed coordinates, and the revision read by the editor.
Validate chart membership, edit permissions, unique IDs, complete order, finite
integer coordinates, positive sizes, bounds, and collisions before saving.
Keep an existing invalid rectangle or overlap only when the affected widgets
match the stored coordinates exactly. Reject new or changed invalid geometry.
This lets users repair one legacy screen layout without changing all the others.

Within one database transaction, lock the dashboard, compare its layout revision,
save all changes, and increment the revision. Return the saved layout. Reject a
stale edit with a clear refresh action instead of overwriting newer work. The
client keeps the unsaved edit and does not claim it was saved.

Use the same dashboard lock for every placement path. AI chart calls may prepare
data in parallel, but final placement must read the latest committed layout under
that lock. Place a batch in one transaction so its widgets remain together.
Every add, delete, move, and layout edit must advance the layout revision.
Keep model calls, source queries, and chart rendering outside this short lock.

The editor must submit text widgets and existing layout edits through one save
operation. Map temporary IDs to saved IDs inside that operation. Do not remove
staged widgets locally until saving succeeds. Roll back the entire save on error.

Ordinary chart creation should request automatic placement instead of sending
coordinates calculated from a potentially stale client snapshot. Explicit manual
coordinates remain supported through the validated layout-save path. Adapt API,
template, copy, dataset, and AI callers to this same rule; none may bypass it.

## AI and templates

AI supplies the ordered widgets and chart specifications. Chartbrew derives
geometry from chart type and shared size defaults. Do not ask AI for x/y or
breakpoint widths. Preserve existing template priority and explicit template size
support through an adapter to the shared functions, not a separate layout engine.

AI-created batches are placed together. The existing create_dashboard_chart tool
accepts additional_charts for the remaining charts in reading order (20 charts
maximum per call). Prepare source data before placement, then place all charts
in one transaction and render them after commit. There is no persistent section object,
group classifier, or emphasis system in this release. Those become useful only
when users can name, move, or insert into sections as a product feature.

## Delivery and acceptance

1. Capture the reproduced failures as tests. Add the shared row functions and
   breakpoint mapping. Replace client, server, and template placement duplicates.
2. Add report order, atomic layout saving, and revision checks. Route all creation
   and layout writes through the shared server path. Fix staged-widget saving.
3. Expose Tidy and Auto-arrange, preview, and single-step Undo using
   existing editor controls. Keep existing coordinates until an explicit action.
4. Deliver responsive derivation and custom-size tracking as the second change,
   after the first three steps pass validation.

Use the current test tools; no new property-test dependency is required. Use a
small deterministic generator plus named regression cases to verify:

- No overlaps or out-of-bounds items; every widget appears exactly once.
- Tidy preserves horizontal positions and dimensions, and repeated Tidy is unchanged.
- Auto-arrange fills rows, respects content boundaries, and is unchanged on repeat.
- Append changes no existing rectangle; a batch stays together.
- Client preview equals the server result for the same inputs and revision.
- Derived breakpoints preserve reading order; custom breakpoints stay unchanged.
- Empty dashboards, mixed heights, missing legacy keys, text widgets, and all
  breakpoint boundaries have defined results.
- Concurrent additions get separate positions; stale saves are rejected.
- Failed saves roll back all changes and retain the editable client state.
- Public dashboards and exports use the resolved layout. Keyboard order follows
  report order. Existing manual layouts do not move without an explicit action.

Use the supplied dashboard screenshots as the visual acceptance case. Check
compact KPIs, readable trend axes, mobile order, text placement, and Save/Undo in
the existing running app. Do not start a second UI server.

## Ponytail review

The final scope removes these additions from the combined proposal:

- No semantic grouping engine or automatic insertion beside related content.
- No persistent sections, emphasis field, or new collection of layout presets.
- No eight-layout redesign at the same time as the reliability fixes.
- No change to 12 columns or a smaller row unit in this release.
- No react-grid-layout upgrade and no new test dependency.

Order, a revision check, and explicit custom-layout tracking remain because they
solve observed ordering, save, and compatibility problems. Coordinates stay on
Chart for now; moving all layout storage is not needed for atomic saving.

Review result for this scope: Lean already. Ship.


## Setup and use

Run the database migration before starting the updated API:

```sh
npm --prefix server run db:migrate
```

The migration is already applied to the local development database. There are no
new environment variables or dependencies.

Open a dashboard, then select **Edit layout** from its menu (or press Cmd/Ctrl+E).
Use **Auto-arrange** for full rows and compact chart sizes. Use the adjacent
menu’s **Tidy** action to close vertical gaps while keeping sizes and columns. **Undo** restores the last layout action. Choose a
screen preview and **Reset to automatic** to derive it from Desktop. Save when
the preview is correct. Existing custom screens stay unchanged.

**Add insight → Add text** now opens a staged text widget. Its content and the
layout are saved together. Failed saves keep the editor open. A stale save
provides **Discard edits and reload**.

## Validation

- Shared layout checks cover repeated Tidy, dimensions, order, mixed heights,
  append placement, missing screen keys, derived/custom screens, breakpoint
  boundaries, and preservation of unchanged legacy geometry.
- Transaction tests cover concurrent additions, ordered batches, stale saves,
  membership checks, text ID mapping, rollback, deletion, and unchanged saves.
- Route tests check editor permission, restricted dashboards, viewers, and
  the returned revision. Model tests check native and text JSON from drivers.
- AI batch tests check order and rendering after commit. Preview placement is
  tested with two concurrent destinations.
- The database tests run against isolated MySQL and PostgreSQL containers.
- Browser checks use dashboard 616. They cover reset sizes, repeated Tidy, Undo,
  mobile derivation, saved layouts after reload, and staged text.

Useful commands:

```sh
npm --prefix server run test:pure
npm --prefix server run test:database -- tests/integration/dashboardLayout.test.js tests/integration/chartPreviewPlacement.test.js tests/integration/projectRoute.dashboardAccess.test.js
npm --prefix client run lint
npm --prefix client run build
```

Ponytail code review removed the unused layout-engine and layout-reader wrappers.
The existing grid library, storage coordinates, and row unit remain in use.

First delivery check results:

- Pure server suite: 112 files, 1,110 tests passed.
- Full MySQL run: 39 files passed; three tests in two files used outdated
  mocks. After updating the mocks, the focused rerun passed all 34 tests.
- Final PostgreSQL layout, placement, and permission run: 17 tests passed.
- Client and server lint passed. The server has existing warnings in other tests.
- Client production build passed, with the existing chunk-size warning.
- Dashboard 616 retains the tested Desktop and Mobile layouts. The temporary
  text widget used for the save test was deleted.

## Gap removal revision

The revised shared engine replaces shelf packing for Tidy and Auto-arrange.
Tests cover the reported KPI gap, full row coverage at all screen sizes,
repeatable results, text/table boundaries, explicit template sizes, and batch
reading order after grouping. Existing layout save and concurrency checks remain.

Revision validation: 1,112 pure tests and 8 isolated MySQL transaction tests
passed. Client/server lint and the client build passed, with existing unrelated
warnings. Dashboard 616 checks confirmed Tidy gap removal, exact Undo, repeated
Auto-arrange, full-width mobile stacking, and saved positions after reopening
the editor. The toolbar also fits a 600px viewport. Desktop and Mobile layouts
were saved on dashboard 616. No new setup is required for this revision.
