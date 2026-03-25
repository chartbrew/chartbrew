# HeroUI v3 Migration Progress

## Scope

Target: `chartbrew-os/client`

Goals:
- Migrate HeroUI v2 usage to direct HeroUI v3 code.
- Preserve visual language from `tailwind.config.js`; theme via CSS variables in `src/input.css`.
- Replace local layout helpers where appropriate: `Row.jsx` → flex rows, `Text.jsx` → plain text, `Container.jsx` → `Surface`.

## Migration rules

- No `HeroUIProvider`
- No v2/v3 coexistence through runtime shims
- No `@heroui/theme` aliasing
- Prefer direct v3 components and compound patterns
- Use plain HTML/Tailwind for removed components such as `Spacer`, `Image`, `User`, and `Navbar`
- DO NOT USE CLEVER REWRITE SCRIPTS TO MIGRATE THE CODE.
- DO NOT CHANGE CODE THAT IS NOT DIRECTLY RELATED TO THE HEROUI V3 MIGRATION.
- JUST REPLACE V2 COMPONENTS WITH V3 COMPONENTS AND MAKE SURE THE CODE IS CORRECT.
- DON'T WRITE CLEVER ADAPTERS TO WIRE OLD V2 CODE TO WORK IN V3
- Treat this progress file as the source of truth for migration scope and constraints.
- Continue only with direct v2 -> v3 component migrations.
- Keep edits surgical and local to the component being migrated.
- No adapters, no compatibility layers, no helper shims, and no migration-through-abstraction.
- No repo-wide rewrite scripts, codemods, or bulk formatting passes.
- No formatting churn: preserve existing code style, spacing, and line structure as much as possible.
- No unrelated refactors, cleanup, renames, or style rewrites while migrating a HeroUI component.
- Change only what is required to make the specific v3 component migration correct.
- Prefer file-by-file manual edits for each component family so the eventual merge into `chartbrew-cloud` stays manageable.
- Keep logging the exact migrated files in this document after each batch.

## Current strategy

1. Theme stays in `src/input.css` / CSS variables.
2. Migrate shared wrappers and root setup first; remove temporary aliasing.
3. Replace invalid v2 imports with real v3 or plain markup.
4. Component families were tackled in waves: Modal → Select/Autocomplete → layout primitives → Card/ListBox/Popover/Drawer/Progress/Table/Tooltip, etc.

## History note

2026-03-24: tree revalidated after a **reverted** migration in another thread. Older batch notes may describe work that was later re-done. **Current** import surface: see **Remaining hard blockers** (below) and grep checks there.

## Completed

- [x] Audit HeroUI usage; official v3 docs reference
- [x] Theme tokens → `src/input.css`; remove `HeroUIProvider` / `createTheme`
- [x] v3-compatible packages; remove Vite `@heroui/react` alias and `src/lib/heroui-compat.jsx`
- [x] Migrate `Row`, `Text`, `Container`, `Badge`; repoint `semanticColors` → `src/lib/themeTokens.js`

## Verification (default)

Unless a batch says otherwise: **`npm run lint`** and **`npm run build`** in `client/`. ESLint does not catch missing `@heroui/react` exports — use **`npm run build`** when fixing imports.

---

## Batches (compressed)

### Batches 1–3: Foundation

- **1:** `Container`, `Row`, `Text`, `Badge`, `App.jsx`, `ThemeContext`, `input.css`, `tailwind.config.js`; removed `src/theme.js`.
- **2:** App shell first pass: `Navbar`, `Sidebar`, `AccountNav`, `TopNav`, `SimpleNavbar` (later tightened in revalidation passes).
- **3:** `vite.config.js`, `themeTokens.js`, `Main.jsx` (v3 modal compounds), chart + connection files off shimmed `semanticColors`.

### Batch 4: Mechanical renames (~85 files)

Repo-wide renames: **`Divider` → `Separator`**, **`CircularProgress` → `ProgressCircle`**, **`Textarea` → `TextArea`**, **`TimeInput` → `TimeField`** (import/name only; structural fixes in later batches). Scope: `components/`, `containers/AddChart/**`, `Chart/**`, `Connections/**`, `Dataset/**`, `ProjectDashboard/**`, `PublicDashboard/**`, `Settings/**`, `UserDashboard/**`, `Integrations/**`, and related entrypoints.

