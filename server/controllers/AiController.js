const crypto = require("crypto");
const { fn, col, Op } = require("sequelize");

const {
  availableTools,
  orchestrate,
  orchestrateWorkspaceSplit,
} = require("../modules/ai/orchestrator/orchestrator");
const moveChartToDashboard = require("../modules/ai/orchestrator/tools/moveChartToDashboard");
const {
  runDeterministicWorkspaceRequest,
} = require("../modules/ai/orchestrator/runtime/deterministicExecutor");
const {
  isTypedConfirmation,
  routeWorkspaceRequest,
} = require("../modules/ai/orchestrator/runtime/deterministicRouter");
const { getAiRoleScope } = require("../modules/ai/orchestrator/rolePolicy");
const db = require("../models/models");
const { runMemoryCommand, redactMemoryCommand } = require("../modules/ai/memory");
const runtimeCache = require("../modules/runtimeCache");
const socketManager = require("../modules/socketManager");
const {
  loadAiConversationContext,
  replaceAiConversationContext,
  searchAiContext,
  serializeAiContext,
  validateAiContext,
} = require("../modules/ai/contextAuthorization");
const {
  canEditProject,
  getObservationAccess,
} = require("../modules/observations/access");
const { getWorkspaceAccessEnvelope } = require("../modules/workspaceContext/accessEnvelope");
const {
  CHARTBREW_AI_DISABLED_MESSAGE,
  getWorkspaceOrchestratorPolicy,
} = require("../modules/workspaceContext/policy");
const { executePendingAction } = require("../modules/workspaceContext/pendingActionExecutor");
const {
  isDirectMetricWriteInstruction,
} = require("../modules/workspaceContext/instructionGate");
const {
  clearPendingActions,
  listPendingActions,
} = require("../modules/workspaceContext/previewStore");
const {
  ACTIVITY_INTENTS,
} = require("../modules/workspaceContext/workspaceActivityFocus");

const NON_PERSISTENT_WORKSPACE_TOOLS = new Set([
  "get_workspace_activity",
  "get_workspace_context",
  "list_kpi_reviews",
  "list_metric_monitors",
  "preview_kpi_review",
  "preview_metric_monitor",
  "recommend_metric_monitors",
]);
const CHART_REFERENCE_TOOLS = new Set([
  "create_temporary_chart",
  "move_chart_to_dashboard",
  "update_chart",
  "update_dataset",
]);
const MAX_SESSION_MESSAGES = 60;
const MAX_SESSION_CHARACTERS = 100000;
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlaceholderTitle(title) {
  return !title?.trim() || /^(saved conversation|new conversation|quick action|untitled conversation)$/i.test(title.trim());
}

function getConversationTitle(title, question) {
  if (!isPlaceholderTitle(title)) return title;
  const text = typeof question === "string" ? question.replace(/\s+/g, " ").trim() : "";
  return text.length > 120 ? `${text.slice(0, 117).trimEnd()}…` : text || "Untitled conversation";
}

function validateSessionId(sessionId) {
  if (!sessionId) return crypto.randomUUID();
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    const error = new Error("This chat session is not valid");
    error.statusCode = 400;
    throw error;
  }
  return sessionId;
}

function createAiError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function buildAiDisabledOrchestration({ persistence, sessionId } = {}) {
  return {
    iterations: 0,
    message: CHARTBREW_AI_DISABLED_MESSAGE,
    pendingAction: null,
    persistence,
    ...(sessionId ? { sessionId } : {}),
    usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 },
    usageRecords: [],
  };
}

function getAiSessionBinding(type, id) {
  return `${type}:${id}`;
}

function validateConfirmationAction(action) {
  if (!action || action.type !== "confirm_pending_action" || !ACTION_ID_PATTERN.test(action.actionId)) {
    throw createAiError("This confirmation is not valid", 400);
  }
  return action;
}

function validateChartPlacementAction(action) {
  const chartId = Number(action?.chartId);
  const targetProjectId = Number(action?.targetProjectId);
  if (action?.type !== "add_preview_to_dashboard"
    || !Number.isInteger(chartId)
    || chartId < 1
    || !Number.isInteger(targetProjectId)
    || targetProjectId < 1) {
    throw createAiError("Choose a valid chart preview and dashboard", 400);
  }
  return { chartId, targetProjectId };
}

function getSinglePendingActionId(actions = []) {
  if (actions.length === 0) {
    throw createAiError("There is no prepared change to confirm", 409);
  }
  if (actions.length > 1) {
    throw createAiError("Choose one prepared change and confirm it from its preview", 409);
  }
  return actions[0].actionId;
}

function formatActionResultMessage(result) {
  const action = result.actionType?.endsWith(".create") ? "created" : "updated";
  if (result.actionType?.startsWith("metric_monitor.")) {
    const details = [
      result.applied.comparisonPeriod ? `${result.applied.comparisonPeriod} comparison` : null,
      result.applied.thresholdValue !== null && result.applied.thresholdValue !== undefined
        ? `${result.applied.thresholdValue} ${result.applied.thresholdType || "threshold"}`
        : null,
    ].filter(Boolean).join(" and ");
    return `${result.resource.name || "The watched metric"} was ${action}${details ? ` with a ${details}` : ""}.`;
  }
  const schedule = [
    result.applied.cadence,
    result.applied.localDeliveryTime,
    result.applied.timezone,
  ].filter(Boolean).join(" at ");
  return `Your KPI review was ${action}${schedule ? ` with the ${schedule} schedule` : ""}.`;
}

