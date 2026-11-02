# Report themes and reusable presets

Status: implemented; database integration suite checks are pending.

## Decision

Provide six built-in themes and team-owned presets. Each contains complete
light and dark colors. Applying a theme copies its values into the report draft.
Save report publishes that copy. Editing or deleting a preset never changes an
existing report. Users apply a revised preset to each report when required.

Presets are shared within one team, not across teams. Do not add live links,
bulk updates, a theme marketplace, or a separate preset-management page.

## Existing code

- `Project` stores header colors in `backgroundColor` and `titleColor`, and
  custom CSS in `headerCode`. `ProjectController` has an update-field allowlist.
- `Report.jsx` provides Appearance, a local draft, Save, and breakpoint previews.
  Its theme switch currently changes the app-wide `ThemeContext` and `cb_theme`.
- `EChartsRenderer.jsx` uses `semanticColors` for labels, axes, maps, and tooltips.
  CSS variables alone will not change all chart text and backgrounds.
- `ProjectRoute.js` checks team membership, project access, and `updateOwn`.
  Public report routes already enforce sharing and password rules.
- `snapshots.js` passes a theme through the report URL. Team brand defaults
  currently supply logos and website links, not report color presets.

## User experience

Keep the current Appearance tab. Use HeroUI controls and the approved rules in
`../chartbrew-design/DESIGN.md`. Approve theme samples in chartbrew-design before
implementation. Proposed starters: **Chartbrew** (current neutral surfaces and
blue accent), **Neutral** (gray accents), **Forest** (green accents), **Ocean**
(teal accents), **Rose** (rose accents), and **Citrus** (olive and lime accents).
All six have light and dark versions; retain the existing fonts and layout.

1. **Theme**: compact selectable previews, grouped as Built-in and Team presets.
   Show actual header, card, and text colors. Selecting one replaces both color
   sets in the draft, not report content, logo, custom CSS, or chart positions.
2. **Default appearance**: System, Light, or Dark. New themes default to System.
3. **Edit colors**: Light and Dark segmented control. Selection changes the
   report preview only. Show swatches and editable hex inputs for the active set.
4. **Colors**: page, header, header text, chart card, primary text, secondary text,
   border, accent, and accent text. Reapply a theme to restore its colors.
   Keep secondary form controls on the sidebar's primary surface.
5. **Save as preset**: enter a name and save both color sets and default appearance.
   This saves a preset only. The existing Save report action publishes the report.
   A preset menu provides Update preset, Rename, and Delete where permitted.

Keep changes local until a save action. Provide Reset changes for appearance.
Apply theme and preset selections immediately, without confirmation. Preserve
the draft on errors or conflicts. Updating a preset states that existing reports
will not change. Delete confirmation states that saved reports keep their colors.

Show contrast warnings next to affected colors, including which text/background
pair needs attention. Warn when text contrast is below 4.5:1 or action accents
below 3:1 against card surfaces. Decorative borders stay subtle and do not need
the control-boundary contrast check. Permit custom colors after a warning; do not silently change them.
Built-in themes must pass these checks. Keep chart series colors unchanged in
this release; a report theme must not change the meaning of chart colors.

## Storage and API

Add one Sequelize table, `ReportThemePreset`:

| Field | Rule |
| --- | --- |
| `id` | Integer primary key. |
| `team_id` | Required Team foreign key; cascade on team deletion. Index it. |
| `created_by` | Nullable User foreign key; set null on user deletion. |
| `name` | Required trimmed string, 1-80 characters. Duplicate names are allowed. |
| `appearance` | Required JSON with the shape below. |
| `revision` | Integer, default 0; reject stale updates and deletes. |
| `createdAt`, `updatedAt` | Existing Sequelize timestamp convention. |

Add nullable `Project.reportAppearance` JSON and integer
`Project.reportAppearanceRevision` (default 0). No preset foreign key is needed:
the report stores a complete copy and does not depend on preset availability.
Built-in definitions live in shared source code, not database seed records.

Appearance shape: `{ mode: "system" | "light" | "dark", light: colors, dark: colors }`.
Each `colors` object contains exactly `page`, `header`, `headerText`, `surface`,
`text`, `mutedText`, `border`, `accent`, and `accentText`.
Accept opaque `#RGB` or `#RRGGBB`; normalize to six digits. Reject unknown fields,
missing color sets, invalid modes, CSS expressions, URLs, and bodies over 16 KB.
Use the existing JSON getter pattern for native and string-valued driver results.