### Batches 5–12: Modal compounds (first pass)

**Pattern:** `Modal.Backdrop` / `Modal.Container` / `Modal.Dialog` / `Modal.Header` / `Modal.Heading` / `Modal.Body` / `Modal.Footer`. **Props:** `backdrop` → `Modal.Backdrop` `variant`; `size` / width → `Modal.Container` or `Modal.Dialog` classes; `scrollBehavior` → `Modal.Container` `scroll`. **Buttons (where touched):** `isLoading` → `isPending`; `variant="bordered"` → `secondary`; `variant="flat"` → `tertiary`; `onClick` → `onPress` on HeroUI buttons; trim redundant `color="primary"`. Covered components, settings, dashboards, Add Chart, query builders, chart/integrations/public flows — modal wrappers eliminated across `client/src` by end of wave.

### Batch 13: Select / Autocomplete import surface

**`src/components/HeroUIPickers.jsx`:** shared v3 **`Select.*`**, **`Autocomplete.*`**, **`ListBox.Item`** composition. Replaced **`SelectItem` / `AutocompleteItem`** app-wide with **`ListBoxItem`** wrapper / direct **`ListBox.Item`**, preserving `selectedKey(s)`, `onSelectionChange`, and item slots where needed.

### Batches 14–17: Post-revert modal cleanup

Re-migrated reverted app shell and container modals; finished remaining **`ModalContent` / `ModalHeader` / `ModalBody` / `ModalFooter`** → v3 compounds. **`rg`** for old modal wrappers → no matches after this wave.

### Batches 18–29: Direct picker migration (incremental)

Replaced remaining picker items with v3 **`Select` / `Autocomplete` + `ListBox` / `ListBox.Item` / `ListBox.ItemIndicator`** (and **`SearchField`** where needed). **Contract (stabilized ~Batch 20):** explicit **`selectionMode`**; **`onChange`** uses **`Key`** for single-select and **`Key[]`** for multi. **`ChartFilters.jsx`**: completed in Batch 29 (typed custom values kept local). Final state: no **`SelectItem` / `AutocompleteItem`** in `client/src`.

### Phases 1–2: `Spacer` removal

**Phase 1:** templates, shared components, auth, admin/public views — **`Spacer` → `gap-*` / `h-*` / `w-*`**. **Phase 2:** datasets, dashboards, Add Chart, AI, integrations, Customer.io, chart/export/embed, settings — same rule, spacing-only edits.

### Phase 3: `Code` → `<code>`

Replaced HeroUI **`Code`** with **`<code>`** + Tailwind (`bg-default/40 text-default-700`, primary variant → accent classes, `size="sm"` → `text-sm`, `radius="sm"` → `rounded-sm`).

### Batch 30: `Card` compounds

**`CardHeader` / `CardBody` / `CardFooter` → `Card.Header` / `Card.Content` / `Card.Footer`**. Root **`Card`** v2-only props cleaned in Batch 38.

### Batch 31: `Listbox` → `ListBox`

**`Listbox` / `ListboxItem` → `ListBox` / `ListBox.Item`**. **Notable behavior:** **`ChartSharing`** — `selectedKeys` as **`Set`**; **`ProjectDashboard`** member list — `selectionMode="none"`, composed rows; **`ProjectNavigation`** — **`onAction`** on items; **`AiModal`** — **`renderEmptyState`**, selection via **`onAction`**.

### Batch 32: `Image` / `CircularProgress`

HeroUI **`Image` → native `<img>`** + Tailwind. **`CircularProgress` → `ProgressCircle`** (e.g. `classNames` → `className` on root).

### Batch 33: `Popover` compounds

**`PopoverTrigger` / `PopoverContent` → `Popover.Trigger` / `Popover.Content` / `Popover.Dialog`**. **`placement`** / width classes on **`Popover.Content`**. **`TableComponent.jsx`:** avoid **`Button`** inside **`Popover.Trigger`** (nested interactive).

### Batch 34: `Drawer` compounds