function replaceLastAssistantMessage(history = [], content) {
  const messages = [...history];
  const index = messages.findLastIndex((message) => message.role === "assistant");
  if (index < 0) return [...messages, { content, role: "assistant" }];
  messages[index] = {
    ...messages[index],
    content,
  };
  return messages;
}

async function applyDirectMetricInstruction({
  access,
  metricMonitorWritesEnabled,
  orchestration,
  question,
  sessionId,
}) {
  const pendingAction = orchestration?.pendingAction;
  if (!metricMonitorWritesEnabled
    || !pendingAction?.actionId
    || !isDirectMetricWriteInstruction(question, pendingAction.actionType)) {
    return orchestration;
  }
  const result = await executePendingAction({
    access,
    actionId: pendingAction.actionId,
    authorityType: "clear_instruction",
    sessionId,
  });
  const message = formatActionResultMessage(result);
  return {
    ...orchestration,
    actionResult: result,
    conversationHistory: replaceLastAssistantMessage(
      orchestration.conversationHistory,
      message
    ),
    message,
    pendingAction: null,
  };
}

async function runExternalWorkspaceOrchestration({
  access,
  history,
  options,
  question,
}) {
  if (!options.canUseExternalWorkspaceContext) return null;
  try {
    return await orchestrateWorkspaceSplit({
      access,
      history,
      options,
      question,
    });
  } catch (_error) {
    return runDeterministicWorkspaceRequest({
      access,
      allowPlannerFallback: true,
      history,
      question,
    });
  }
}

function shouldPreferExternalActivitySynthesis(question, options = {}) {
  if (!options.canUseExternalWorkspaceContext) return false;
  const route = routeWorkspaceRequest({ message: question });
  return route?.mode === "fast_path" && ACTIVITY_INTENTS.has(route.intent);
}

function getPersistedAiMessageContent(message) {
  if (message.role === "tool" && NON_PERSISTENT_WORKSPACE_TOOLS.has(message.name)) {
    return JSON.stringify({ status: "refresh_required" });
  }
  return message.content;
}

function getReplaySafeAiMessage(message) {
  return {
    ...message,
    content: getPersistedAiMessageContent(message),
  };
}

function assertConversationOwnership(conversation, userId) {
  if (!conversation) {
    throw createAiError("Conversation not found", 404);
  }

  if (`${conversation.user_id}` !== `${userId}`) {
    throw createAiError("Conversation does not belong to this user", 403);
  }
}

