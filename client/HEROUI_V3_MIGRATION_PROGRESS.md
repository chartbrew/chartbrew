# HeroUI v3 Migration Progress

## Scope

Target: `chartbrew-os/client`

Goals:
- Migrate HeroUI v2 usage to direct HeroUI v3 code.
- Preserve the existing visual language from `tailwind.config.js`.
- Move theme customization to CSS variables in `src/input.css`.
- Replace local layout helpers where appropriate:
  - `Row.jsx` -> plain flex row wrappers
  - `Text.jsx` -> plain text elements
  - `Container.jsx` -> `Surface`

## Migration Rules

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

## Current Strategy

1. Keep the theme migration in `src/input.css` and CSS variables.
2. Migrate shared local wrappers and root setup first.
3. Remove all temporary compatibility aliasing.
4. Replace invalid v2-only imports with real v3 components or plain HTML.
5. Convert remaining call sites to direct v3 structure in batches:
   - Modal
   - Select / Autocomplete
   - ListBox
   - Card (compound `Card.Header` / `Card.Content` / `Card.Footer` — see Batch 30)
   - Progress / loader states

## Revalidation Audit

- 2026-03-24: Revalidated the tree after a reverted/bad migration attempt in another thread.
- Current real blocker counts after audit:
  - `0` files still use old modal wrappers (`ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter`)
  - `45` files still use old `SelectItem` / `AutocompleteItem` patterns
- Any earlier batch notes that claimed modal completion should be treated as historical work, not as the current tree state.
- Any earlier batch notes that claimed `SelectItem` / `AutocompleteItem` completion should also be treated as historical work from the reverted migration attempt, not as the current tree state.
- Reverted files must be migrated again manually, with the same no-shims / no-format-churn rules above.

## Completed

- [x] Audit HeroUI usage in `chartbrew-os/client`
- [x] Fetch official HeroUI migration and v3 component docs
- [x] Move theme tokens from `tailwind.config.js` to `src/input.css`
- [x] Remove `HeroUIProvider` and `createTheme` usage
- [x] Switch client dependencies to HeroUI v3-compatible packages
- [x] Migrate shared local wrappers (`Row`, `Text`, `Container`, `Badge`)
- [x] Remove the Vite alias that redirected `@heroui/react` to a local compat file
- [x] Delete `src/lib/heroui-compat.jsx`
- [x] Repoint `semanticColors` usage to `src/lib/themeTokens.js`

## Batches

### Batch 1: Shared Foundation

Files migrated:
- `src/components/Container.jsx`
- `src/components/Row.jsx`
- `src/components/Text.jsx`
- `src/components/Badge.jsx`
- `src/App.jsx`
- `src/modules/ThemeContext.jsx`
- `src/input.css`
- `tailwind.config.js`
- `src/theme.js` removed

Notes:
- Shared layout/text helpers were moved away from v2-style wrappers.
- App theming now flows through CSS variables and the document theme class.

### Batch 2: Navigation / App Shell First Pass

Files migrated:
- `src/components/Navbar.jsx`
- `src/components/Sidebar.jsx`
- `src/components/AccountNav.jsx`
- `src/components/TopNav.jsx`
- `src/components/SimpleNavbar.jsx`

Notes:
- These files were moved away from v2 `Navbar`-style layouts.
- This batch still needs a stricter follow-up pass to normalize remaining v3 structure.

### Batch 3: Direct v3 Baseline

Files migrated:
- `vite.config.js`
- `src/lib/themeTokens.js`
- `src/containers/Main.jsx`
- `src/containers/Chart/components/GaugeChart.jsx`
- `src/containers/Chart/components/PieChart.jsx`
- `src/containers/Chart/components/DoughnutChart.jsx`
- `src/containers/Chart/components/RadarChart.jsx`
- `src/containers/Chart/components/MatrixChart.jsx`
- `src/containers/Chart/components/LineChart.jsx`
- `src/containers/Chart/components/BarChart.jsx`
- `src/containers/Chart/components/PolarChart.jsx`
- `src/containers/Connections/Firestore/FirestoreConnectionForm.jsx`
- `src/containers/Connections/RealtimeDb/RealtimeDbConnectionForm.jsx`

Notes:
- The repo is no longer routed through a local `@heroui/react` compatibility file.
- `Main.jsx` feedback modal now uses the v3 `Modal.Backdrop` / `Modal.Container` / `Modal.Dialog` structure.
- Chart and connection files that depended on shimmed `semanticColors` now import local tokens directly.

### Batch 4: Mechanical Renamed Primitive Pass