**`DrawerContent` / `Header` / `Body` / `Footer` → `Drawer.*`**. Controlled: **`onClose` → `onOpenChange`**. **`placement`**, panel width, **`backdrop`** → **`Drawer.Content`** / **`Drawer.Backdrop`** `variant`. **`AddFilters` / `SharingSettings`:** v2-only props dropped; widths via **`className`**.

### Batch 35: Linear `Progress` → `ProgressBar`

**`ProgressBar` / `ProgressBar.Track` / `ProgressBar.Fill`**. Dataset color on fills via **`style`** where needed.

### Batch 36: `Divider` → `Separator`

v3 has no **`Divider`**. **`showDivider`** on dropdown items left as-is (different API).

### Batch 37: `AvatarGroup`, `TimeField`, `TextArea`, `commonColors`, public header

Stacked avatars: **`-space-x-2`**, rings, **`Avatar.Image` / `Avatar.Fallback`**. **`TimeInput` → `TimeField`** compound. **`Textarea` → `TextArea`** (e.g. `maxRows` → `rows`). **`commonColors`** from **`themeTokens.js`**. Public **`Navbar` → `<header>`** + flex.

### Batch 38: Root `Card` v3-only props

Root **`Card`**: **`variant`**, **`className`**, **`children`** only. Removed **`shadow`**, **`radius`**, **`isPressable`**, **`isHoverable`**, **`fullWidth`**, **`onPress`**, invalid **`variant="bordered"`** — moved to Tailwind + **`onClick`** + keyboard handling for clickable cards.

### Batches 39–41: `Table`, `Chip`, `Avatar`, `Tooltip`

- **39:** **`Table.ScrollContainer` + `Table.Content`**; **`isRowHeader`**; **`renderEmptyState`**; striping via Tailwind; pagination in **`Table.Footer`**; selection/`id` on rows where needed.
- **40–41:** **`Chip`**: no **`radius`** prop — **`className="rounded-sm"`**. **`Avatar`**: compound + **`className`** for radius. **`Tooltip`**: compound **`Tooltip.Trigger` / `Tooltip.Content`**; high z-index via **`Tooltip.Content` `className`** (not Stitches **`css`**).

### Batch 42: Stitches `css={{}}` removal

Replaced remaining **`css`** on JSX with **`className`** / **`style`**; extended **`Tooltip`** compound pass in builders + **`ChartSharing`** / datasets; tooltip avatars use **`Avatar.Image` / `Avatar.Fallback`** + ring.

### Batches 43–44: `Tooltip` shorthand eliminated

**`<Tooltip content={…}>` → `Tooltip.Trigger` + `Tooltip.Content`**. Placements: space-separated (**`right end`**, not kebab). **`Sidebar`:** tooltips only when rail collapsed. **Batch 44:** builders/forms — placement normalization (`top-start` → `top start`, etc.). **Grep:** no **`content=`** on **`Tooltip`** left in `client/src`.

### Batch 45: `fullWidth` + `radius` audit

- **`fullWidth`:** supported on **`Input`**, **`TextArea`**, **`Select`**, **`Button`**, **`ButtonGroup`**, etc. (**`@heroui/styles`**) — do **not** mass-replace with **`w-full`** unless fixing a specific bug.
- **`Tabs`:** no **`fullWidth`** variant on root — use **`className`** on list/container if needed; **no** `<Tabs fullWidth>` in tree.
- **`ButtonGroup fullWidth`:** valid (e.g. **`TextWidget`**).
- **No** stray **`radius=`** on HeroUI JSX (unrelated “radius” in charts/CSS only). **No code changes** this batch — policy only.

### Batch 46: `Dropdown` compound (`Dropdown.Popover` + `Dropdown.Menu` + `Dropdown.Item`)

v3 menus must sit under **`Dropdown.Popover`** (React Aria **`Popover`**). Replaced flat **`DropdownTrigger` / `DropdownMenu` / `DropdownItem`** imports and JSX with **`Dropdown.Trigger`**, **`Dropdown.Popover`**, **`Dropdown.Menu`**, **`Dropdown.Item`**. **`key=`** on items → **`id=`** where needed for **`disabledKeys`**, **`onAction`**, and selection; kept React **`key=`** on mapped items where required. Normalized a few adjacent props (**`Button variant="flat"` → `tertiary`**, **`Chip variant="flat"`** / **`color="danger"`** on items → **`variant="danger"`** / **`secondary`**) only where touched.