| Endpoint | Purpose |
| --- | --- |
| `GET /team/:team_id/report-theme-presets` | List presets for the current team. |
| `POST /team/:team_id/report-theme-presets` | Create from `{ name, appearance }`. |
| `PUT /team/:team_id/report-theme-presets/:id` | Update name or appearance with revision. |
| `DELETE /team/:team_id/report-theme-presets/:id` | Delete with revision. |
| `PUT /project/:id/report-appearance` | Save `{ appearance, revision }`; use Chartbrew to reset. |

Use authenticated routes. Team owners/admins manage all team presets. Project
admins/editors with at least one accessible project can list, apply, and create
presets; they manage only presets they created. Viewers and public visitors cannot
access preset management. Every preset lookup includes its team ID. Applying
colors to a report requires that report's existing update permission.

Validate on the server. Save each resource with an atomic revision comparison
and increment. Return 409 for stale writes; retain the client's draft and offer
reload. Use 400 for invalid input and existing 403/404 access conventions. Do not
allow the general project update route to bypass appearance validation/revisions.
Public report responses include saved appearance only, never preset records or
creator information. Existing sharing checks remain unchanged.

## Rendering and compatibility

Scope color variables and theme mode to the report root, not the document or
editor sidebar. Precedence is: editor preview mode, valid public `?theme=light|dark`,
saved mode, then OS preference for System. Invalid URL modes are ignored. Listen
for OS changes only in System mode. Do not write report mode into `cb_theme`.

Map report colors to existing surface, text, border, and control tokens. Include
filters, tables, KPI text, loading/error states, footer, and portaled popovers.
Keep semantic success/warning/error colors. Pass resolved report colors to the
chart renderer for labels, axes, grid lines, tooltip surfaces, and map background.
Preserve explicit chart/series colors. Charts outside reports stay unchanged.
Memoize resolved colors and update visual options only; do not fetch chart data
or rebuild charts on each text keystroke. Commit valid color edits to the preview.

Existing reports with null appearance retain their current colors and CSS. Do
not backfill or infer a dark palette. Initial color editing starts from Chartbrew
defaults plus the saved header colors in both sets. Choosing a theme replaces
those values explicitly. Existing custom CSS stays available under Advanced and
can override theme styles; show a short warning only when custom CSS is present.
Structured presets never contain CSS, logos, report text, or sharing settings.

Preserve `removeHeader` and `removeStyling`: the latter bypasses both theme colors
and custom CSS. Public pages, report embeds, and report snapshots use the same
saved appearance. An explicit export mode wins; automated System exports use
Light for a stable result. Standalone chart embeds/exports retain their own theme.

## Delivery and checks

1. Review the paired samples against chartbrew-design, including charts and filters.
2. Add migrations, validation, access checks, and revision-safe API routes.
3. Add scoped report rendering and Appearance controls; preserve the legacy path.
4. Add preset actions and verify reuse in a second report.

Test MySQL and PostgreSQL migration up/down and JSON reads; team isolation;
viewer denial; preset ownership; invalid payloads; stale writes; failed-save draft
retention; and preset deletion without report changes. Check legacy CSS, URL mode,
System changes, export mode, public access, and no app-theme leakage. Verify light
and dark previews at Desktop and Mobile, contrast warnings, keyboard controls,
chart colors, portal colors, and no data requests while editing appearance.

Implementation setup: run `npm --prefix server run db:migrate` before the updated
API. No new dependencies, environment variables, or feature flags are required.
Back up saved presets/appearance before a
rollback; migration down removes the new data but leaves legacy fields intact.

Use after implementation: Appearance -> choose theme -> edit Light/Dark colors ->
Save report. Use Save as preset, then select that preset in another report and save.
Live preset updates, bulk application, chart-series palettes, and mode-specific
logos remain outside this first release.

## Verification

The local migration is applied. Client build, lint, visualization tests, shared
appearance tests, and server unit tests pass. An isolated browser check covers
theme selection, light/dark previews, custom hex input, and the preset dialog.
The missing route middleware return was fixed after a startup failure. A regression
test reproduces the server registration path; all 1,166 server unit tests pass.
The API returns HTTP 200, the live report loads, and preset creation, rename, and
deletion pass through the UI. The temporary preset was removed without changing
the saved report. Docker is not running, so the full database integration suite,
migration rollback, and both database drivers still need isolated checks.