Files migrated:
- `src/components/DatasetFilters.jsx`
- `src/components/FeedbackForm.jsx`
- `src/components/HelpBanner.jsx`
- `src/components/LoginForm.jsx`
- `src/components/SavedQueries.jsx`
- `src/components/Sidebar.jsx`
- `src/components/TableConfiguration.jsx`
- `src/containers/AddChart/AddChart.jsx`
- `src/containers/AddChart/components/ApiBuilder.jsx`
- `src/containers/AddChart/components/ApiPagination.jsx`
- `src/containers/AddChart/components/ChartDatasetConfig.jsx`
- `src/containers/AddChart/components/ChartDatasetDataSetup.jsx`
- `src/containers/AddChart/components/ChartDatasets.jsx`
- `src/containers/AddChart/components/ChartDescription.jsx`
- `src/containers/AddChart/components/ChartPreview.jsx`
- `src/containers/AddChart/components/ChartSettings.jsx`
- `src/containers/AddChart/components/DatarequestModal.jsx`
- `src/containers/AddChart/components/Dataset.jsx`
- `src/containers/AddChart/components/DatasetData.jsx`
- `src/containers/AddChart/components/MongoQueryBuilder.jsx`
- `src/containers/AddChart/components/SqlBuilder.jsx`
- `src/containers/AddChart/components/TableDataFormattingModal.jsx`
- `src/containers/Ai/AiModal.jsx`
- `src/containers/ApiKeys/ApiKeys.jsx`
- `src/containers/Chart/Chart.jsx`
- `src/containers/Chart/TextWidget.jsx`
- `src/containers/Connections/ChartMogul/ChartMogulTemplate.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseBuilder.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseConnectionForm.jsx`
- `src/containers/Connections/ConnectionWizard.jsx`
- `src/containers/Connections/CustomTemplates/CustomTemplateForm.jsx`
- `src/containers/Connections/CustomTemplates/CustomTemplates.jsx`
- `src/containers/Connections/Customerio/ActivitiesQuery.jsx`
- `src/containers/Connections/Customerio/CampaignsQuery.jsx`
- `src/containers/Connections/Customerio/CustomerQuery.jsx`
- `src/containers/Connections/Customerio/CustomerioBuilder.jsx`
- `src/containers/Connections/Customerio/CustomerioConnectionForm.jsx`
- `src/containers/Connections/Firestore/FirestoreBuilder.jsx`
- `src/containers/Connections/Firestore/FirestoreConnectionForm.jsx`
- `src/containers/Connections/GoogleAnalytics/GaBuilder.jsx`
- `src/containers/Connections/GoogleAnalytics/GaConnectionForm.jsx`
- `src/containers/Connections/Mailgun/MailgunTemplate.jsx`
- `src/containers/Connections/Plausible/PlausibleTemplate.jsx`
- `src/containers/Connections/RealtimeDb/RealtimeDbBuilder.jsx`
- `src/containers/Connections/RealtimeDb/RealtimeDbConnectionForm.jsx`
- `src/containers/Connections/SimpleAnalytics/SimpleAnalyticsTemplate.jsx`
- `src/containers/Connections/components/ApiConnectionForm.jsx`
- `src/containers/Connections/components/MongoConnectionForm.jsx`
- `src/containers/Connections/components/MysqlConnectionForm.jsx`
- `src/containers/Connections/components/PostgresConnectionForm.jsx`
- `src/containers/Dataset/AiQuery.jsx`
- `src/containers/Dataset/DatarequestSettings.jsx`
- `src/containers/Dataset/DatasetBuilder.jsx`
- `src/containers/Dataset/DatasetQuery.jsx`
- `src/containers/EmbeddedChart.jsx`
- `src/containers/GoogleAuth.jsx`
- `src/containers/Integrations/Integration/SlackIntegration.jsx`
- `src/containers/Integrations/components/SlackIntegrationsList.jsx`
- `src/containers/Integrations/components/WebhookIntegrationsList.jsx`
- `src/containers/ProjectBoard/ProjectBoard.jsx`
- `src/containers/ProjectDashboard/ProjectDashboard.jsx`
- `src/containers/ProjectDashboard/components/AddFilters.jsx`
- `src/containers/ProjectDashboard/components/ChartExport.jsx`
- `src/containers/ProjectDashboard/components/EditFieldFilter.jsx`
- `src/containers/ProjectDashboard/components/EditVariableFilter.jsx`
- `src/containers/ProjectDashboard/components/SnapshotSchedule.jsx`
- `src/containers/ProjectDashboard/components/UpdateSchedule.jsx`
- `src/containers/ProjectRedirect.jsx`
- `src/containers/ProjectSettings.jsx`
- `src/containers/PublicDashboard/PublicDashboard.jsx`
- `src/containers/PublicDashboard/Report.jsx`
- `src/containers/PublicDashboard/components/SharingSettings.jsx`
- `src/containers/Settings/ManageTeam.jsx`
- `src/containers/Settings/ManageUser.jsx`
- `src/containers/Settings/TeamMembers.jsx`
- `src/containers/Settings/TeamSettings.jsx`
- `src/containers/SharedChart.jsx`
- `src/containers/Signup.jsx`
- `src/containers/UserDashboard/DatasetList.jsx`
- `src/containers/UserDashboard/UserDashboard.jsx`
- `src/containers/UserDashboard/components/NoticeBoard.jsx`
- `src/containers/UserDashboard/components/WhatsNewPanel.jsx`

Notes:
- Repo-wide mechanical rename pass completed for:
  - `Divider` -> `Separator`
  - `CircularProgress` -> `ProgressCircle`
  - `Textarea` -> `TextArea`
  - `TimeInput` -> `TimeField`
- This pass intentionally did not try to solve structural component rewrites.
- Verification:
  - `npm run lint` passes

### Batch 5: Component-Level Modal Compound Rewrite

Files migrated:
- `src/components/CreateTemplateForm.jsx`
- `src/components/QuickStartVideo.jsx`
- `src/components/LoginForm.jsx`
- `src/components/SavedQueries.jsx`

Notes:
- Replaced `ModalContent` wrapper structure with direct v3 compound usage:
  - `Modal.Backdrop`
  - `Modal.Container`
  - `Modal.Dialog`
  - `Modal.Header`
  - `Modal.Body`
  - `Modal.Footer`
  - `Modal.Heading`
- Normalized touched buttons toward v3 semantics in these files:
  - `variant="bordered"` -> `variant="secondary"`
  - `variant="flat"` -> `variant="tertiary"` where appropriate
  - `isLoading` -> `isPending`
  - removed `color="primary"` on touched buttons in favor of semantic variants
- Verification:
  - `npm run lint` passes

### Batch 6: Modal Compound Rewrite Follow-Up

Files migrated:
- `src/components/AccountNav.jsx`
- `src/components/Navbar.jsx`
- `src/components/Sidebar.jsx`
- `src/components/DatasetFilters.jsx`
- `src/components/ProjectForm.jsx`

Notes:
- Replaced the remaining old modal wrapper imports in this batch with direct v3 compound structure:
  - `Modal.Backdrop`
  - `Modal.Container`
  - `Modal.Dialog`
  - `Modal.Header`
  - `Modal.Body`
  - `Modal.Footer`
  - `Modal.Heading`
- Moved controlled modal state to `Modal.Backdrop` in the touched files.
- Normalized adjacent button props where the modal rewrite touched them:
  - `isLoading` -> `isPending`
  - `onClick` -> `onPress` for touched HeroUI buttons
  - `variant="bordered"` -> `variant="secondary"` for touched modal inputs
  - `variant="flat"` -> `variant="tertiary"` for touched dismissive actions
- `src/components/ProjectForm.jsx` now uses `Modal.Dialog` width classes instead of v2 modal size values.
- Verification:
  - `npm run lint` passes

### Batch 7: Modal Compound Rewrite, Containers

Files migrated:
- `src/containers/ApiKeys/ApiKeys.jsx`
- `src/containers/Chart/components/ChartSharing.jsx`
- `src/containers/Connections/ConnectionWizard.jsx`
- `src/containers/ProjectBoard/components/ProjectNavigation.jsx`

Notes:
- Replaced old modal wrapper imports in these container-level flows with direct v3 compound structure.
- Moved old modal props to their v3 locations where touched:
  - `backdrop` -> `Modal.Backdrop variant`
  - `size` -> `Modal.Container size` or `Modal.Dialog` width classes
  - `scrollBehavior` -> `Modal.Container scroll`
- Normalized touched HeroUI buttons inside the rewritten modal sections:
  - removed `startContent`
  - removed `color`
  - `variant="bordered"` -> `variant="secondary"`
  - `variant="flat"` -> `variant="tertiary"` where used as a dismissive secondary action
  - `isLoading` -> `isPending`
- Verification:
- `npm run lint` passes

### Batch 8: Modal Compound Rewrite, Settings and Variables

Files migrated:
- `src/containers/ProjectSettings.jsx`
- `src/containers/Settings/ManageUser.jsx`
- `src/containers/Settings/TeamMembers.jsx`
- `src/containers/Settings/TeamSettings.jsx`
- `src/containers/Variables/Variables.jsx`

Notes:
- Replaced old modal wrapper imports with direct v3 compound modal structure across settings and variable management flows.
- Moved touched modal props to the v3 surface:
  - `backdrop` -> `Modal.Backdrop variant`
  - invalid modal width values -> `Modal.Dialog` width classes or `Modal.Container size`
- Normalized touched controls inside the rewritten modal sections:
  - `variant="bordered"` -> `variant="secondary"`
  - `isLoading` -> `isPending`
  - `color="primary"` -> `variant="primary"`
  - `color="danger"` -> `variant="danger"`
  - cancel/close actions -> `slot="close"` where appropriate
