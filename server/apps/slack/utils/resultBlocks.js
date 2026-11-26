function plain(text, limit = 3000) {
  return { type: "plain_text", text: String(text || " ").slice(0, limit) };
}

function section(text) {
  return { type: "section", text: plain(text) };
}

function button(label, action, value) {
  return { type: "button", text: plain(label, 75), action_id: action, value };
}

function dataTable(chart) {
  const blocks = [];
  for (const [name, source] of Object.entries(chart.render?.tabularData || {})) {
    if (!source.length) return [section("No saved rows are available. Open in Chartbrew to check this chart.")];
    const columns = Object.keys(source[0]).slice(0, 20);
    const rows = [columns.map((text) => ({ type: "raw_text", text: text || "—" }))];
    let partial = Object.keys(chart.render.tabularData).length > 1;
    let characters = columns.join("").length;
    for (const row of source.slice(0, 200)) {
      const cells = columns.map((column) => typeof row[column] === "number" && Number.isFinite(row[column])
        ? { type: "raw_number", value: row[column], text: String(row[column]) }
        : { type: "raw_text", text: String(row[column] ?? "—").slice(0, 300) || "—" });
      if (columns.some((column) => String(row[column] ?? "").length > 300)) partial = true;
      characters += cells.reduce((sum, cell) => sum + cell.text.length, 0);
      if (characters > 18000) break;
      rows.push(cells);
    }
    if (rows.length < 2) return [section("Open in Chartbrew to view this data.")];
    blocks.push({ type: "data_table", caption: String(name).slice(0, 100), page_size: 10, rows });
    if (partial || rows.length - 1 < source.length || columns.length < Object.keys(source[0]).length) {
      blocks.push(section("Some data is not shown. Open in Chartbrew to see the full result."));
    }
    // Keep one bounded table; the Chartbrew link provides the complete result.
    break;
  }
  return blocks.length ? blocks : [section("No saved rows are available. Open in Chartbrew to check this chart.")];
}

function answerBlocks(result, reference) {
  const message = String(result.message || "The request is complete.");
  let replies = [];
  try {
    const match = message.match(/```cb-actions\s*\n([\s\S]*?)\n```/);
    const suggestions = match ? JSON.parse(match[1]).suggestions : [];
    replies = (suggestions || []).filter((item) => item.action === "reply" && typeof item.label === "string").slice(0, 4);
  } catch (_) { /* Invalid suggestions must not prevent the answer. */ }
  const clean = message.replace(/```cb-[\s\S]*?```/g, "").trim();
  const blocks = [];
  const formatted = clean.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let remaining = formatted;
  while (remaining.length) {
    let end = Math.min(remaining.length, 12000);
    if (end < remaining.length) {
      const paragraph = remaining.lastIndexOf("\n\n", end - 2);
      if (paragraph > 0) end = paragraph + 2;
      const entity = remaining.lastIndexOf("&", end - 1);
      if (entity >= 0 && remaining.indexOf(";", entity) >= end) end = entity;
    }
    blocks.push({ type: "markdown", text: remaining.slice(0, end) });
    remaining = remaining.slice(end);
  }
  if (!blocks.length) blocks.push(section("The request is complete."));
  if (result.pendingAction) {
    const preview = result.pendingAction.preview || {};
    const fields = result.pendingAction.actionType?.startsWith("metric_monitor.")
      ? [["Name", preview.name], ["Source", [preview.source?.dashboard, preview.source?.chart].filter(Boolean).join(" · ")],
        ["Chart value", preview.calculation], ["Calculation", preview.calculationBehaviorLabel],
        ["Comparison", preview.comparisonLabel], ["Better result", preview.healthyDirectionLabel],
        ["Show changes", preview.thresholdLabel], ["First result", preview.firstResultState], ["Why this setup", preview.defaultReason]]
      : [["Recipient", preview.recipient], ["Scope", preview.scopeLabel], ["Content", preview.contentModeLabel],
        ["Schedule", preview.scheduleLabel], ["Timezone", preview.timezone], ["First delivery", preview.nextDeliveryAt],
        ["Metrics", `${preview.eligibleMetricCount || 0} ready, ${preview.waitingMetricCount || 0} waiting`],
        ["Health issues", preview.activeHealthCount || 0]];
    fields.filter(([, value]) => value !== undefined && value !== null && value !== "")
      .forEach(([label, value]) => blocks.push(section(`${label}: ${value}`)));
    (result.pendingAction.warnings || []).slice(0, 5).forEach((warning) => blocks.push(section(warning)));
    blocks.push({ type: "actions", elements: [
      button("Confirm", "slack_confirm", reference), button("Change", "slack_change", reference),
    ] });
  }
  if (replies.length) blocks.push({ type: "actions", elements: replies.map((reply, index) => button(reply.label, `slack_reply_${index}`, reference)) });
  return { text: clean.slice(0, 39000) || "Chartbrew result", blocks, replies: replies.map((reply) => reply.label) };
}

module.exports = { answerBlocks, button, dataTable, plain, section };