async function getOrchestration(
  teamId,
  question,
  _conversationHistory,
  aiConversationId,
  userId,
  context = null,
  clientSessionId = null,
) {
  const access = await getObservationAccess(teamId, userId);
  const requestedContext = Array.isArray(context)
    ? await validateAiContext(access, context)
    : null;
  let conversation;

  // Load existing conversation or create new one
  if (aiConversationId) {
    conversation = await db.AiConversation.findByPk(aiConversationId);
    if (!conversation) {
      throw createAiError("Conversation not found", 404);
    }
    if (`${conversation.team_id}` !== `${teamId}`) {
      throw createAiError("Conversation does not belong to this team", 403);
    }
    assertConversationOwnership(conversation, userId);
  } else {
    // Create new conversation
    conversation = await db.AiConversation.create({
      team_id: teamId,
      user_id: userId,
      title: getConversationTitle(null, question),
      status: "active",
    });

    // Emit conversation ID to user's room immediately so they can join before orchestration
    socketManager.emitToUser(userId, "conversation-created", {
      conversationId: conversation.id,
      teamId,
      sessionId: clientSessionId,
    });
  }

  await clearPendingActions({
    access,
    sessionId: getAiSessionBinding("conversation", conversation.id),
  });

  const storedContext = aiConversationId
    ? await loadAiConversationContext(access, conversation.id)
    : { context: [] };
  const validatedContext = requestedContext || storedContext.context;

  // Conversation history is always rebuilt on the server.
  const messages = await db.AiMessage.findAll({
    where: { conversation_id: conversation.id },
    order: [["sequence", "ASC"]],
  });

  const orchestrationOptions = await getOrchestrationOptions(
    access,
    userId,
    getAiSessionBinding("conversation", conversation.id)
  );

  const fullHistory = messages.filter((msg) => {
    return !msg.sensitive_workspace_context
      || msg.workspace_access_version === orchestrationOptions.workspaceAccessVersion;
  }).map((msg) => {
    const messageObj = {
      role: msg.role,
      content: msg.content,
    };

    if (msg.tool_calls) messageObj.tool_calls = msg.tool_calls;
    if (msg.tool_name) messageObj.name = msg.tool_name;
    if (msg.tool_call_id) messageObj.tool_call_id = msg.tool_call_id;
    return redactMemoryCommand(messageObj);
  });

  if (Array.isArray(context)) {
    await replaceAiConversationContext(conversation.id, teamId, validatedContext);
  }

  // Keep the question even if the response fails or the user leaves the page.
  await db.AiMessage.create({
    conversation_id: conversation.id, role: "user", content: question, sequence: messages.length,
  });

  try {
    const memoryResult = await runMemoryCommand({ question, teamId, userId, history: fullHistory });
    const roleBoundary = memoryResult || await runDeterministicWorkspaceRequest({
      access,
      history: fullHistory,
      question,
      roleBoundaryOnly: true,
    });
    const preferExternalActivitySynthesis = validatedContext.length === 0
      && shouldPreferExternalActivitySynthesis(question, orchestrationOptions);
    const orchestration = roleBoundary || (validatedContext.length === 0
      && !preferExternalActivitySynthesis
      ? await runDeterministicWorkspaceRequest({
        access,
        allowPlannerFallback: !orchestrationOptions.canUseExternalWorkspaceContext,
        history: fullHistory,
        question,
      })
      : null);
    let resolvedOrchestration = orchestration;
    if (!resolvedOrchestration && validatedContext.length === 0) {
      resolvedOrchestration = await runExternalWorkspaceOrchestration({
        access,
        history: fullHistory,
        options: orchestrationOptions,
        question,
      });
    }
    if (!resolvedOrchestration) {
      try {
        resolvedOrchestration = await orchestrate(
          teamId,
          question,
          fullHistory,
          conversation,
          validatedContext,
          orchestrationOptions,
        );
      } catch (providerError) {
        const fallback = validatedContext.length === 0
          ? await runDeterministicWorkspaceRequest({
            access,
            allowPlannerFallback: true,
            history: fullHistory,
            question,
          })
          : null;
        if (!fallback) throw providerError;
        resolvedOrchestration = fallback;
      }
    }
    resolvedOrchestration = await applyDirectMetricInstruction({
      access,
      metricMonitorWritesEnabled: orchestrationOptions.metricMonitorWritesEnabled,
      orchestration: resolvedOrchestration,
      question,
      sessionId: getAiSessionBinding("conversation", conversation.id),
    });

    // Get the starting sequence number (0 for new conversations, or continue from existing)
    const existingMessageCount = await db.AiMessage.count({
      where: { conversation_id: conversation.id }
    });

    // Save new messages to AiMessage table
    const currentTurnStart = resolvedOrchestration.conversationHistory.findLastIndex((item) => {
      return item.role === "user" && item.content === question;
    });
    const newMessages = resolvedOrchestration.conversationHistory.slice(
      currentTurnStart >= 0 ? currentTurnStart : fullHistory.length
    ).filter((msg, index) => !(index === 0 && msg.role === "user" && msg.content === question));
    const messagePromises = newMessages.map((msg, index) => {
      const messageData = {
        conversation_id: conversation.id,
        role: msg.role,
        content: msg.content,
        sequence: existingMessageCount + index,
        sensitive_workspace_context: msg.role !== "user"
          && Boolean(resolvedOrchestration.contextManifest),
        workspace_access_version: msg.role !== "user"
          && resolvedOrchestration.contextManifest
          ? orchestrationOptions.workspaceAccessVersion
          : null,
      };

      // Handle tool calls for assistant messages
      if (msg.tool_calls) {
        messageData.tool_calls = msg.tool_calls;
      }

      // Handle tool result messages
      if (msg.role === "tool") {
        messageData.tool_name = msg.name;
        messageData.tool_call_id = msg.tool_call_id;
        messageData.content = getPersistedAiMessageContent(msg);
        // Store preview of tool result (first 500 chars)
        const resultStr = typeof messageData.content === "string"
          ? messageData.content
          : JSON.stringify(messageData.content);
        messageData.tool_result_preview = resultStr.substring(0, 500);
      }

      return db.AiMessage.create(messageData);
    });

    await Promise.all(messagePromises);

    // Save usage records to AiUsage table
    const usagePromises = (resolvedOrchestration.usageRecords || []).map((usage) => db.AiUsage.create({
      conversation_id: conversation.id,
      team_id: teamId,
      model: usage.model,
      prompt_tokens: usage.prompt_tokens,
      purpose: usage.purpose || "ask_data",
      context_manifest: usage.context_manifest || resolvedOrchestration.contextManifest || null,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      elapsed_ms: usage.elapsed_ms,
      cost_micros: 0, // TODO: Calculate cost based on model pricing
    }));

    await Promise.all(usagePromises);

    // Update conversation metadata
    const updateData = {
      message_count: resolvedOrchestration.conversationHistory.filter((msg) => msg.role === "user").length,
      status: "active",
      error_message: null,
      title: getConversationTitle(conversation.title, messages.find((msg) => msg.role === "user")?.content || question),
    };

    await conversation.update(updateData);

    return {
      ...resolvedOrchestration,
      aiConversationId: conversation.id,
    };
  } catch (error) {
    // Update conversation status on error
    await conversation.update({
      status: "error",
      message_count: messages.filter((msg) => msg.role === "user").length + 1,
      error_message: "Chartbrew could not complete this request. Try again.",
    });

    // Emit error event via socket
    if (conversation?.id) {
      socketManager.emitProgress(conversation.id, "error", {
        message: "Chartbrew could not complete this request. Try again."
      });
    }

    throw error;
  }
}