- Verification:
  - `npm run lint` passes

### Batch 9: Modal Compound Rewrite, Dashboard and Connection Management

Files migrated:
- `src/containers/UserDashboard/DashboardList.jsx`
- `src/containers/UserDashboard/ConnectionList.jsx`
- `src/containers/ProjectDashboard/components/UpdateSchedule.jsx`

Notes:
- Replaced the remaining old modal wrapper imports in these dashboard/connection management flows with direct v3 compound structure.
- Normalized touched modal-local controls toward v3 semantics:
  - `variant="bordered"` -> `variant="secondary"`
  - `isLoading` -> `isPending`
  - `color="primary"` -> `variant="primary"`
  - `color="danger"` -> `variant="danger"`
  - `size="2xl"` -> `Modal.Dialog` width class
- `UpdateSchedule.jsx` still intentionally retains `SelectItem` / `AutocompleteItem` usage for the next component-family pass.
- Verification:
  - `npm run lint` passes

### Batch 10: Modal Compound Rewrite, Add Chart Forms

Files migrated:
- `src/containers/AddChart/components/ChartDatasetConfig.jsx`
- `src/containers/AddChart/components/ChartSettings.jsx`
- `src/containers/AddChart/components/DatarequestModal.jsx`
- `src/containers/AddChart/components/Dataset.jsx`
- `src/containers/AddChart/components/DatasetAlerts.jsx`
- `src/containers/AddChart/components/DatasetData.jsx`

Notes:
- Converted the remaining Add Chart modal flows to direct v3 compound structure.
- Preserved large form internals and deferred `SelectItem`, `CardBody`, and other non-modal surface rewrites to the next component-family passes.
- Verification:
  - `npm run lint` passes

### Batch 11: Modal Compound Rewrite, Query Builders and AI

Files migrated:
- `src/containers/AddChart/components/MongoQueryBuilder.jsx`
- `src/containers/AddChart/components/SqlBuilder.jsx`
- `src/containers/AddChart/components/TableDataFormattingModal.jsx`
- `src/containers/AddChart/components/VisualSQL.jsx`
- `src/containers/Ai/AiModal.jsx`

Notes:
- Replaced all old modal wrapper usage in the query-builder and AI flows with `Modal.Backdrop`, `Modal.Container`, and `Modal.Dialog`.
- Preserved the existing content trees and deferred non-modal v2 surface cleanup in these files.
- Verification:
  - `npm run lint` passes

### Batch 12: Modal Compound Rewrite, Remaining Screens

Files migrated:
- `src/containers/Chart/Chart.jsx`
- `src/containers/Chart/TextWidget.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseBuilder.jsx`
- `src/containers/Connections/CustomTemplates/CustomTemplateForm.jsx`
- `src/containers/Dataset/DataTransform.jsx`
- `src/containers/Dataset/Dataset.jsx`
- `src/containers/Integrations/Integration/SlackIntegration.jsx`
- `src/containers/Integrations/components/SlackIntegrationsList.jsx`
- `src/containers/Integrations/components/WebhookIntegrationsList.jsx`
- `src/containers/ProjectDashboard/ProjectDashboard.jsx`
- `src/containers/ProjectDashboard/components/DashboardFilters.jsx`
- `src/containers/ProjectDashboard/components/SnapshotSchedule.jsx`
- `src/containers/PublicDashboard/PublicDashboard.jsx`
- `src/containers/PublicDashboard/Report.jsx`
- `src/containers/UserDashboard/DatasetList.jsx`

Notes:
- Finished the remaining old modal wrapper call sites across chart management, integrations, public dashboard editing, and dataset screens.
- Modal-family migration is now complete across `client/src`.
- Verification:
  - `npm run lint` passes

### Batch 13: Select / Autocomplete Import-Surface Rewrite

Files migrated:
- `src/components/HeroUIPickers.jsx`
- `src/components/DatasetFilters.jsx`
- `src/containers/ProjectSettings.jsx`
- `src/containers/UserDashboard/DatasetList.jsx`
- `src/containers/Chart/Chart.jsx`
- `src/containers/Chart/components/ChartFilters.jsx`
- `src/containers/ProjectDashboard/components/AddFilters.jsx`
- `src/containers/ProjectDashboard/components/EditFieldFilter.jsx`
- `src/containers/ProjectDashboard/components/EditVariableFilter.jsx`
- `src/containers/ProjectDashboard/components/SnapshotSchedule.jsx`
- `src/containers/ProjectDashboard/components/UpdateSchedule.jsx`
- `src/containers/ProjectDashboard/components/VariableFilter.jsx`
- `src/containers/Dataset/DataTransform.jsx`
- `src/containers/Dataset/DatarequestSettings.jsx`
- `src/containers/Dataset/Dataset.jsx`
- `src/containers/Dataset/DatasetBuilder.jsx`
- `src/containers/AddChart/components/ApiBuilder.jsx`
- `src/containers/AddChart/components/ApiPagination.jsx`
- `src/containers/AddChart/components/ChartDatasetDataSetup.jsx`
- `src/containers/AddChart/components/ChartSettings.jsx`
- `src/containers/AddChart/components/DatasetAlerts.jsx`
- `src/containers/AddChart/components/DatasetData.jsx`
- `src/containers/AddChart/components/MongoQueryBuilder.jsx`
- `src/containers/AddChart/components/SqlBuilder.jsx`
- `src/containers/AddChart/components/TableDataFormattingModal.jsx`
- `src/containers/AddChart/components/VisualSQL.jsx`
- `src/containers/Connections/ChartMogul/ChartMogulTemplate.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseBuilder.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseConnectionForm.jsx`
- `src/containers/Connections/CustomTemplates/CustomTemplateForm.jsx`
- `src/containers/Connections/Customerio/ActivitiesQuery.jsx`
- `src/containers/Connections/Customerio/CampaignsQuery.jsx`
- `src/containers/Connections/Customerio/CustomerQuery.jsx`
- `src/containers/Connections/Customerio/CustomerioConnectionForm.jsx`
- `src/containers/Connections/Firestore/FirestoreBuilder.jsx`
- `src/containers/Connections/GoogleAnalytics/GaBuilder.jsx`
- `src/containers/Connections/GoogleAnalytics/GaTemplate.jsx`
- `src/containers/Connections/Mailgun/MailgunTemplate.jsx`
- `src/containers/Connections/Plausible/PlausibleTemplate.jsx`
- `src/containers/Connections/RealtimeDb/RealtimeDbBuilder.jsx`
- `src/containers/Connections/SimpleAnalytics/SimpleAnalyticsTemplate.jsx`
- `src/containers/Connections/components/ApiConnectionForm.jsx`
- `src/containers/Connections/components/MysqlConnectionForm.jsx`
- `src/containers/Connections/components/PostgresConnectionForm.jsx`
- `src/containers/Integrations/Auth/SlackAuth.jsx`
- `src/containers/Integrations/Integration/SlackIntegration.jsx`