**Files:** **`AiModal.jsx`**, **`TeamMembers.jsx`**, **`DashboardList.jsx`**, **`TextWidget.jsx`**, **`Chart.jsx`**, **`ProjectDashboard.jsx`**, **`TableComponent.jsx`**, **`ConnectionList.jsx`**, **`DatasetList.jsx`**, **`DatasetFilters.jsx`**, **`TableConfiguration.jsx`**, **`FieldFilter.jsx`**, **`SharedChart.jsx`**, **`DashboardFilters.jsx`**, **`TopNav.jsx`**.

**Grep:** `client/src` — no **`DropdownTrigger`**, **`DropdownMenu`**, or **`DropdownItem`** as separate imports/JSX tags.

Verification: **`npm run lint`** and **`npm run build`** pass in `client/` (2026-03-24).

### Batch 47: post–Batch 46 sweep — `TableBody` + `ProgressCircle`

- **`QueryResultsTable.jsx`:** Replaced v2 **`emptyContent`** on **`TableBody`** with RAC **`renderEmptyState`**. Wrapped table in **`Table.ScrollContainer`** + **`Table.Content`** ( **`aria-label`** on **`Table.Content`** ); removed invalid root **`isStriped`**; striping via **`even:[&_tbody>tr]:bg-content2/30`** on **`Table.Content`** (same pattern as **`SlackIntegrationsList`**). Added **`border-1 border-divider rounded-lg shadow-none`** on root **`Table`** for consistency with other v3 tables.
- **`SharedChart.jsx`**, **`EmbeddedChart.jsx`:** **`ProgressCircle`** — **`classNames={{ svg: … }}`** (unsupported) → **`className="w-4 h-4"`** (matches **`Chart.jsx`**).

**Grep:** no **`emptyContent=`** on **`TableBody`** in `client/src`; no **`ProgressCircle classNames`** in `client/src`.

Verification: **`npm run lint`** and **`npm run build`** pass in `client/` (2026-03-24).

### Batch 48: `Button` loading — `Spinner` via **`ButtonSpinner`**

HeroUI v3 **`Button`** has no built-in loading UI (no v2 **`isLoading`**). Added **`client/src/components/ButtonSpinner.jsx`**: **`Spinner`** with **`color="current"`**, **`size="sm"`**, **`className="shrink-0"`** for use in **`startContent`** / icon-only children.

Replaced **`isLoading={…}`** on **`Button`** across **`client/src`**: pair with **`isDisabled={…}`** (merged with existing disabled rules) and show **`ButtonSpinner`** while pending. For buttons with **`endContent`** icons, hide **`endContent`** when loading and use **`startContent={<ButtonSpinner />}`** so layout stays stable.

**Not changed (still valid as non-Button props or need a separate pass):** **`Select` / `Autocomplete`** **`isLoading=`** (e.g. **`CampaignsQuery`**, **`DatasetBuilder`**, **`ActivitiesQuery`**); **`SlackIntegration`** channel **`Select`**. Some **`Button`** instances still use React Aria **`isPending=`** (e.g. **`Chart.jsx`**, list rows) — optional follow-up to align with **`ButtonSpinner`** for a single visual language.

Verification: **`npm run lint`** and **`npm run build`** pass in `client/` (2026-03-24).

### Batch 49: Select / Autocomplete async — `isLoading` → `isPending`

RAC/HeroUI v3 collection triggers use **`isPending`** (not v2 **`isLoading`**).

**Files:** **`SlackIntegration.jsx`**, **`DatasetBuilder.jsx`**, **`CampaignsQuery.jsx`**, **`ActivitiesQuery.jsx`**.

**Grep:** no **`isLoading=`** on **`Select` / `Autocomplete`** in `client/src`.

Verification: **`npm run lint`** and **`npm run build`** pass in `client/` (2026-03-24).

### Batch 50: `variant="bordered"` → v3 variants