async function getOrchestrationOptions(access, userId, aiSessionId) {
  const envelope = await getWorkspaceAccessEnvelope(access);
  const roleScope = getAiRoleScope(access, envelope);
  return {
    aiAccessMode: roleScope.accessMode,
    allowedProjectIds: access.allProjects ? undefined : access.projectIds,
    allowedEditableProjectIds: envelope.editableProjectIds,
    allowedToolNames: roleScope.allowedToolNames,
    canConfigureTeam: access.canConfigureTeam,
    canUseExternalWorkspaceContext: envelope.canUseExternalWorkspaceContext,
    aiSessionId,
    kpiReviewWritesEnabled: envelope.kpiReviewWritesEnabled,
    metricMonitorWritesEnabled: envelope.metricMonitorWritesEnabled,
    workspaceAccessVersion: envelope.accessVersion,
    userId,
  };
}

function trimSessionHistory(history = []) {
  const selected = history.slice(-MAX_SESSION_MESSAGES);
  let characters = 0;
  const bounded = [];
  for (let index = selected.length - 1; index >= 0; index--) {
    const message = selected[index];
    const length = typeof message.content === "string"
      ? message.content.length
      : JSON.stringify(message.content || "").length;
    if (characters + length > MAX_SESSION_CHARACTERS) break;
    characters += length;
    bounded.unshift(message);
  }
  return bounded;
}

async function saveUsageRecords(teamId, conversationId, usageRecords = []) {
  return Promise.all(usageRecords.map((usage) => db.AiUsage.create({
    completion_tokens: usage.completion_tokens,
    conversation_id: conversationId,
    cost_micros: 0,
    context_manifest: usage.context_manifest || null,
    elapsed_ms: usage.elapsed_ms,
    model: usage.model,
    prompt_tokens: usage.prompt_tokens,
    purpose: usage.purpose || "ask_data",
    team_id: teamId,
    total_tokens: usage.total_tokens,
  })));
}

async function confirmPersistentAction({ action, aiConversationId, teamId, userId }) {
  if (!aiConversationId || !ACTION_ID_PATTERN.test(aiConversationId)) {
    throw createAiError("Open the conversation that prepared this change", 400);
  }
  const conversation = await db.AiConversation.findByPk(aiConversationId);
  if (!conversation || `${conversation.team_id}` !== `${teamId}`) {
    throw createAiError("Conversation not found", 404);
  }
  assertConversationOwnership(conversation, userId);
  const access = await getObservationAccess(teamId, userId);
  const envelope = await getWorkspaceAccessEnvelope(access);
  const result = await executePendingAction({
    access,
    actionId: action.actionId,
    sessionId: getAiSessionBinding("conversation", conversation.id),
  });
  const message = formatActionResultMessage(result);
  const storedMessage = `${message}\n\n\`\`\`cb-action-result\n${JSON.stringify({
    actionId: result.actionId,
    status: result.status,
  })}\n\`\`\``;
  const existingMessageCount = await db.AiMessage.count({
    where: { conversation_id: conversation.id },
  });
  await db.AiMessage.bulkCreate([{
    content: "Confirm this change",
    conversation_id: conversation.id,
    role: "user",
    sequence: existingMessageCount,
  }, {
    content: storedMessage,
    conversation_id: conversation.id,
    role: "assistant",
    sensitive_workspace_context: true,
    sequence: existingMessageCount + 1,
    workspace_access_version: envelope.accessVersion,
  }]);
  await conversation.update({
    error_message: null,
    message_count: Number(conversation.message_count || 0) + 1,
    status: "active",
  });
  return {
    actionResult: result,
    aiConversationId: conversation.id,
    iterations: 0,
    message,
    persistence: "persistent",
    usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 },
    usageRecords: [],
  };
}

async function confirmEphemeralAction({ action, sessionId, teamId, userId }) {
  if (!sessionId) throw createAiError("This chat has expired", 404);
  const validSessionId = validateSessionId(sessionId);
  const session = await runtimeCache.getAiSession({
    sessionId: validSessionId,
    teamId,
    userId,
  });
  if (!session) throw createAiError("This chat has expired", 404);
  const access = await getObservationAccess(teamId, userId);
  const envelope = await getWorkspaceAccessEnvelope(access);
  if (session.accessVersion !== envelope.accessVersion) {
    await clearPendingActions({
      access,
      sessionId: getAiSessionBinding("session", validSessionId),
    });
    await runtimeCache.deleteAiSession({ sessionId: validSessionId, teamId, userId });
    throw createAiError("Your workspace access changed. Prepare the change again.", 409);
  }
  const result = await executePendingAction({
    access,
    actionId: action.actionId,
    sessionId: getAiSessionBinding("session", validSessionId),
  });
  const message = formatActionResultMessage(result);
  const history = trimSessionHistory([
    ...(session.history || []),
    { content: "Confirm this change", role: "user" },
    { content: message, role: "assistant" },
  ]);
  await runtimeCache.setAiSession({
    payload: {
      ...session,
      history,
      messageCount: history.filter((item) => item.role === "user").length,
    },
    sessionId: validSessionId,
    teamId,
    userId,
  });
  return {
    actionResult: result,
    iterations: 0,
    message,
    persistence: "ephemeral",
    sessionId: validSessionId,
    usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 },
    usageRecords: [],
  };
}