Notes:
- Added a shared local picker surface in `src/components/HeroUIPickers.jsx` that renders the required HeroUI v3 compound structure:
  - `Select.Trigger`
  - `Select.Value`
  - `Select.Popover`
  - `Autocomplete.Trigger`
  - `Autocomplete.Popover`
  - `Autocomplete.Filter`
  - `ListBox.Item`
- Replaced all remaining `SelectItem` / `AutocompleteItem` call sites in `client/src` with the shared `ListBoxItem` wrapper built on v3 `ListBox.Item`.
- Preserved the current app-level prop surface where these screens still depend on it:
  - `selectedKey` / `selectedKeys`
  - `onSelectionChange`
  - legacy `variant="bordered"` / `size="sm"` styling expectations
  - item `startContent`, `endContent`, and `description`
- This batch removes the invalid HeroUI v2 item imports from the app code without reintroducing package aliasing or the old compat file.
- Verification:
  - `npm run lint` passes
  - `rg -n '\\b(SelectItem|AutocompleteItem)\\b' client/src` returns no matches

### Batch 14: App Shell Revalidation After Revert

Files migrated:
- `src/components/AccountNav.jsx`
- `src/components/Navbar.jsx`
- `src/components/Sidebar.jsx`

Notes:
- Re-migrated the reverted app-shell files manually after a bad migration attempt in another thread.
- Removed reverted v2 surfaces in these files and replaced them with direct v3 or plain markup where HeroUI v3 removed the old component:
  - old modal wrappers -> `Modal.Backdrop` / `Modal.Container` / `Modal.Dialog`
  - removed `Navbar` -> plain header layout
  - removed `User` / `Image` / `Spacer` -> plain markup or direct `Avatar` composition
  - old dropdown trigger/menu/item imports -> direct `Dropdown.*` composition
  - `CircularProgress` -> `ProgressCircle`
- Verification:
  - `npm run lint` passes

### Batch 15: Modal Wrapper Revalidation Follow-Up

Files migrated:
- `src/components/DatasetFilters.jsx`
- `src/containers/ProjectSettings.jsx`
- `src/containers/ProjectDashboard/components/UpdateSchedule.jsx`
- `src/containers/ProjectDashboard/components/SnapshotSchedule.jsx`

Notes:
- Continued the direct modal-family revalidation pass on files that were still using `ModalContent`, `ModalHeader`, `ModalBody`, and `ModalFooter`.
- Replaced only the modal wrapper surface in these files with:
  - `Modal.Backdrop`
  - `Modal.Container`
  - `Modal.Dialog`
  - `Modal.Header`
  - `Modal.Heading`
  - `Modal.Body`
  - `Modal.Footer`
- Normalized touched modal-local button loading/close props where the wrapper rewrite already touched those buttons:
  - `isLoading` -> `isPending`
  - `variant="bordered"` -> `variant="outline"` where touched in modal footers
- Verification:
  - `npm run lint` passes

### Batch 16: Add Chart Modal Wrapper Follow-Up

Files migrated:
- `src/containers/AddChart/components/MongoQueryBuilder.jsx`
- `src/containers/AddChart/components/ChartSettings.jsx`
- `src/containers/AddChart/components/SqlBuilder.jsx`

Notes:
- Continued the modal-only cleanup in smaller Add Chart files that still had the reverted `ModalContent` / `ModalHeader` / `ModalBody` / `ModalFooter` structure.
- Replaced those wrappers with direct v3 modal compounds while keeping the surrounding file structure intact.
- Normalized touched modal footer props where needed:
  - `variant="bordered"` -> `variant="outline"`
  - `disabled` -> `isDisabled` on touched HeroUI buttons
- Verification:
  - `npm run lint` passes

### Batch 17: Final Modal Wrapper Completion

Files migrated:
- `src/containers/Dataset/DataTransform.jsx`
- `src/containers/Dataset/Dataset.jsx`
- `src/containers/Chart/Chart.jsx`
- `src/containers/AddChart/components/DatasetAlerts.jsx`
- `src/containers/Connections/CustomTemplates/CustomTemplateForm.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseBuilder.jsx`
- `src/containers/AddChart/components/TableDataFormattingModal.jsx`
- `src/containers/Integrations/Integration/SlackIntegration.jsx`

Notes:
- Completed the remaining direct modal-family migration without touching unrelated file structure.
- Replaced the last `ModalContent` / `ModalHeader` / `ModalBody` / `ModalFooter` usage with:
  - `Modal.Backdrop`
  - `Modal.Container`
  - `Modal.Dialog`
  - `Modal.Header`
  - `Modal.Heading`
  - `Modal.Body`
  - `Modal.Footer`
- Kept the changes local to the modal sections and normalized only the touched modal footer buttons where needed:
  - `variant="bordered"` -> `variant="secondary"`
  - `variant="flat"` -> `variant="tertiary"`
  - `isLoading` -> `isPending`
  - `disabled` -> `isDisabled` on touched HeroUI buttons
- Verification:
  - `npm run lint` passes
  - `rg -l 'ModalContent|ModalHeader|ModalBody|ModalFooter' client/src` returns no matches

### Batch 18: Select Compound First Pass

Files migrated:
- `src/containers/Dataset/DataTransform.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseBuilder.jsx`
- `src/containers/Integrations/Integration/SlackIntegration.jsx`
- `src/containers/AddChart/components/TableDataFormattingModal.jsx`

Notes:
- Started the direct v3 picker rewrite on smaller local files before moving into the larger dashboard and autocomplete-heavy screens.
- Replaced `SelectItem` usage in these files with direct v3 `Select` composition:
  - `Label`
  - `Select.Trigger`
  - `Select.Value`
  - `Select.Indicator`
  - `Select.Popover`
  - `ListBox`
  - `ListBox.Item`
  - `ListBox.ItemIndicator`
- Kept the surrounding component logic in place and only adjusted the touched picker props to the v3 shape:
  - `selectedKeys` / `onSelectionChange` -> `value` / `onChange`
  - `variant="bordered"` -> `variant="secondary"` on migrated selects
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 19: Select Compound Follow-Up

Files migrated:
- `src/containers/ProjectDashboard/components/AddFilters.jsx`
- `src/containers/Dataset/DatarequestSettings.jsx`

Notes:
- Continued the select-family rewrite in files that still used only direct select surfaces and did not require the autocomplete migration yet.
- Replaced the remaining `SelectItem` usage in these files with direct v3 `Select` + `ListBox.Item` composition.
- Kept the existing dataset/join/filter logic intact and only changed the picker surface and its immediate value handlers:
  - `selectedKeys` / `onSelectionChange` -> `value` / `onChange`
  - `renderValue`, `startContent`, and `endContent` usage moved into explicit `Select.Trigger` composition where needed
  - `variant="bordered"` -> `variant="secondary"` on migrated selects
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 20: Picker Contract Correction + Mixed Picker Pass

Files migrated:
- `src/containers/Dataset/DataTransform.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseBuilder.jsx`
- `src/containers/Integrations/Integration/SlackIntegration.jsx`
- `src/containers/AddChart/components/TableDataFormattingModal.jsx`
- `src/containers/ProjectDashboard/components/AddFilters.jsx`
- `src/containers/Dataset/DatarequestSettings.jsx`
- `src/containers/ProjectSettings.jsx`
- `src/containers/ProjectDashboard/components/UpdateSchedule.jsx`
- `src/containers/ProjectDashboard/components/SnapshotSchedule.jsx`

