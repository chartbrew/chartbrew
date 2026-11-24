const TOOL_EMOJIS = {
  list_dashboard_filters: "🎛️",
  set_dashboard_filter: "🎛️",
  delete_dashboard_filter: "🗑️",
  read_chart_results: "📊",
  get_workspace_activity: "📈",
  get_workspace_context: "🗂️",
  list_metric_monitors: "👀",
  recommend_metric_monitors: "💡",
  preview_metric_monitor: "👀",
  list_kpi_reviews: "📋",
  preview_kpi_review: "📋",
  search_datasets: "🔎",
  get_dataset_intelligence: "🔎",
  run_existing_dataset: "📚",
  list_connections: "🔌",
  get_schema: "🗂️",
  source_get_capabilities: "🔌",
  source_list_resources: "🗂️",
  source_get_sample_data: "📚",
  source_list_templates: "📋",
  source_recommend_templates: "💡",
  source_resolve_context: "🔎",
  source_plan_dataset: "📝",
  source_run_action: "⚙️",
  source_search_records: "🔎",
  source_validate_configuration: "✅",
  source_preview_configuration: "📚",
  stripe_official_plan_dataset: "📝",
  stripe_official_validate_configuration: "✅",
  stripe_official_preview_configuration: "📚",
  generate_query: "📝",
  validate_query: "✅",
  run_query: "⚙️",
  summarize: "📝",
  suggest_chart: "💡",
  create_dataset: "📚",
  create_chart: "📊",
  update_dataset: "🔄",
  update_chart: "📊",
  create_temporary_chart: "📊",
  create_dashboard: "🗂️",
  create_dashboard_chart: "📊",
  create_dashboard_from_template: "🗂️",
  move_chart_to_dashboard: "📌",
  disambiguate: "💬",
  request_chart_preview: "📊",
  request_dashboard_snapshot: "📸",
};

function createSlackProgress(client, channel, ts) {
  let lastUpdate = -Infinity;
  let lastText = "";
  let updating = false;

  return async (toolName, status, _details, displayName) => {
    if (!ts || status !== "start" || !displayName || updating) return;
    const label = displayName === toolName
      ? toolName.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
      : displayName;
    const text = `${TOOL_EMOJIS[toolName] || "⚙️"} ${label}…`;
    if (text === lastText || Date.now() - lastUpdate < 2000) return;
    lastUpdate = Date.now();
    updating = true;
    try {
      await client.chat.update({ channel, ts, text, blocks: [{
        type: "context", elements: [{ type: "plain_text", text }],
      }] });
      lastText = text;
    } catch (_) {
      // Progress is optional; a Slack outage must not stop the answer.
    } finally {
      updating = false;
    }
  };
}

module.exports = { createSlackProgress };