- **`Input` / `TextArea` / `Button` / `Chip` (where used):** **`variant="bordered"` → `variant="secondary"`** (v3 outlined style).
- **`Accordion` root** (v3 allows **`default` | `surface` only):** **`variant="bordered"` → `variant="surface"`** on **`TableConfiguration.jsx`**, **`DataTransform.jsx`**, **`RealtimeDbConnectionForm.jsx`**, **`CustomerioConnectionForm.jsx`**, **`FirestoreConnectionForm.jsx`**.
- **`DataTransform.jsx`:** removed invalid **`variant="bordered"`** on **`AccordionItem`** (item slot has no bordered variant in v3).

Repo-wide in **`client/src`**: **`rg 'variant="bordered"'`** → **0** after this batch.

Verification: **`npm run lint`** and **`npm run build`** pass in `client/` (2026-03-24).

---

## Remaining hard blockers

Expect **zero** legacy surfaces below in `client/src` (confirm with **`rg`** when in doubt):

| Area | Status |
|------|--------|
| `ModalContent` / `ModalHeader` / `ModalBody` / `ModalFooter` | 0 — use `Modal.*` compounds |
| `SelectItem` / `AutocompleteItem` | 0 — use `Select` / `Autocomplete` + `ListBox.Item` |
| `Spacer` | 0 — Tailwind spacing |
| `Code` (HeroUI) | 0 — `<code>` + Tailwind |
| `CardBody` / `CardHeader` / `CardFooter` | 0 — `Card.Content` / `Header` / `Footer` |
| `Listbox` / `ListboxItem` | 0 — `ListBox` / `ListBox.Item` |
| `Image` / `CircularProgress` (HeroUI) | 0 — `<img>` / `ProgressCircle` |
| `PopoverTrigger` / `PopoverContent` | 0 — `Popover.*` |
| Flat `DrawerContent` / `DrawerHeader` / `DrawerBody` / `DrawerFooter` | 0 — `Drawer.*` |
| Linear `Progress` (HeroUI) | 0 — `ProgressBar` compound |
| `Divider` (HeroUI) | 0 — `Separator` |
| `AvatarGroup` | 0 — stacked `Avatar` |
| `TimeInput` | 0 — `TimeField` compound |
| `Navbar` / `NavbarBrand` (HeroUI, public) | 0 — plain `<header>` |
| v2-only root **`Card`** props | 0 — Batch 38 |
| v2-only root **`Table`** props | 0 — Batches 39–41 |
| **`Chip`** **`radius=`** | 0 — Batches 40–41 |
| **`Tooltip`** + Stitches **`css` z-index** | 0 — Batch 41+ |
| Stitches / NextUI **`css={{}}`** on JSX | 0 — Batch 42 |
| Flat **`DropdownTrigger` / `DropdownMenu` / `DropdownItem`** | 0 — Batch 46; use **`Dropdown.Trigger`**, **`Dropdown.Popover`**, **`Dropdown.Menu`**, **`Dropdown.Item`** |
| v2 **`variant="bordered"`** on HeroUI **`Input` / `Button` / …** | 0 — Batch 50; use **`secondary`** (or **`Accordion` `surface`**) |
| Flat **`AccordionItem`** / **`title=`** / **`subtitle=`** on accordion | 0 — Batches 51–52; use **`Accordion.Item`** + **`Heading` / `Trigger` / `Indicator` / `Panel` / `Body`** |
| v2 **`variant="flat"`** on **`Chip` / `Button` / `Select` / `Alert`** | 0 — Batch 54; **`Chip` → `soft`** (or **`variant` `primary`/`secondary`**) / **`Button` → `tertiary`/`secondary`/`danger-soft`/`primary`** / **`Select` → `primary`** / **`Alert` → `status`** |

## Batch 51 (follow-ups)