function hasChartReference(message, chartId, accessVersion = null) {
  if (accessVersion
    && message.sensitive_workspace_context
    && message.workspace_access_version !== accessVersion) return false;
  if (!CHART_REFERENCE_TOOLS.has(message.tool_name || message.name)) return false;
  try {
    return `${JSON.parse(message.content).chart_id}` === `${chartId}`;
  } catch (_error) {
    return false;
  }
}

async function placeChartPreview({ action, aiConversationId, persistence, sessionId, teamId, userId }) {
  const { chartId, targetProjectId } = validateChartPlacementAction(action);
  const access = await getObservationAccess(teamId, userId);
  const envelope = await getWorkspaceAccessEnvelope(access);
  let conversation = null;
  let session = null;
  let history;
  let resolvedSessionId;

  if (persistence === "persistent") {
    if (!aiConversationId || !ACTION_ID_PATTERN.test(aiConversationId)) {
      throw createAiError("Open the conversation that created this preview", 400);
    }
    conversation = await db.AiConversation.findOne({
      where: { id: aiConversationId, team_id: teamId },
    });
    assertConversationOwnership(conversation, userId);
    history = await db.AiMessage.findAll({
      order: [["sequence", "ASC"]],
      where: { conversation_id: conversation.id },
    });
  } else if (persistence === "ephemeral") {
    if (!sessionId) throw createAiError("This chat has expired", 404);
    resolvedSessionId = validateSessionId(sessionId);
    session = await runtimeCache.getAiSession({
      sessionId: resolvedSessionId,
      teamId,
      userId,
    });
    if (!session) throw createAiError("This chat has expired", 404);
    if (session.accessVersion !== envelope.accessVersion) {
      throw createAiError("Your workspace access changed. Start a new chat.", 409);
    }
    history = session.history || [];
  } else {
    throw createAiError("Choose a valid conversation mode", 400);
  }

  const previewIndexes = history.map((item, index) => (
    hasChartReference(item, chartId, envelope.accessVersion) ? index : -1
  )).filter((index) => index !== -1);
  if (previewIndexes.length === 0) {
    throw createAiError("This chart preview is not part of this conversation", 409);
  }

  const chart = await db.Chart.findOne({
    attributes: ["id", "name", "project_id", "type"],
    include: [{
      model: db.Project,
      attributes: ["ghost", "id", "name", "team_id"],
      required: true,
    }],
    where: { id: chartId },
  });
  if (!chart || Number(chart.Project.team_id) !== Number(teamId)) {
    throw createAiError("This chart preview is no longer available", 409);
  }
  const targetProject = await db.Project.findOne({
    attributes: ["ghost", "id", "name", "team_id"],
    where: { id: targetProjectId, team_id: teamId },
  });
  if (!targetProject || targetProject.ghost) {
    throw createAiError("Choose an available dashboard", 404);
  }
  if (!canEditProject(access, targetProject.id)) {
    throw createAiError("You do not have permission to add charts to this dashboard", 403);
  }
  if (!chart.Project.ghost && Number(chart.project_id) !== Number(targetProject.id)) {
    throw createAiError(`This chart is already saved to ${chart.Project.name}`, 409);
  }

  const result = await moveChartToDashboard({
    chart_id: chart.id,
    target_project_id: targetProject.id,
    team_id: teamId,
  });
  const resultContent = JSON.stringify(result);

  if (conversation) {
    await Promise.all(previewIndexes.map((index) => history[index].update({
      content: resultContent,
      tool_result_preview: resultContent.substring(0, 500),
    })));
  } else {
    const updatedHistory = history.map((item, index) => (
      previewIndexes.includes(index) ? { ...item, content: resultContent } : item
    ));
    await runtimeCache.setAiSession({
      payload: {
        ...session,
        history: updatedHistory,
      },
      sessionId: resolvedSessionId,
      teamId,
      userId,
    });
  }

  return {
    chartId: result.chart_id,
    chartName: result.chart_name,
    chartType: result.chart_type,
    dashboard: result.dashboard,
    datasets: result.datasets || [],
    projectId: result.new_project_id,
    toolName: "move_chart_to_dashboard",
    visibility: "dashboard",
  };
}

async function confirmTypedPersistentAction({ aiConversationId, teamId, userId }) {
  if (!aiConversationId || !ACTION_ID_PATTERN.test(aiConversationId)) {
    throw createAiError("Open the conversation that prepared this change", 400);
  }
  const conversation = await db.AiConversation.findOne({
    attributes: ["id", "team_id", "user_id"],
    where: { id: aiConversationId, team_id: teamId },
  });
  assertConversationOwnership(conversation, userId);
  const access = await getObservationAccess(teamId, userId);
  const sessionId = getAiSessionBinding("conversation", conversation.id);
  const actions = await listPendingActions({ access, sessionId });
  return confirmPersistentAction({
    action: {
      actionId: getSinglePendingActionId(actions),
      type: "confirm_pending_action",
    },
    aiConversationId: conversation.id,
    teamId,
    userId,
  });
}

async function confirmTypedEphemeralAction({ sessionId, teamId, userId }) {
  if (!sessionId) throw createAiError("This chat has expired", 404);
  const validSessionId = validateSessionId(sessionId);
  const session = await runtimeCache.getAiSession({
    sessionId: validSessionId,
    teamId,
    userId,
  });
  if (!session) throw createAiError("This chat has expired", 404);
  const access = await getObservationAccess(teamId, userId);
  const actions = await listPendingActions({
    access,
    sessionId: getAiSessionBinding("session", validSessionId),
  });
  return confirmEphemeralAction({
    action: {
      actionId: getSinglePendingActionId(actions),
      type: "confirm_pending_action",
    },
    sessionId: validSessionId,
    teamId,
    userId,
  });
}