Notes:
- Corrected the earlier select rewrites to preserve the explicit v3 picker contract:
  - every migrated `Select` now keeps `selectionMode`
  - `onChange` now treats single-select values as `Key` and multi-select values as `Key[]`
- Continued into the next mixed picker files and replaced both `SelectItem` and `AutocompleteItem` usage with direct v3 compound structure where touched.
- Replaced the timezone autocomplete surfaces in the dashboard settings and schedule screens with:
  - `Label`
  - `Autocomplete.Trigger`
  - `Autocomplete.Value`
  - `Autocomplete.ClearButton`
  - `Autocomplete.Indicator`
  - `Autocomplete.Popover`
  - `Autocomplete.Filter`
  - `SearchField`
  - `ListBox.Item`
  - `ListBox.ItemIndicator`
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 21: Dataset Picker Follow-Up

Files migrated:
- `src/components/DatasetFilters.jsx`
- `src/containers/Dataset/Dataset.jsx`

Notes:
- Continued the mixed picker migration in dataset-focused screens.
- Replaced the remaining `AutocompleteItem` usage in these files with direct v3 autocomplete composition:
  - `Label`
  - `Autocomplete.Trigger`
  - `Autocomplete.Value`
  - `Autocomplete.ClearButton`
  - `Autocomplete.Indicator`
  - `Autocomplete.Popover`
  - `Autocomplete.Filter`
  - `SearchField`
  - `ListBox.Item`
  - `ListBox.ItemIndicator`
- Replaced the remaining `SelectItem` usage in `DatasetFilters.jsx` with direct v3 `Select` + `ListBox.Item` composition.
- Kept the corrected picker contract from Batch 20:
  - explicit `selectionMode` on migrated pickers
  - `onChange` uses `Key` for single selection and `Key[]` for multiple selection
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 22: Builder / Query Picker Follow-Up

Files migrated:
- `src/containers/Dataset/DatasetBuilder.jsx`
- `src/containers/Connections/Customerio/ActivitiesQuery.jsx`

Notes:
- Continued the direct picker migration in the dataset builder and Customer.io query UI.
- Replaced the remaining `AutocompleteItem` usage in these files with direct v3 autocomplete composition.
- Replaced the remaining `SelectItem` usage in these files with direct v3 `Select` + `ListBox.Item` composition.
- Preserved the corrected picker contract from Batch 20:
  - explicit `selectionMode`
  - `onChange` uses `Key` for single selection and `Key[]` for multiple selection
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 23: Customer.io Picker Follow-Up

Files migrated:
- `src/containers/Connections/Customerio/CustomerQuery.jsx`
- `src/containers/Connections/Customerio/CampaignsQuery.jsx`

Notes:
- Continued the direct picker migration in the remaining Customer.io query screens touched this turn.
- Replaced the remaining `SelectItem` usage in these files with direct v3 `Select` + `ListBox.Item` composition.
- Preserved the corrected picker contract from Batch 20:
  - explicit `selectionMode`
  - `onChange` uses `Key` for single selection and `Key[]` for multiple selection
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 24: Connection Picker Follow-Up

Files migrated:
- `src/containers/Connections/Customerio/CustomerioConnectionForm.jsx`
- `src/containers/Connections/RealtimeDb/RealtimeDbBuilder.jsx`
- `src/containers/Connections/Firestore/FirestoreBuilder.jsx`

Notes:
- Continued the direct picker migration in connection forms and connection-side builders.
- Replaced the remaining `SelectItem` usage in these files with direct v3 `Select` + `ListBox.Item` composition.
- Preserved the corrected picker contract from Batch 20:
  - explicit `selectionMode`
  - `onChange` uses `Key` for single selection and `Key[]` for multiple selection
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 25: Analytics / API Picker Follow-Up

Files migrated:
- `src/containers/Connections/GoogleAnalytics/GaBuilder.jsx`
- `src/containers/Connections/GoogleAnalytics/GaTemplate.jsx`
- `src/containers/Connections/SimpleAnalytics/SimpleAnalyticsTemplate.jsx`
- `src/containers/AddChart/components/ChartSettings.jsx`
- `src/containers/AddChart/components/ApiBuilder.jsx`
- `src/containers/AddChart/components/ApiPagination.jsx`

Notes:
- Continued the direct picker migration in Google Analytics flows, Simple Analytics template setup, and API/chart builder screens.
- Replaced the remaining `SelectItem` usage in these files with direct v3 `Select` + `ListBox.Item` composition.
- Replaced the remaining `AutocompleteItem` usage in `GaBuilder.jsx` with direct v3 autocomplete composition.
- Preserved the corrected picker contract from Batch 20:
  - explicit `selectionMode`
  - `onChange` uses `Key` for single selection and `Key[]` for multiple selection
- Kept the edits local to the picker surfaces and their immediate imports/state wiring without broader formatting or structural rewrites.
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 26: Analytics Template Picker Follow-Up

Files migrated:
- `src/containers/Connections/Plausible/PlausibleTemplate.jsx`
- `src/containers/Connections/Mailgun/MailgunTemplate.jsx`
- `src/containers/Connections/ChartMogul/ChartMogulTemplate.jsx`

Notes:
- Continued the direct picker migration in the remaining analytics/community template setup screens.
- Replaced the remaining `SelectItem` usage in these files with direct v3 `Select` + `ListBox.Item` composition.
- Preserved the corrected picker contract from Batch 20:
  - explicit `selectionMode`
  - `onChange` uses `Key` for single selection and `Key[]` for multiple selection
- Removed now-unused display helpers that only existed to feed old v2 select value props.
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 27: Dashboard Filter Editor Picker Follow-Up

Files migrated:
- `src/containers/ProjectDashboard/components/VariableFilter.jsx`
- `src/containers/ProjectDashboard/components/EditFieldFilter.jsx`
- `src/containers/ProjectDashboard/components/EditVariableFilter.jsx`

Notes:
- Continued the direct picker migration in the dashboard filter editor screens.
- Replaced the remaining `SelectItem` usage in these files with direct v3 `Select` + `ListBox.Item` composition.
- Replaced the remaining `AutocompleteItem` usage in `EditFieldFilter.jsx` with direct v3 autocomplete composition.
- Preserved the corrected picker contract from Batch 20:
  - explicit `selectionMode`
  - `onChange` uses `Key` for single selection and `Key[]` for multiple selection
- Left `src/containers/Chart/components/ChartFilters.jsx` for a focused follow-up because it still mixes option selection with typed custom values and should be migrated carefully rather than mechanically.
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 28: Connection Form Picker Follow-Up

Files migrated:
- `src/containers/Connections/components/ApiConnectionForm.jsx`
- `src/containers/Connections/components/MysqlConnectionForm.jsx`
- `src/containers/Connections/components/PostgresConnectionForm.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseConnectionForm.jsx`

