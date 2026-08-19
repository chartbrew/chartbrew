const TOOL_ACTIVITY_LABELS = {
  create_chart: "Created a chart",
  create_dashboard: "Created a dashboard",
  create_dashboard_chart: "Added a chart to a dashboard",
  create_dataset: "Prepared a dataset",
  create_temporary_chart: "Prepared a chart preview",
  generate_query: "Prepared a data request",
  get_dataset_intelligence: "Reviewed dataset context",
  get_workspace_activity: "Reviewed workspace activity",
  get_schema: "Checked the data structure",
  list_connections: "Checked available connections",
  move_chart_to_dashboard: "Added the chart to a dashboard",
  preview_kpi_review: "Prepared a KPI review",
  preview_metric_monitor: "Prepared a watched metric",
  recommend_metric_monitors: "Found metrics to watch",
  run_existing_dataset: "Analyzed the dataset",
  run_query: "Retrieved the requested data",
  search_datasets: "Found relevant datasets",
  suggest_chart: "Selected a visualization",
  summarize: "Analyzed the results",
  update_chart: "Updated the chart",
  update_dataset: "Updated the dataset",
  validate_query: "Checked the data request",
};

function cleanActivityLabel(value) {
  return `${value || ""}`
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/\.{3}$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getToolDisplayName(toolName, displayNames = {}) {
  return TOOL_ACTIVITY_LABELS[toolName]
    || cleanActivityLabel(displayNames[toolName])
    || "Analyzed the data";
}

export function getOperationSummary(operations, displayNames = {}) {
  const calledTools = operations
    .filter((operation) => operation.type === "call")
    .map((operation) => operation.name);
  const uniqueTools = Array.from(new Set(calledTools));
  const visibleTools = uniqueTools.slice(0, 3).map((toolName) => getToolDisplayName(toolName, displayNames));
  const hiddenCount = Math.max(uniqueTools.length - visibleTools.length, 0);

  if (visibleTools.length === 0) {
    return "Completed the data analysis";
  }

  return `${visibleTools.join(", ")}${hiddenCount > 0 ? `, +${hiddenCount} more` : ""}`;
}

export function getProgressEventMessage(event, displayNames = {}) {
  if (event.toolEvents?.length > 0) {
    return event.toolEvents
      .map((toolEvent) => getToolDisplayName(toolEvent.toolName, {
        ...displayNames,
        [toolEvent.toolName]: toolEvent.displayName,
      }))
      .join(", ");
  }

  if (event.toolDisplayNames?.length > 0) {
    return event.toolDisplayNames.join(", ");
  }

  if (event.tools?.length > 0) {
    return event.tools.map((toolName) => getToolDisplayName(toolName, displayNames)).join(", ");
  }

  const eventLabels = {
    analysis: "Reviewed the available data",
    connection: "Checked the available data sources",
    error: "Could not complete the analysis",
    execution: "Analyzed the data",
    general: "Reviewed the request",
    processing: "Prepared the answer",
    query_generation: "Prepared the analysis",
    visualization: "Prepared a visualization",
  };

  if (eventLabels[event.type]) return eventLabels[event.type];

  const toolMatch = event.message?.match(/:\s*(.+)$/);
  if (toolMatch?.[1]) {
    return toolMatch[1]
      .split(",")
      .map((toolName) => getToolDisplayName(toolName.trim(), displayNames))
      .join(", ");
  }

  return "Analyzing the data";
}

export function normalizeProgressEvent(data = {}) {
  return {
    id: Date.now() + Math.random(),
    conversationId: data.conversationId,
    type: data.event,
    message: data.data?.message || "Processing...",
    tools: data.data?.tools || [],
    toolDisplayNames: data.data?.toolDisplayNames || data.data?.tool_display_names || [],
    toolEvents: data.data?.toolEvents || data.data?.tool_events || [],
    status: data.data?.status,
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
  };
}

export function isProgressForConversation(event, conversationId) {
  if (conversationId == null || conversationId === "") return false;
  if (event?.conversationId == null || event.conversationId === "") return true;
  return `${event.conversationId}` === `${conversationId}`;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

export function getUserMessageDisplayContent(content) {
  const prefix = "Please execute this action:";
  if (!content?.startsWith(prefix)) return content;
  const action = parseJson(content.slice(prefix.length).trim());
  return action?.label || "Continue with the selected action";
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
  if (!content?.chart_id || !["create_chart", "update_chart", "create_temporary_chart", "update_dataset"].includes(message.name)) {
    return null;
  }

  const isTemporary = content.visibility === "temporary" ||
    message.name === "create_temporary_chart" ||
    content.is_temporary ||
    content.ghost_project_id;

  return {
    type: isTemporary ? "chart_temporary" : message.name === "create_chart" ? "chart_created" : "chart_updated",
    toolName: message.name,
    chartId: content.chart_id,
    chartName: content.chart_name || content.name,
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

    const actionPreview = parseJson(message.content);
    if (
      ["preview_kpi_review", "preview_metric_monitor"].includes(message.name)
      && actionPreview?.status === "ready_for_confirmation"
      && actionPreview.actionId
      && actionPreview.preview
    ) {
      return {
        type: "action_preview",
        action: {
          actionId: actionPreview.actionId,
          actionType: message.name === "preview_metric_monitor"
            ? `metric_monitor.${actionPreview.preview.action}`
            : `kpi_review.${actionPreview.preview.action}`,
          expiresAt: actionPreview.expiresAt,
          preview: actionPreview.preview,
          warnings: actionPreview.warnings || [],
        },
      };
    }

    return {
      type: "tool_result",
      name: message.name,
      content: parseJson(message.content) || message.content,
    };
  }

  if (message.role === "assistant" && message.content) {
    const actionResultMatch = message.content.match(/```cb-action-result\s*\n([\s\S]*?)\n```/);
    const actionResult = actionResultMatch ? parseJson(actionResultMatch[1]) : message.actionResult;
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

    const contentWithoutActions = message.content
      .replace(/```cb-actions[\s\S]*?```/g, "")
      .replace(/```cb-action-result[\s\S]*?```/g, "")
      .replace(/cb-actions[\s\S]*$/g, "")
      .trim();

    if (suggestionsData && suggestionsData.version === 1 && Array.isArray(suggestionsData.suggestions)) {
      const content = stripGeneratedTitle(contentWithoutActions);

      return {
        type: "message_with_suggestions",
        actionResult,
        content,
        suggestions: suggestionsData.suggestions,
      };
    }

    if (contentWithoutActions !== message.content) {
      return {
        type: "message",
        actionResult,
        content: stripGeneratedTitle(contentWithoutActions),
      };
    }
  }

  if (message.pendingAction) {
    return {
      type: "message_with_action",
      action: message.pendingAction,
      content: stripGeneratedTitle(message.content),
    };
  }

  return {
    type: "message",
    actionResult: message.actionResult,
    content: stripGeneratedTitle(message.content),
  };
}

export function getCompletedActionIds(messages = []) {
  return new Set(messages.map((message) => parseAiMessage(message).actionResult?.actionId).filter(Boolean));
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