async function respond({
  action,
  aiConversationId,
  context,
  message,
  persistence = "persistent",
  sessionId,
  teamId,
  userId,
}) {
  if (!getWorkspaceOrchestratorPolicy().enabled
    && (action || isTypedConfirmation(message))) {
    return buildAiDisabledOrchestration({ persistence, sessionId });
  }
  if (action) {
    const confirmation = validateConfirmationAction(action);
    if (persistence === "persistent") {
      return confirmPersistentAction({
        action: confirmation,
        aiConversationId,
        teamId,
        userId,
      });
    }
    if (persistence === "ephemeral") {
      return confirmEphemeralAction({
        action: confirmation,
        sessionId,
        teamId,
        userId,
      });
    }
    throw createAiError("Choose a valid conversation mode", 400);
  }
  if (!message || !`${message}`.trim()) {
    throw createAiError("Ask a question about your data", 400);
  }
  if (isTypedConfirmation(message)) {
    if (persistence === "persistent") {
      return confirmTypedPersistentAction({ aiConversationId, teamId, userId });
    }
    if (persistence === "ephemeral") {
      return confirmTypedEphemeralAction({ sessionId, teamId, userId });
    }
    throw createAiError("Choose a valid conversation mode", 400);
  }
  if (persistence === "persistent") {
    const orchestration = await getOrchestration(
      teamId,
      `${message}`.trim(),
      [],
      aiConversationId,
      userId,
      context,
      sessionId ? validateSessionId(sessionId) : null,
    );
    return {
      ...orchestration,
      conversationHistory: undefined,
      persistence: "persistent",
    };
  }
  if (persistence !== "ephemeral") {
    throw createAiError("Choose a valid conversation mode", 400);
  }

  const access = await getObservationAccess(teamId, userId);
  const envelope = await getWorkspaceAccessEnvelope(access);
  const resolvedSessionId = validateSessionId(sessionId);
  let existingSession = await runtimeCache.getAiSession({
    sessionId: resolvedSessionId,
    teamId,
    userId,
  });
  if (existingSession && existingSession.accessVersion !== envelope.accessVersion) {
    await clearPendingActions({
      access,
      sessionId: getAiSessionBinding("session", resolvedSessionId),
    });
    await runtimeCache.deleteAiSession({
      sessionId: resolvedSessionId,
      teamId,
      userId,
    });
    existingSession = null;
  }
  await clearPendingActions({
    access,
    sessionId: getAiSessionBinding("session", resolvedSessionId),
  });
  const validatedContext = Array.isArray(context)
    ? await validateAiContext(access, context)
    : await validateAiContext(access, existingSession?.context || []);
  const orchestrationOptions = await getOrchestrationOptions(
    access,
    userId,
    getAiSessionBinding("session", resolvedSessionId)
  );
  const memoryResult = await runMemoryCommand({
    question: `${message}`.trim(), teamId, userId, history: existingSession?.history || [],
  });
  const roleBoundary = memoryResult || await runDeterministicWorkspaceRequest({
    access,
    history: existingSession?.history || [],
    question: `${message}`.trim(),
    roleBoundaryOnly: true,
  });
  const preferExternalActivitySynthesis = validatedContext.length === 0
    && shouldPreferExternalActivitySynthesis(`${message}`.trim(), orchestrationOptions);
  const deterministicResult = roleBoundary || (validatedContext.length === 0
    && !preferExternalActivitySynthesis
    ? await runDeterministicWorkspaceRequest({
      access,
      allowPlannerFallback: !orchestrationOptions.canUseExternalWorkspaceContext,
      history: existingSession?.history || [],
      question: `${message}`.trim(),
    })
    : null);
  let orchestration = deterministicResult;
  if (!orchestration && validatedContext.length === 0) {
    orchestration = await runExternalWorkspaceOrchestration({
      access,
      history: existingSession?.history || [],
      options: orchestrationOptions,
      question: `${message}`.trim(),
    });
  }
  if (!orchestration) {
    try {
      orchestration = await orchestrate(
        teamId,
        `${message}`.trim(),
        existingSession?.history || [],
        { id: resolvedSessionId, message_count: existingSession?.messageCount || 0 },
        validatedContext,
        orchestrationOptions,
      );
    } catch (providerError) {
      const fallback = validatedContext.length === 0
        ? await runDeterministicWorkspaceRequest({
          access,
          allowPlannerFallback: true,
          history: existingSession?.history || [],
          question: `${message}`.trim(),
        })
        : null;
      if (!fallback) throw providerError;
      orchestration = fallback;
    }
  }
  orchestration = await applyDirectMetricInstruction({
    access,
    metricMonitorWritesEnabled: orchestrationOptions.metricMonitorWritesEnabled,
    orchestration,
    question: `${message}`.trim(),
    sessionId: getAiSessionBinding("session", resolvedSessionId),
  });
  const history = trimSessionHistory(
    orchestration.conversationHistory.map(getReplaySafeAiMessage)
  );
  const messageCount = history.filter((item) => item.role === "user").length;
  await Promise.all([
    runtimeCache.setAiSession({
      payload: {
        accessVersion: envelope.accessVersion,
        context: validatedContext.map((item) => ({
          entityId: item.entityId,
          entityType: item.entityType,
        })),
        history,
        messageCount,
      },
      sessionId: resolvedSessionId,
      teamId,
      userId,
    }),
    saveUsageRecords(teamId, null, orchestration.usageRecords),
  ]);
  return {
    ...orchestration,
    conversationHistory: undefined,
    persistence: "ephemeral",
    sessionId: resolvedSessionId,
  };
}

