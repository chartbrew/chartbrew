## Changelog

### ✨ New features

* **New Chart Studio**
  Create and edit charts in a redesigned workspace with a live preview, data view, chart settings, and AI chat. Conversations stay linked to their charts so you can continue work later.

* **Create charts directly from dashboards**
  Start from an existing dataset or describe a chart with AI. Preview and refine the result before adding it to your dashboard.

* **New ECharts rendering engine**
  Graphical charts now use Apache ECharts, with improved layouts, labels, tooltips, and support for different screen sizes.

* **Geographic maps and scatter charts**
  Show data by geographic region or coordinates. Use scatter charts to compare numeric values, with separate series and colors for each dataset.

* **Watched metrics and KPI reviews**
  Watch chart metrics, review changes, and compare completed reporting periods. Added quarterly and yearly comparisons, metric recommendations, and scheduled email summaries.

* **Redesigned Home and Activity pages**
  Start from a question, continue recent work, and review metric changes or data problems. Activity now has dedicated views for changes, watched metrics, KPI reviews, alerts, and data health.

* **Chart version history**
  Review changes, preview earlier chart versions, and restore previous settings. Chartbrew keeps the latest 100 versions per chart, including changes made with AI. Restoring a version preserves later history and does not change shared datasets.

* **Report themes and reusable presets**
  Choose from six built-in themes or save custom presets for your team. Set light and dark colors, preview the result, and apply the same appearance to other reports.

* **Chart image sharing**
  Copy or download chart images with controls for size, theme, background, and visible details. Image export works for private charts without enabling public links. Added an authenticated PNG rendering endpoint for API clients and automation.

* **MCP connections and Chartbrew MCP server**
  Connect external MCP services as data sources, with OAuth support and guided setup. Connect compatible AI tools to Chartbrew to search accessible resources, read data, explore sources, and create chart previews with the required permissions.

* **Versioned Data API**
  Retrieve dataset results and chart data through authenticated API endpoints. Added scoped API keys, project access controls, filters, variables, and cache information.

* **Personal AI memory**
  Save instructions with `/remember` and manage them in settings. Added controls for team AI availability and business context.

* **Usage analytics**
  Review source requests and AI usage in team analytics. Instance administrators can also review platform usage.

### 🚀 Feature improvements

* AI chat keeps selected charts, dashboards, datasets, and connections as context across messages.
* Added clearer AI work summaries, chart actions, live previews, and guidance for missing connections.
* Conversations continue through connection setup, with suggestions based on available data and access.
* Simplified team onboarding, connection setup, and empty dashboard guidance.
* Redesigned navigation with pinned dashboards and custom shortcut icons and colors.
* Improved dashboard placement so new charts preserve existing chart positions and sizes.
* Added predictable Tidy and Auto-arrange actions, layout previews, and undo for layout changes.
* Redesigned the report editor with appearance controls and previews for different screen sizes.
* Improved horizontal bar charts, line charts, KPI spacing, map navigation, and chart entrance animations.
* Added search and filters for watched metrics, clearer period comparisons, and controls to dismiss data health issues.
* Updated dataset query builders and added focused AI help for MCP datasets.
* Improved chart creation recovery, editor controls, and handling of failed saves.

### ⚡ Performance improvements

* Added stored, renderer-independent chart data snapshots so charts can load saved results before a source refresh completes.
* Reused prepared chart data across rendering, filtering, API access, and image generation.
* Added server-side chart image rendering without starting a browser.
* Metric monitoring reuses successful chart refresh results without extra source requests for observation capture.
* Reduced database test time and ran verification jobs in parallel.

### ⬆️ Other changes

* Replaced the Chart.js runtime with ECharts and removed the legacy `chartData` response field. Integrations that read this field must use the new chart data contract or Data API.
* Removed the visual SQL builder and updated the query editing interface.
* Added chart snapshot conversion and audit tools for upgrades from v5.
* Fixed dashboard time zone handling during conversion of existing chart data.
* Improved API key project selection, password reset account handling, and session token validation.
* Added source execution records and more detailed AI usage tracking.
* Updated client and server dependencies, including the OpenAI SDK.
* Expanded tests for chart rendering, migration, layouts, history, monitoring, APIs, MCP, and access controls.

### 🔧 Upgrade notes

* Back up the database and configuration before upgrading. Keep the existing encryption keys.
* Run database migrations and complete the cached chart data backfill before reopening the application. Review the backfill report for charts that need attention.
* From `server/`, with the production configuration loaded, run `NODE_ENV=production npm run viz:prepared-backfill` to convert existing cached chart data without source requests.
* If required, run `NODE_ENV=production npm run viz:prepared-backfill -- --refresh-unresolved` afterward. This makes live source requests for charts without prepared snapshots whose last successful refresh was within 30 days. The cached backfill has no age cutoff.
* Live refresh still makes source requests with `--dry-run`. Use the cached backfill without `--refresh-unresolved` for an offline conversion check.
* Chart history restores settings, not historical source data. Image export supports graphical charts, KPI charts, and average charts; table and markdown images are not supported.
