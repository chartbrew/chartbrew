const crypto = require("crypto");
const { fn, col, Op } = require("sequelize");

const {
  availableTools,
  orchestrate,
  orchestrateWorkspaceSplit,
} = require("../modules/ai/orchestrator/orchestrator");
const {
  runDeterministicWorkspaceRequest,
} = require("../modules/ai/orchestrator/runtime/deterministicExecutor");
const {
  isTypedConfirmation,
} = require("../modules/ai/orchestrator/runtime/deterministicRouter");
const { getAiRoleScope } = require("../modules/ai/orchestrator/rolePolicy");
const db = require("../models/models");
const runtimeCache = require("../modules/runtimeCache");
const socketManager = require("../modules/socketManager");
const { validateAiContext } = require("../modules/ai/contextAuthorization");
const { getObservationAccess } = require("../modules/observations/access");
const { getWorkspaceAccessEnvelope } = require("../modules/workspaceContext/accessEnvelope");
const { executePendingAction } = require("../modules/workspaceContext/pendingActionExecutor");
const {
  isDirectMetricWriteInstruction,
} = require("../modules/workspaceContext/instructionGate");
const {
  clearPendingActions,
  listPendingActions,
} = require("../modules/workspaceContext/previewStore");

const NON_PERSISTENT_WORKSPACE_TOOLS = new Set([
  "get_workspace_activity",
  "get_workspace_context",
  "list_kpi_reviews",
  "list_metric_monitors",
  "preview_kpi_review",
  "preview_metric_monitor",
  "recommend_metric_monitors",
]);
const MAX_SESSION_MESSAGES = 60;
const MAX_SESSION_CHARACTERS = 100000;
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function getAiSessionBinding(type, id) {
  return `${type}:${id}`;
}

function validateConfirmationAction(action) {
  if (!action || action.type !== "confirm_pending_action" || !ACTION_ID_PATTERN.test(action.actionId)) {
    throw createAiError("This confirmation is not valid", 400);
  }
  return action;
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
) {
  const access = await getObservationAccess(teamId, userId);
  const requestedContext = Array.isArray(context) && context.length > 0
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
      title: "New Conversation", // Will be updated by orchestrator
      status: "active",
    });

    // Emit conversation ID to user's room immediately so they can join before orchestration
    socketManager.emitToUser(userId, "conversation-created", {
      conversationId: conversation.id
    });
  }

  await clearPendingActions({
    access,
    sessionId: getAiSessionBinding("conversation", conversation.id),
  });

  const storedContext = aiConversationId
    ? await db.AiConversationContext.findAll({
      attributes: ["entity_id", "entity_type"],
      where: { conversation_id: conversation.id, team_id: teamId },
    })
    : [];
  const validatedContext = requestedContext || await validateAiContext(
    access,
    storedContext.map((item) => ({
      entityId: item.entity_id,
      entityType: item.entity_type,
    })),
  );

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
    return messageObj;
  });

  if (Array.isArray(context) && context.length > 0) {
    await saveConversationContext(conversation.id, teamId, validatedContext);
  }

  try {
    const roleBoundary = await runDeterministicWorkspaceRequest({
      access,
      history: fullHistory,
      question,
      roleBoundaryOnly: true,
    });
    const orchestration = roleBoundary || (validatedContext.length === 0
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
          messages.length === 0 || (Array.isArray(context) && context.length > 0)
            ? validatedContext
            : [],
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

    // Extract title from AI response for new conversations
    let finalMessage = resolvedOrchestration.message;
    let extractedTitle = null;

    if (!conversation || conversation.message_count === 0) {
      // Try to extract title from the first markdown header in the response
      const titleMatch = resolvedOrchestration.message?.match(/^#{1,6}\s+(.+)$/m);
      if (titleMatch) {
        extractedTitle = titleMatch[1].trim();
        // Remove the title line from the response (including newline)
        finalMessage = resolvedOrchestration.message.replace(/^#{1,6}\s+.+\n?/, "").trim();
      }
    }

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
    );
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
    };

    // Update title if extracted
    if (extractedTitle) {
      updateData.title = extractedTitle;
    }

    await conversation.update(updateData);

    return {
      ...resolvedOrchestration,
      message: finalMessage,
      aiConversationId: conversation.id,
    };
  } catch (error) {
    // Update conversation status on error
    await conversation.update({
      status: "error",
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

async function saveConversationContext(conversationId, teamId, context = []) {
  if (!conversationId || context.length === 0) return;
  await Promise.all(context.map((item) => db.AiConversationContext.findOrCreate({
    where: {
      conversation_id: conversationId,
      entity_id: item.entityId,
      entity_type: item.entityType,
    },
    defaults: { team_id: teamId },
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
  persistence = "ephemeral",
  sessionId,
  teamId,
  userId,
}) {
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
  const validatedContext = context?.length
    ? await validateAiContext(access, context)
    : await validateAiContext(access, existingSession?.context || []);
  const promptContext = existingSession && !context?.length ? [] : validatedContext;
  const orchestrationOptions = await getOrchestrationOptions(
    access,
    userId,
    getAiSessionBinding("session", resolvedSessionId)
  );
  const roleBoundary = await runDeterministicWorkspaceRequest({
    access,
    history: existingSession?.history || [],
    question: `${message}`.trim(),
    roleBoundaryOnly: true,
  });
  const deterministicResult = roleBoundary || (validatedContext.length === 0
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
        promptContext,
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
    title: "Saved conversation",
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
  await saveConversationContext(conversation.id, teamId, validatedContext);
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
      title: conv.title,
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
    full_history: fullHistory,
    total_tokens: parseInt(stats.total_tokens, 10) || 0,
    prompt_tokens: parseInt(stats.prompt_tokens, 10) || 0,
    completion_tokens: parseInt(stats.completion_tokens, 10) || 0,
  };
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
  applyDirectMetricInstruction,
  getOrchestration,
  respond,
  promoteSession,
  getAvailableTools,
  getConversations,
  getConversation,
  deleteConversation,
  getAiUsage,
  getPersistedAiMessageContent,
  getReplaySafeAiMessage,
  getSinglePendingActionId,
};