async function promoteSession({ sessionId, teamId, userId }) {
  const validSessionId = validateSessionId(sessionId);
  const session = await runtimeCache.getAiSession({
    sessionId: validSessionId,
    teamId,
    userId,
  });
  if (!session) throw createAiError("This chat has expired", 404);
  const access = await getObservationAccess(teamId, userId);
  const envelope = await getWorkspaceAccessEnvelope(access);
  if (session.accessVersion !== envelope.accessVersion) {
    await clearPendingActions({
      access,
      sessionId: getAiSessionBinding("session", validSessionId),
    });
    await runtimeCache.deleteAiSession({ sessionId: validSessionId, teamId, userId });
    throw createAiError("Your workspace access changed. Start a new chat.", 409);
  }
  const validatedContext = await validateAiContext(access, session.context || []);
  const conversation = await db.AiConversation.create({
    message_count: session.messageCount || 0,
    source: "app",
    status: "active",
    team_id: teamId,
    title: getConversationTitle(null, session.history?.find((message) => message.role === "user")?.content),
    user_id: userId,
  });
  const history = trimSessionHistory(session.history);
  await Promise.all(history.map((message, sequence) => db.AiMessage.create({
    content: getPersistedAiMessageContent(message),
    conversation_id: conversation.id,
    role: message.role,
    sequence,
    sensitive_workspace_context: message.role !== "user",
    tool_call_id: message.tool_call_id,
    tool_calls: message.tool_calls,
    tool_name: message.name,
    workspace_access_version: message.role !== "user" ? envelope.accessVersion : null,
  })));
  await replaceAiConversationContext(conversation.id, teamId, validatedContext);
  await clearPendingActions({
    access,
    sessionId: getAiSessionBinding("session", validSessionId),
  });
  await runtimeCache.deleteAiSession({ sessionId: validSessionId, teamId, userId });
  return {
    aiConversationId: conversation.id,
    success: true,
  };
}

async function getAvailableTools() {
  if (!getWorkspaceOrchestratorPolicy().enabled) return [];
  const tools = await availableTools();
  return tools;
}

async function getConversations(teamId, userId, limit = 20, offset = 0) {
  const conversations = await db.AiConversation.findAll({
    where: {
      team_id: teamId,
      user_id: userId,
    },
    order: [["updatedAt", "DESC"]],
    limit,
    offset,
    attributes: ["id", "title", "status", "message_count", "createdAt", "updatedAt", "source"],
    include: [
      {
        model: db.AiUsage,
        attributes: [],
      }
    ],
  });

  // Compute token totals from AiUsage for each conversation
  const conversationsWithUsage = await Promise.all(conversations.map(async (conv) => {
    const firstQuestion = isPlaceholderTitle(conv.title) ? await db.AiMessage.findOne({
      where: { conversation_id: conv.id, role: "user" },
      attributes: ["content"], order: [["sequence", "ASC"]],
    }) : null;
    const usageStats = await db.AiUsage.findAll({
      where: { conversation_id: conv.id },
      attributes: [
        [fn("SUM", col("total_tokens")), "total_tokens"],
        [fn("SUM", col("prompt_tokens")), "prompt_tokens"],
        [fn("SUM", col("completion_tokens")), "completion_tokens"],
      ],
      raw: true,
    });

    const stats = usageStats[0] || {};

    return {
      id: conv.id,
      title: getConversationTitle(conv.title, firstQuestion?.content),
      source: conv.source,
      status: conv.status,
      message_count: conv.message_count,
      total_tokens: parseInt(stats.total_tokens, 10) || 0,
      prompt_tokens: parseInt(stats.prompt_tokens, 10) || 0,
      completion_tokens: parseInt(stats.completion_tokens, 10) || 0,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    };
  }));

  return conversationsWithUsage;
}