Notes:
- Continued the direct picker migration in the remaining connection form screens.
- Replaced the remaining `SelectItem` usage in these files with direct v3 `Select` + `ListBox.Item` composition.
- Preserved the corrected picker contract from Batch 20:
  - explicit `selectionMode`
  - `onChange` uses `Key` for single selection and `Key[]` for multiple selection
- Kept the edits local to authentication and SSL mode selects only.
- Verification:
  - `npm run lint` passes
  - `rg -n 'SelectItem|AutocompleteItem'` on the migrated files returns no matches

### Batch 29: Final Picker Family Completion

Files migrated:
- `src/containers/Integrations/Auth/SlackAuth.jsx`
- `src/containers/AddChart/components/MongoQueryBuilder.jsx`
- `src/containers/AddChart/components/SqlBuilder.jsx`
- `src/containers/AddChart/components/DatasetAlerts.jsx`
- `src/containers/Chart/Chart.jsx`
- `src/containers/AddChart/components/ChartDatasetDataSetup.jsx`
- `src/containers/Connections/CustomTemplates/CustomTemplateForm.jsx`
- `src/containers/UserDashboard/DatasetList.jsx`
- `src/containers/AddChart/components/DatasetData.jsx`
- `src/containers/Chart/components/ChartFilters.jsx`
- `src/containers/AddChart/components/VisualSQL.jsx`

Notes:
- Finished the direct picker migration across the remaining client files.
- Replaced the last `SelectItem` and `AutocompleteItem` usage with direct v3 compound structure:
  - `Label`
  - `Select.Trigger`
  - `Select.Value`
  - `Select.Indicator`
  - `Select.Popover`
  - `Autocomplete.Trigger`
  - `Autocomplete.Value`
  - `Autocomplete.Indicator`
  - `Autocomplete.ClearButton`
  - `Autocomplete.Popover`
  - `Autocomplete.Filter`
  - `SearchField`
  - `ListBox.Item`
  - `ListBox.ItemIndicator`
- Preserved the corrected picker contract from Batch 20:
  - explicit `selectionMode`
  - `onChange` uses `Key` for single selection and `Key[]` for multiple selection
- `ChartFilters.jsx` was migrated with a direct v3 autocomplete compound structure while keeping the existing typed-value flow local to the component.
- Verification:
  - `npm run lint` passes
  - `rg -l 'SelectItem|AutocompleteItem' client/src` returns no matches

### Phase 1: Spacer Removal Foundation

Files migrated:
- `src/containers/Integrations/Auth/SlackAuth.jsx`
- `src/containers/Connections/GoogleAnalytics/GaTemplate.jsx`
- `src/containers/Connections/SimpleAnalytics/SimpleAnalyticsTemplate.jsx`
- `src/containers/Connections/Plausible/PlausibleTemplate.jsx`
- `src/containers/Connections/Mailgun/MailgunTemplate.jsx`
- `src/containers/Connections/ChartMogul/ChartMogulTemplate.jsx`
- `src/components/FeedbackForm.jsx`
- `src/components/InviteMembersForm.jsx`
- `src/containers/PasswordReset.jsx`
- `src/containers/Login.jsx`
- `src/components/SavedQueries.jsx`
- `src/containers/ProjectRedirect.jsx`
- `src/containers/PrintView/PrintView.jsx`
- `src/components/DatasetFilters.jsx`
- `src/components/FormulaTips.jsx`
- `src/components/ProjectForm.jsx`
- `src/components/Callout.jsx`
- `src/components/HelpBanner.jsx`
- `src/components/TableConfiguration.jsx`
- `src/containers/ProjectBoard/components/ProjectNavigation.jsx`
- `src/containers/UserDashboard/DashboardList.jsx`
- `src/components/LoginForm.jsx`
- `src/containers/SharedChart.jsx`
- `src/containers/UserInvite.jsx`
- `src/containers/ApiKeys/ApiKeys.jsx`
- `src/containers/Variables/Variables.jsx`

Notes:
- Consolidated the early `Spacer` removal work into a single phase to keep this tracker shorter.
- This phase focused on low-risk templates, shared components, utility screens, auth screens, and admin/public views.
- Replaced `Spacer` usage in these files with local `gap-*`, `h-*`, and `w-*` utilities only.
- Kept the edits surgical and avoided broader refactors in files that still contain other old HeroUI surfaces.
- Verification:
  - `npm run lint` passes
  - `rg -n '\\bSpacer\\b'` on the migrated files returns no matches

### Phase 2: Spacer Removal Medium Screen Sweep

Files migrated:
- `src/containers/Signup.jsx`
- `src/containers/ProjectBoard/ProjectBoard.jsx`
- `src/containers/PublicDashboard/components/SharingSettings.jsx`
- `src/containers/PublicDashboard/Report.jsx`
- `src/containers/Dataset/Dataset.jsx`
- `src/containers/Dataset/AiQuery.jsx`
- `src/containers/Dataset/DatarequestSettings.jsx`
- `src/containers/AddChart/AddChart.jsx`
- `src/containers/ProjectDashboard/ProjectDashboard.jsx`
- `src/containers/UserDashboard/UserDashboard.jsx`
- `src/containers/UserDashboard/ConnectionList.jsx`
- `src/containers/UserDashboard/DatasetList.jsx`
- `src/containers/Ai/AiModal.jsx`
- `src/containers/Integrations/Integrations.jsx`
- `src/containers/Integrations/components/SlackIntegrationsList.jsx`
- `src/containers/Integrations/components/WebhookIntegrationsList.jsx`
- `src/containers/Integrations/Integration/SlackIntegration.jsx`
- `src/containers/Integrations/Auth/Auth.jsx`
- `src/containers/Integrations/Auth/SlackCallback.jsx`
- `src/containers/Connections/Customerio/ActivitiesQuery.jsx`
- `src/containers/Connections/Customerio/CustomerQuery.jsx`
- `src/containers/Connections/Customerio/CampaignsQuery.jsx`
- `src/containers/Connections/Customerio/CustomerioBuilder.jsx`
- `src/containers/Connections/Customerio/CustomerioConnectionForm.jsx`
- `src/containers/Chart/Chart.jsx`
- `src/containers/Chart/TextWidget.jsx`
- `src/containers/AddChart/components/ChartDatasetDataSetup.jsx`
- `src/containers/ProjectDashboard/components/DashboardFilters.jsx`
- `src/containers/EmbeddedChart.jsx`
- `src/containers/Chart/components/ChartFilters.jsx`
- `src/containers/ProjectDashboard/components/ChartExport.jsx`
- `src/containers/AddChart/components/DatasetAppearance.jsx`
- `src/containers/AddChart/components/ChartPreview.jsx`
- `src/containers/PublicDashboard/PublicDashboard.jsx`
- `src/containers/ProjectSettings.jsx`
- `src/containers/Chart/components/ChartSharing.jsx`
- `src/containers/Settings/TeamSettings.jsx`
- `src/containers/Settings/ManageUser.jsx`
- `src/containers/Settings/TeamMembers.jsx`
- `src/containers/ProjectDashboard/components/SnapshotSchedule.jsx`

