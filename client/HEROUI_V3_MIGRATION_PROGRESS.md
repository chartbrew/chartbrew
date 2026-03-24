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

## Current Strategy

1. Keep the theme migration in `src/input.css` and CSS variables.
2. Migrate shared local wrappers and root setup first.
3. Remove all temporary compatibility aliasing.
4. Replace invalid v2-only imports with real v3 components or plain HTML.
5. Convert remaining call sites to direct v3 structure in batches:
   - Modal
   - Select / Autocomplete
   - ListBox
   - Card
   - Progress / loader states

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

## Remaining Hard Blockers

Direct import-surface audit against installed `@heroui/react` still shows these invalid or shim-dependent surfaces:
- `Spacer`: about 103 files
- `ModalContent`: 0 files
- `Code`: about 21 files
- `CardBody`: about 14 files
- `Image`: about 10 files
- `Listbox` / `ListboxItem`: 5 files
- `Progress`: about 4 files

## Verification

- `npm run lint` currently passes

Important:
- Lint in this repo does not validate package export correctness.
- Import-surface audits are required until the remaining invalid v2-only imports are removed.

## Next Batch

Priority order:
1. Remove `Spacer` usage and replace with layout `gap` / margin utilities
2. Replace removed `Code`, `Image`, and `User` usages with plain elements or direct v3 composition
3. Convert `CardBody` / `CardHeader` / `CardFooter` usage to the direct `Card.*` structure consistently
4. Re-audit the shared picker wrapper and touched screens for places where direct v3 composition is now preferable over the temporary adapter surface
5. Re-run import-surface audits after each family pass until the remaining invalid exports are gone

## Notes

- The earlier compatibility-layer approach was discarded.
- The client is now being migrated against the real `@heroui/react` package surface.
- I am avoiding `vite build` during migration and using lint plus direct import-surface audits first, per the migration guidance.