- **`DataTransform.jsx`:** **`Accordion.Item`** + **`Heading` / `Trigger` / `Indicator` / `Panel` / `Body`** (surface variant); dropped flat **`AccordionItem`** import.
- **`ManageTeam.jsx`:** **`Tabs.ListContainer`** + **`Tabs.List`** with **`className`** border (no root **`classNames.tabList`**).
- **`Button` `onClick` → `onPress`:** **`Chart.jsx`**, **`CustomerQuery.jsx`** (HeroUI buttons only), **`Variables.jsx`**, **`DatasetAlerts.jsx`**; icon row uses **`variant="primary"`** / **`danger-soft`** where **`light` / `color`** were invalid.
- **`DatasetAlerts.jsx`:** **`Link` `onClick` → `onPress`**; **`variant` `light` → `tertiary`**; medium toggles **`bordered`/`solid` → `outline`/`secondary`**; **`Chip` `solid`/`faded` → `primary`/`soft`**; save **`disabled` → `isDisabled`**; removed invalid **`auto`** on buttons.
- **v2 `classNames` on fields:** **`ChartFilters`**, **`ApiBuilder`**, **`CampaignsQuery`**, **`FieldFilter`**, **`VariableFilter`**, **`DateRangeFilter`** — **`className`** (and **`Chip` `flat` → `soft`** where touched).
- **`ProjectDashboard.jsx`:** tutorial dot via **`Badge.Anchor`** + **`Badge`** (pulse **`className`**); **`Dropdown.Trigger` `onClick` → `onPress`**.
- **`AiModal.jsx`:** previous-conversations **`Accordion`** compounds (default variant; **`light`** invalid); **`AccordionItem`** import removed; **`Button`/`Chip`** **`light` → `tertiary`/`soft`**.

## Batch 52 (accordion sweep)

- **`CustomerioConnectionForm.jsx`**, **`FirestoreConnectionForm.jsx`**, **`RealtimeDbConnectionForm.jsx`:** help sections → **`Accordion.Item`** + compounds (`variant="surface"` unchanged).
- **`InviteMembersForm.jsx`:** dashboard access → compounds; invalid root **`variant="secondary"`** → **`surface`**.
- **`TableConfiguration.jsx`:** column options → compounds; custom **`LuSettings`** via **`Accordion.Indicator`**; **`fullWidth`** → **`className="w-full"`**; cancel reorder **`Button` `light` → `tertiary`**.
- **`client/src`:** zero **`AccordionItem`** imports/usages (confirm: **`rg AccordionItem src`**).

## Batch 53 (v3 variant / input cleanup)

- **`TableConfiguration.jsx`:** drop invalid **`Dropdown.Menu` `variant="flat"`**; hidden-field **`Chip` `flat` → `soft`**; reorder **`Button` `faded` + invalid `color` → `secondary` / `primary`**; cancel **`tertiary` + `color` → `danger-soft`**.
- **`TeamSettings.jsx`:** **`Input` `classNames` → `className`**; validation via **`isInvalid` / `errorMessage`**; save **`Button` v2 `flat`/`solid`/`color` → `secondary` / `primary`**.
- **`InviteMembersForm.jsx`:** copy **`Button` `light` → `tertiary`/`primary`**; role **`Chip` `flat` → `soft`**.
- **`FirestoreConnectionForm.jsx` / `RealtimeDbConnectionForm.jsx`:** connection name (and URL) **`Input` `color`/`description` → `isInvalid`/`errorMessage`**; JSON toggle + footer **`Button` `onClick` → `onPress`**; remove **`auto`**; **`faded`/`color` → `tertiary`/`primary`/`ghost`** as appropriate.
- **`DateRangeFilter.jsx`:** **`DateRangePicker` `faded` → `secondary`**; preset **`Chip` `flat` → `soft`**.
- **`ProjectDashboard.jsx`:** member role + snapshot **`Chip` `flat`/invalid combos → `soft`**.
- **`AiModal.jsx`:** tool/chart/context **`Chip` `flat` → `soft`**; suggestion + link-styled **`Button` `flat` → `secondary`/`tertiary`**; remove invalid **`color`** on **`Button`** where replaced by variant.

## Batch 54 (`variant="flat"` sweep — complete)