Notes:
- Continued the `Spacer` removal into medium-complexity dataset, public dashboard, and shell screens.
- Expanded this phase into dashboard, add-chart, AI, public report, user dashboard, integrations, Customer.io, and chart screens to reduce the remaining `Spacer` surface faster.
- Extended the same phase into add-chart setup, chart filter/export, embedded chart, and public dashboard surfaces instead of splitting the tracker into more micro-batches.
- Continued folding in settings and sharing files under the same spacer phase so the tracker stays compact while the remaining count drops.
- Replaced `Spacer` usage in these files with local `h-*` and `w-*` spacing utilities only.
- Kept the changes local to spacing and avoided touching unrelated v2 surfaces in the same files.
- Verification:
  - `npm run lint` passes
  - `rg -n '\\bSpacer\\b'` on the migrated files returns no matches

### Phase 3: Code Component Removal

Files migrated:
- `src/components/FormulaTips.jsx`
- `src/components/DatasetFilters.jsx`
- `src/containers/Ai/AiModal.jsx`
- `src/containers/Settings/TeamMembers.jsx`
- `src/containers/Variables/Variables.jsx`
- `src/containers/AddChart/components/ChartSettings.jsx`
- `src/containers/AddChart/components/VisualSQL.jsx`
- `src/containers/AddChart/components/ApiBuilder.jsx`
- `src/containers/AddChart/components/SqlBuilder.jsx`
- `src/containers/AddChart/components/MongoQueryBuilder.jsx`
- `src/containers/ProjectDashboard/components/EditDateRangeFilter.jsx`
- `src/containers/Integrations/components/SlackIntegrationsList.jsx`
- `src/containers/Integrations/Auth/SlackCallback.jsx`
- `src/containers/Connections/GoogleAnalytics/GaBuilder.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseBuilder.jsx`
- `src/containers/Connections/Firestore/FirestoreBuilder.jsx`
- `src/containers/Connections/RealtimeDb/RealtimeDbBuilder.jsx`

Notes:
- Replaced HeroUI `Code` with plain HTML `<code>` tags only.
- Applied the agreed Tailwind mapping directly:
  - default: `bg-default/40 text-default-700`
  - primary: `bg-accent/20 text-accent-600`
  - `size="sm"` -> `text-sm`
  - `radius="sm"` -> `rounded-sm`
- Kept the changes local to the old `Code` call sites and preserved surrounding structure.
- Verification:
  - `npm run lint` passes
  - `rg -n 'import .*\\bCode\\b|<Code\\b' chartbrew-os/client/src` returns only a commented-out example in `src/containers/Chart/TextWidget.jsx`

### Batch 30: Card v3 Compound Structure

Files migrated:
- `src/components/DatasetFilters.jsx`
- `src/components/HelpBanner.jsx`
- `src/components/ProjectForm.jsx`
- `src/containers/Login.jsx`
- `src/containers/AddChart/components/ChartDatasets.jsx`
- `src/containers/AddChart/components/DatarequestModal.jsx`
- `src/containers/Chart/Chart.jsx`
- `src/containers/Chart/TextWidget.jsx`
- `src/containers/Connections/ConnectionWizard.jsx`
- `src/containers/Connections/CustomTemplates/CustomTemplates.jsx`
- `src/containers/Dataset/DatasetQuery.jsx`
- `src/containers/UserDashboard/ConnectionList.jsx`
- `src/containers/UserDashboard/DashboardList.jsx`
- `src/containers/UserDashboard/components/NoticeBoard.jsx`
- `src/containers/UserDashboard/components/WhatsNewPanel.jsx`

Notes:
- Replaced v2 flat card section components with HeroUI v3 compound parts on `Card`:
  - `CardHeader` -> `Card.Header`
  - `CardBody` -> `Card.Content`
  - `CardFooter` -> `Card.Footer`
- Dropped named imports of `CardBody`, `CardHeader`, and `CardFooter`; only `Card` is imported from `@heroui/react` for these trees.
- Left root `Card` props (for example `shadow`, `radius`, `isPressable`) unchanged in this batch; follow-up passes can align those with v3-only APIs if needed.
- Verification:
  - `npm run lint` passes
  - `rg -l 'CardBody|CardHeader|CardFooter' client/src` returns no matches

### Batch 31: Listbox → ListBox compound

Files migrated:
- `src/containers/Ai/AiModal.jsx`
- `src/containers/Chart/components/ChartSharing.jsx`
- `src/containers/ProjectBoard/components/ProjectNavigation.jsx`
- `src/containers/ProjectDashboard/ProjectDashboard.jsx`

Notes:
- Replaced v2 `Listbox` / `ListboxItem` with HeroUI v3 `ListBox` / `ListBox.Item` (react-aria-backed collection API).
- **ChartSharing**: `selectedKeys` is now a `Set` of string ids; `onSelectionChange` guards `"all"` and reads keys from the set. Removed v2-only `variant="faded"` and `hideSelectedIcon` (ListBox variants are `default` / `danger` only; selection affordance is row styling + `selectedKeys`). Delete control is wrapped with pointer/mouse `stopPropagation` so it does not steal list selection.
- **ProjectDashboard** (members popover): `selectionMode="none"` with composed row layout; former `description` / `endContent` slots are plain flex children.
- **ProjectNavigation**: project switcher and sidebar nav use `onAction` instead of `onPress` on items; removed v2 `classNames` / `color` / `variant` on the list root (layout handled with `className` + inner flex).
- **AiModal** (context pickers): `emptyContent` → `renderEmptyState`; toggle logic moved from `onPress` to `onAction` on each `ListBox.Item`.
- Verification:
  - `npm run lint` passes
  - `rg -l 'Listbox|ListboxItem' client/src` returns no matches

### Batch 32: Native `Image` + `CircularProgress` → `ProgressCircle`

Files migrated:
- `src/components/ProjectForm.jsx`
- `src/containers/Chart/Chart.jsx`
- `src/containers/Chart/components/TableView/TableComponent.jsx`
- `src/containers/AddChart/components/SqlBuilder.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseBuilder.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseConnectionForm.jsx`
- `src/containers/Connections/Customerio/CustomerQuery.jsx`
- `src/containers/Connections/RealtimeDb/RealtimeDbConnectionForm.jsx`
- `src/containers/Connections/components/MysqlConnectionForm.jsx`
- `src/containers/Dataset/DatasetQuery.jsx`
- `src/containers/ProjectDashboard/components/SnapshotSchedule.jsx`
- `src/containers/ProjectSettings.jsx`
- `src/containers/PublicDashboard/PublicDashboard.jsx`
- `src/containers/PublicDashboard/Report.jsx`
- `src/containers/UserDashboard/DatasetList.jsx`
- `src/containers/UserDashboard/components/NoticeBoard.jsx`
- `src/containers/Connections/ConnectionWizard.jsx`

Notes:
- Removed `@heroui/react` **`Image`** imports and replaced usages with native **`<img>`** + Tailwind (`object-cover`, `rounded-*`, dimensions, `max-w-full`, etc.). Instruction screenshots on public dashboard/report: `css` prop → **`className` + `style`** for drop-shadow and padding; added missing **`alt`** where helpful.
- Replaced all **`CircularProgress`** imports/usages with **`ProgressCircle`**. **`Chart.jsx`**: former `classNames={{ svg: "w-4 h-4" }}` → `className="w-4 h-4"` (and `w-5 h-5` for the menu spinner) on `ProgressCircle`.
- Verification:
  - `npm run lint` passes
  - `rg 'Image' client/src` should show no `Image` in `@heroui/react` import lists (only unrelated matches like `LuImage` or UI copy such as "Image size" in `TableDataFormattingModal.jsx`)
  - `rg 'CircularProgress' client/src` returns no matches