async function getConversation(conversationId, teamId, userId) {
  const conversation = await db.AiConversation.findOne({
    where: {
      id: conversationId,
      team_id: teamId,
    },
  });

  assertConversationOwnership(conversation, userId);
  const access = await getObservationAccess(teamId, userId);
  const envelope = await getWorkspaceAccessEnvelope(access);
  const activeContext = await loadAiConversationContext(access, conversationId);

  // Load messages from AiMessage table
  const storedMessages = await db.AiMessage.findAll({
    where: { conversation_id: conversationId },
    order: [["sequence", "ASC"]],
  });
  const hiddenMessageCount = storedMessages.filter((message) => {
    return message.sensitive_workspace_context
      && message.workspace_access_version !== envelope.accessVersion;
  }).length;
  const messages = storedMessages.filter((message) => {
    return !message.sensitive_workspace_context
      || message.workspace_access_version === envelope.accessVersion;
  });

  // Rebuild full_history for backward compatibility with client
  const fullHistory = messages.map((msg) => {
    const messageObj = {
      role: msg.role,
      content: msg.content,
    };

    // Add tool-specific fields
    if (msg.tool_calls) {
      messageObj.tool_calls = msg.tool_calls;
    }
    if (msg.tool_name) {
      messageObj.name = msg.tool_name;
    }
    if (msg.tool_call_id) {
      messageObj.tool_call_id = msg.tool_call_id;
    }

    return messageObj;
  });
  if (hiddenMessageCount > 0) {
    fullHistory.push({
      role: "assistant",
      content: "Some saved answers are hidden because your workspace access changed. Ask again to refresh them.",
    });
  }

  // Compute token usage stats
  const usageStats = await db.AiUsage.findAll({
    where: { conversation_id: conversationId },
    attributes: [
      [fn("SUM", col("total_tokens")), "total_tokens"],
      [fn("SUM", col("prompt_tokens")), "prompt_tokens"],
      [fn("SUM", col("completion_tokens")), "completion_tokens"],
    ],
    raw: true,
  });

  const stats = usageStats[0] || {};

  // Return conversation with messages and usage stats
  return {
    ...conversation.toJSON(),
    title: getConversationTitle(conversation.title, messages.find((message) => message.role === "user")?.content),
    context: serializeAiContext(activeContext.context),
    contextNotice: activeContext.removedCount > 0
      ? "This item is no longer available. Select another item."
      : null,
    full_history: fullHistory,
    total_tokens: parseInt(stats.total_tokens, 10) || 0,
    prompt_tokens: parseInt(stats.prompt_tokens, 10) || 0,
    completion_tokens: parseInt(stats.completion_tokens, 10) || 0,
  };
}

async function getContextOptions(teamId, userId, options = {}) {
  const access = await getObservationAccess(teamId, userId);
  return searchAiContext(access, options);
}

async function deleteConversation(conversationId, teamId, userId) {
  const conversation = await db.AiConversation.findOne({
    where: {
      id: conversationId,
      team_id: teamId,
    },
  });

  assertConversationOwnership(conversation, userId);

  await clearPendingActions({
    access: { teamId, userId },
    sessionId: getAiSessionBinding("conversation", conversationId),
  });

  // Delete messages (AiMessage cascade delete will handle this)
  await db.AiMessage.destroy({
    where: { conversation_id: conversationId }
  });

  // NOTE: We intentionally DO NOT delete AiUsage records
  // They are kept for billing/audit purposes even after conversation deletion
  // The team_id field in AiUsage allows us to track usage history
  // Set conversation_id to NULL in AiUsage records to avoid foreign key constraint
  await db.AiUsage.update(
    { conversation_id: null },
    { where: { conversation_id: conversationId } }
  );

  // Delete the conversation itself
  await conversation.destroy();

  return { success: true };
}

async function getAiUsage(teamId, startDate, endDate) {
  try {
    const whereClause = { team_id: parseInt(teamId, 10) };

    // Add date filtering if provided
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
    }

    // Get total usage
    const totalUsage = await db.AiUsage.findAll({
      where: whereClause,
      attributes: [
        [fn("SUM", col("total_tokens")), "total_tokens"],
        [fn("SUM", col("prompt_tokens")), "prompt_tokens"],
        [fn("SUM", col("completion_tokens")), "completion_tokens"],
        [fn("SUM", col("cost_micros")), "total_cost_micros"],
        [fn("COUNT", col("id")), "api_calls"],
      ],
      raw: true,
    });

    const formattedTotalUsage = {
      total_tokens: parseInt(totalUsage[0]?.total_tokens, 10) || 0,
      prompt_tokens: parseInt(totalUsage[0]?.prompt_tokens, 10) || 0,
      completion_tokens: parseInt(totalUsage[0]?.completion_tokens, 10) || 0,
      total_cost_micros: parseInt(totalUsage[0]?.total_cost_micros, 10) || 0,
      api_calls: parseInt(totalUsage[0]?.api_calls, 10) || 0,
    };

    // Get usage by model
    const usageByModel = await db.AiUsage.findAll({
      where: whereClause,
      attributes: [
        "model",
        [fn("SUM", col("total_tokens")), "total_tokens"],
        [fn("COUNT", col("id")), "api_calls"],
      ],
      group: ["model"],
      raw: true,
    });

    const formattedUsageByModel = usageByModel.map((model) => {
      return {
        model: model.model,
        total_tokens: parseInt(model.total_tokens, 10) || 0,
        api_calls: parseInt(model.api_calls, 10) || 0,
      };
    });

    return {
      total: formattedTotalUsage,
      byModel: formattedUsageByModel,
    };
  } catch (error) {
    throw new Error(error.message);
  }
}

module.exports = {
  getConversationTitle,
  applyDirectMetricInstruction,
  getOrchestration,
  placeChartPreview,
  respond,
  promoteSession,
  getAvailableTools,
  getContextOptions,
  getConversations,
  getConversation,
  deleteConversation,
  getAiUsage,
  getPersistedAiMessageContent,
  getReplaySafeAiMessage,
  getSinglePendingActionId,
  shouldPreferExternalActivitySynthesis,
};