- **`client/src`:** zero **`variant="flat"`** / **`variant={"flat"}`** on HeroUI components (confirm: **`rg 'variant="flat"' src`**, brace forms).
- **Targeted edits (examples):** **`ApiBuilder.jsx`** — variable **`Chip`** **`variant="primary"`**; Transform control via **`Badge.Anchor`** + conditional **`Badge`** (replaces v2 **`Badge`** **`content`/`isInvisible`**); **`Button`** **`tertiary`/`danger-soft`/`secondary`/`primary`**; drawer Close/Save variants.
- **`DatasetQuery.jsx`**, **`Chart.jsx`**, **`CampaignsQuery.jsx`**, **`SlackIntegrationsList.jsx`**, **`VisualSQL.jsx`** — **`Chip` `flat` → `soft`** or **`variant` `primary`/`secondary`**; **`Button` `flat` → `tertiary`/`primary`/`danger-soft`**; **`Tabs` `solid`/`light` → `primary`/`secondary`**; **`Select` `flat`+invalid `color` → `variant="primary"`**; variables **`Alert` `flat` → `status="accent"`**.
- **Bulk assist:** scripted pass for **`Dropdown.Menu`** (drop invalid **`variant="flat"`**), **`Chip`/`Button`/`Select`/`Alert`** where **`flat`** was on one line with the opening tag; second pass for **multiline** openings + strip invalid **`Button` `color`** when paired with **`tertiary`/`secondary`/`danger-soft`**.
- **Also touched (same sweep):** **`TableDataFormattingModal`** (preview swatches **`soft`**; chart config still stores legacy **`flat`** string), **`ApiPagination`**, **`ConnectionList`**, **`DatasetList`**, **`ChartDatasetConfig`** sort toggles, **`EditFieldFilter`**, **`ConnectionWizard`**, **`DashboardList`**, and remaining **`src`** call sites from the script list.
- **Brace cleanup:** **`TeamMembers`**, **`ChartPreview`**, **`DatarequestSettings`**, **`TableComponent`** — **`variant={"flat"}`** / invalid **`Chip` `color`+`flat`** combos.

## Batch 55 (`variant="light"` → **`ghost`** / **`Chip`** + **`Button`** cleanup)

- **`variant="light"`** on **`Button`** / **`Tabs`** / **`Chip`:** scripted pass → **`Button`** **`ghost`** (strip invalid **`color`** on ghost **`Button`**), **`Tabs`** **`secondary`**, **`Chip`** **`soft`** where applicable.
- **Lint follow-up:** **`SqlBuilder`**, **`MongoQueryBuilder`**, **`ClickHouseBuilder`** — **`useState` success flags** → **`[, setX]`** (value unused); **`ProjectSettings`** — remove dead **`success`/`error`** state (toasts remain).
- **`SnapshotSchedule.jsx`:** medium toggles **`flat`/`solid`** → **`tertiary`/`primary`**; remove **`auto`**; viewport **`ButtonGroup`** — drop invalid **`color`** on ghost children, use **`className` `bg-primary/15`** when selected.
- **`Chip` `@heroui/styles` alignment:** invalid **`color="primary"`** / **`color="secondary"`** (chip colors are **`accent`/`danger`/`default`/`success`/`warning`**) → **`variant="primary"`** / **`variant="secondary"`**; **`Postgres`/`Mysql`** test result **`Chip`** — replace v2 **`type=`** with **`color` + `variant="soft"`**; **`FirestoreBuilder`** collection/subcollection chips **`flat`/`solid`/`bordered`** → **`soft`/`primary`**; condition value **`faded` → `tertiary`**; refresh **`Button`** drop **`color`** on **`ghost`**.
- **`ChartDatasets.jsx`**, **`DatasetList.jsx` (tag modal)**, **`SlackIntegration`**, **`AiModal`**, **`InviteMembersForm`**, **`FirestoreConnectionForm`:** same **`Chip`** rules.
- **`ProjectSettings.jsx`:** **`Input`** — remove invalid **`color`**, use **`isInvalid`** for name validation.

## Verification

- **`npm run lint`** — passes
- **`npm run build`** (`client/`) — passes (last verified after Batch 55)

## Next batch

1. **Legacy **`Alert`** API** (**`title`**, **`description`**, **`icon`**, **`color`**, **`variant`** on root) → **`Alert`/`Alert.Indicator`/`Alert.Content`/`Alert.Title`/`Alert.Description`** compounds + **`status`** (largest visual/behavior win after variant sweeps).
2. Remaining **`Button` `variant="solid"`** / invalid v2 props (**`TableDataFormattingModal`**, **`AddChart`**, etc.) if any still present.
3. Keep **`npm run build`** after import-surface edits.

## Notes

- Compatibility-layer approach was discarded; client targets real **`@heroui/react`** surface.
- **`npm run build`** catches missing exports that lint misses.