### Batch 33: Popover v3 compound (`Popover.Trigger` / `Popover.Content` / `Popover.Dialog`)

Files migrated:
- `src/containers/Chart/Chart.jsx`
- `src/containers/Chart/components/TableView/TableComponent.jsx`
- `src/containers/PublicDashboard/PublicDashboard.jsx`
- `src/containers/PublicDashboard/Report.jsx`
- `src/containers/EmbeddedChart.jsx`
- `src/containers/SharedChart.jsx`
- `src/containers/Ai/AiModal.jsx`
- `src/containers/ProjectBoard/components/ProjectNavigation.jsx`
- `src/containers/ProjectDashboard/ProjectDashboard.jsx`
- `src/containers/Dataset/DatasetBuilder.jsx`
- `src/containers/Connections/Firestore/FirestoreBuilder.jsx`
- `src/containers/Connections/GoogleAnalytics/GaBuilder.jsx`
- `src/containers/Connections/Customerio/CampaignsQuery.jsx`
- `src/containers/AddChart/components/ChartPreview.jsx`
- `src/containers/AddChart/components/ApiBuilder.jsx`
- `src/containers/AddChart/components/MongoQueryBuilder.jsx`
- `src/containers/AddChart/components/VisualSQL.jsx`
- `src/containers/AddChart/components/TableDataFormattingModal.jsx`
- `src/containers/AddChart/components/QueryResultsTable.jsx`
- `src/containers/AddChart/components/ChartDatasetConfig.jsx`

Notes:
- Replaced flat **`PopoverTrigger`** / **`PopoverContent`** imports and JSX with **`Popover.Trigger`**, **`Popover.Content`**, and **`Popover.Dialog`** (react-aria `Dialog` inside the positioned overlay). Dropped standalone `PopoverTrigger` / `PopoverContent` imports everywhere.
- **`placement`** (and width/max-width **`className`** that lived on the v2 root) moved to **`Popover.Content`** where applicable. **`isOpen`** / **`onOpenChange`** stay on the root **`Popover`** (`DialogTrigger`).
- **`TableComponent.jsx`**: long-text and image popovers no longer wrap **`Button`** inside **`Popover.Trigger`** (avoids nested interactive controls); triggers use **`Popover.Trigger`** + Tailwind for icon / thumbnail affordance.
- Verification:
  - `npm run lint` passes
  - `rg 'PopoverTrigger|PopoverContent' client/src` returns no matches

### Batch 34: Drawer v3 compound (`Drawer.Backdrop` / `Drawer.Content` / `Drawer.Dialog` / `Drawer.Header` / `Drawer.Body` / `Drawer.Footer`)

Files migrated:
- `src/components/DatasetFilters.jsx`
- `src/containers/AddChart/components/SqlBuilder.jsx`
- `src/containers/AddChart/components/ApiBuilder.jsx`
- `src/containers/AddChart/components/MongoQueryBuilder.jsx`
- `src/containers/Connections/Firestore/FirestoreBuilder.jsx`
- `src/containers/Connections/ClickHouse/ClickHouseBuilder.jsx`
- `src/containers/Connections/RealtimeDb/RealtimeDbBuilder.jsx`
- `src/containers/ProjectDashboard/components/AddFilters.jsx`
- `src/containers/PublicDashboard/components/SharingSettings.jsx`

Notes:
- Replaced flat **`DrawerContent`** / **`DrawerHeader`** / **`DrawerBody`** / **`DrawerFooter`** with **`Drawer.Backdrop`**, **`Drawer.Content`**, **`Drawer.Dialog`**, **`Drawer.Header`**, **`Drawer.Body`**, **`Drawer.Footer`**. Only **`Drawer`** is imported from `@heroui/react` for these trees (no standalone section imports).
- Controlled drawers: **`onClose`** → **`onOpenChange`** on the root **`Drawer`** (`if (!open) …`). Former **`placement`**, **`classNames.base`**, and panel **`style`** (e.g. `marginTop`) live on **`Drawer.Content`**; **`backdrop="transparent"`** / **`backdrop="blur"`** → **`Drawer.Backdrop`** with **`variant="transparent"`** / **`variant="blur"`**.
- **`AddFilters.jsx`**: dropped v2-only **`closeButton`** and **`size="2xl"`**; width approximated with **`max-w-2xl`** on **`Drawer.Content`**; removed invalid **`auto`** on the Close **`Button`**.
- **`SharingSettings.jsx`**: **`placement="right"`** + **`max-w-3xl`** on content (v2 had no explicit placement); when **`onReport`**, **`Drawer.CloseTrigger`** replaces the old **`hideCloseButton`** behavior for a dismiss control next to the title.
- Verification:
  - `npm run lint` passes
  - `rg 'DrawerContent|DrawerHeader|DrawerBody|DrawerFooter' client/src` returns no matches

## Remaining Hard Blockers

Direct import-surface audit after revalidation still shows these invalid or stale v2 surfaces:
- `ModalContent`: 0 files
- `SelectItem` / `AutocompleteItem`: 0 files
- `Spacer`: 0 files
- `Code`: 0 active files
- `CardBody` / `CardHeader` / `CardFooter`: 0 files (migrated to `Card.Content` / `Card.Header` / `Card.Footer`)
- `Listbox` / `ListboxItem`: 0 files (migrated to `ListBox` / `ListBox.Item`)
- `Image` (HeroUI): 0 files in `client/src` (replaced with `<img>` in Batch 32)
- `CircularProgress`: 0 files (replaced with `ProgressCircle` in Batch 32)
- `PopoverTrigger` / `PopoverContent`: 0 files (migrated to `Popover.*` compounds in Batch 33)
- `DrawerBody` / `DrawerContent` / `DrawerHeader` / `DrawerFooter`: 0 files (migrated to `Drawer.*` compounds in Batch 34)
- `Progress` (linear) / legacy loader components: audit remaining call sites

## Verification

- `npm run lint` currently passes

Important:
- Lint in this repo does not validate package export correctness.
- Import-surface audits are required until the remaining invalid v2-only imports are removed.

## Next Batch

Priority order:
1. Audit **linear `Progress`** in `TableComponent.jsx` (and any other call sites) against the v3 progress API or plain progress markup if the export changed.
2. Align root **`Card`** props with v3-only APIs where v2-only props remain (`shadow`, `radius`, `isPressable`, `onClick` vs `onPress`, etc.).
3. Run `npm run build` in `client/` when the import-surface audit is clean enough to catch missing exports (lint alone does not validate package surface).

## Notes

- The earlier compatibility-layer approach was discarded.
- The client is now being migrated against the real `@heroui/react` package surface.
- I am avoiding `vite build` during migration and using lint plus direct import-surface audits first, per the migration guidance.
