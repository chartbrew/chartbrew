export function humanizeToolName(toolName) {
  if (!toolName) return "Run step";

  return toolName
    .replace(/^source_/, "")
    .replace(/^stripe_official_/, "stripe_")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getToolDisplayName(toolName, displayNames = {}) {
  return displayNames[toolName] || humanizeToolName(toolName);
}

export function getOperationSummary(operations, displayNames = {}) {
  const calledTools = operations
    .filter((operation) => operation.type === "call")
    .map((operation) => operation.name);
  const uniqueTools = Array.from(new Set(calledTools));
  const visibleTools = uniqueTools.slice(0, 3).map((toolName) => getToolDisplayName(toolName, displayNames));
  const hiddenCount = Math.max(uniqueTools.length - visibleTools.length, 0);

  if (visibleTools.length === 0) {
    return `${operations.length} tool ${operations.length === 1 ? "step" : "steps"}`;
  }

  return `${visibleTools.join(", ")}${hiddenCount > 0 ? `, +${hiddenCount} more` : ""}`;
}

export function getProgressEventMessage(event, displayNames = {}) {
  if (event.type !== "execution" && event.type !== "tool_started") {
    return event.message;
  }

  if (event.toolEvents?.length > 0) {
    return event.toolEvents
      .map((toolEvent) => toolEvent.displayName || getToolDisplayName(toolEvent.toolName, displayNames))
      .join(", ");
  }

  if (event.toolDisplayNames?.length > 0) {
    return event.toolDisplayNames.join(", ");
  }

  if (event.tools?.length > 0) {
    return event.tools.map((toolName) => getToolDisplayName(toolName, displayNames)).join(", ");
  }

  const toolMatch = event.message?.match(/:\s*(.+)$/);
  if (toolMatch?.[1]) {
    return toolMatch[1]
      .split(",")
      .map((toolName) => getToolDisplayName(toolName.trim(), displayNames))
      .join(", ");
  }

  return event.message;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

function stripGeneratedTitle(content) {
  if (!content || !content.startsWith("# ")) {
    return content;
  }

  const lines = content.split("\n");
  if (lines.length <= 1) {
    return "";
  }

  return lines.slice(1).join("\n").trim();
}

export function getChartToolMessageInfo(message) {
  if (message.role !== "tool") {
    return null;
  }

  const content = parseJson(message.content);
  if (!content?.chart_id || !["create_chart", "update_chart", "create_temporary_chart"].includes(message.name)) {
    return null;
  }

  const isTemporary = content.visibility === "temporary" ||
    message.name === "create_temporary_chart" ||
    content.is_temporary ||
    content.ghost_project_id;

  return {
    type: isTemporary ? "chart_temporary" : message.name === "create_chart" ? "chart_created" : "chart_updated",
    chartId: content.chart_id,
    chartName: content.name,
    chartType: content.type,
    projectId: content.project_id || content.ghost_project_id,
    dashboardUrl: content.dashboard_url,
    chartUrl: content.chart_url,
    isTemporary,
    visibility: content.visibility || (isTemporary ? "temporary" : "dashboard"),
    content,
  };
}

export function parseAiMessage(message) {
  if (message.tool_calls && message.tool_calls.length > 0) {
    return {
      type: "tool_call",
      tools: message.tool_calls.map((toolCall) => ({
        name: toolCall.function.name,
        args: parseJson(toolCall.function.arguments) || {},
      })),
    };
  }

  if (message.role === "tool") {
    const chartInfo = getChartToolMessageInfo(message);
    if (chartInfo) {
      return chartInfo;
    }

    return {
      type: "tool_result",
      name: message.name,
      content: parseJson(message.content) || message.content,
    };
  }

  if (message.role === "assistant" && message.content) {
    let cbActionsMatch = message.content.match(/```cb-actions\s*\n([\s\S]*?)\n```/);
    let suggestionsData = null;

    if (cbActionsMatch) {
      suggestionsData = parseJson(cbActionsMatch[1]);
    }

    if (!suggestionsData) {
      const directMatch = message.content.match(/cb-actions\s*(\{[\s\S]*?\})/);
      if (directMatch) {
        suggestionsData = parseJson(directMatch[1]);
      }
    }

    if (suggestionsData && suggestionsData.version === 1 && Array.isArray(suggestionsData.suggestions)) {
      const content = stripGeneratedTitle(message.content
        .replace(/```cb-actions\s*\n[\s\S]*?\n```/, "")
        .replace(/cb-actions\s*\{[\s\S]*?\}/, "")
        .trim());

      return {
        type: "message_with_suggestions",
        content,
        suggestions: suggestionsData.suggestions,
      };
    }
  }

  return {
    type: "message",
    content: stripGeneratedTitle(message.content),
  };
}

export function groupAiMessages(messages) {
  const groups = [];
  let currentGroup = null;

  messages.forEach((message) => {
    const parsed = parseAiMessage(message);
    const item = { message, parsed };
    const isChartMessage = parsed.type === "chart_created" || parsed.type === "chart_updated" || parsed.type === "chart_temporary";

    if (message.role === "user" || isChartMessage) {
      groups.push({
        type: isChartMessage ? parsed.type : "user",
        items: [item],
      });
      currentGroup = null;
      return;
    }

    if (message.role === "assistant" || message.role === "tool") {
      if (!currentGroup || currentGroup.type !== "assistant") {
        currentGroup = {
          type: "assistant",
          items: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    }
  });

  return groups;
}
