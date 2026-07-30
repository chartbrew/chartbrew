const crypto = require("crypto");
const { fn, col, Op } = require("sequelize");

const { orchestrate, availableTools } = require("../modules/ai/orchestrator/orchestrator");
const db = require("../models/models");
const runtimeCache = require("../modules/runtimeCache");
const socketManager = require("../modules/socketManager");
const { validateAiContext } = require("../modules/ai/contextAuthorization");
const { getObservationAccess } = require("../modules/observations/access");

const READ_ONLY_AI_TOOLS = [
  "get_dataset_intelligence",
  "run_existing_dataset",
  "search_datasets",
  "summarize",
];
const MAX_SESSION_MESSAGES = 60;
const MAX_SESSION_CHARACTERS = 100000;
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const fullHistory = messages.map((msg) => {
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
    const orchestration = await orchestrate(
      teamId,
      question,
      fullHistory,
      conversation,
      messages.length === 0 || (Array.isArray(context) && context.length > 0)
        ? validatedContext
        : [],
      getOrchestrationOptions(access, userId),
    );

    // Extract title from AI response for new conversations
    let finalMessage = orchestration.message;
    let extractedTitle = null;

    if (!conversation || conversation.message_count === 0) {
      // Try to extract title from the first markdown header in the response
      const titleMatch = orchestration.message?.match(/^#{1,6}\s+(.+)$/m);
      if (titleMatch) {
        extractedTitle = titleMatch[1].trim();
        // Remove the title line from the response (including newline)
        finalMessage = orchestration.message.replace(/^#{1,6}\s+.+\n?/, "").trim();
      }
    }

    // Get the starting sequence number (0 for new conversations, or continue from existing)
    const existingMessageCount = await db.AiMessage.count({
      where: { conversation_id: conversation.id }
    });

    // Save new messages to AiMessage table
    const newMessages = orchestration.conversationHistory.slice(existingMessageCount);
    const messagePromises = newMessages.map((msg, index) => {
      const messageData = {
        conversation_id: conversation.id,
        role: msg.role,
        content: msg.content,
        sequence: existingMessageCount + index,
      };

      // Handle tool calls for assistant messages
      if (msg.tool_calls) {
        messageData.tool_calls = msg.tool_calls;
      }

      // Handle tool result messages
      if (msg.role === "tool") {
        messageData.tool_name = msg.name;
        messageData.tool_call_id = msg.tool_call_id;
        // Store preview of tool result (first 500 chars)
        const resultStr = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        messageData.tool_result_preview = resultStr.substring(0, 500);
      }

      return db.AiMessage.create(messageData);
    });

    await Promise.all(messagePromises);

    // Save usage records to AiUsage table
    const usagePromises = (orchestration.usageRecords || []).map((usage) => db.AiUsage.create({
      conversation_id: conversation.id,
      team_id: teamId,
      model: usage.model,
      prompt_tokens: usage.prompt_tokens,
      purpose: "ask_data",
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      elapsed_ms: usage.elapsed_ms,
      cost_micros: 0, // TODO: Calculate cost based on model pricing
    }));

    await Promise.all(usagePromises);

    // Update conversation metadata
    const updateData = {
      message_count: orchestration.conversationHistory.filter((msg) => msg.role === "user").length,
      status: "active",
      error_message: null,
    };

    // Update title if extracted
    if (extractedTitle) {
      updateData.title = extractedTitle;
    }

    await conversation.update(updateData);

    return {
      ...orchestration,
      message: finalMessage,
      aiConversationId: conversation.id,
    };
  } catch (error) {
    // Update conversation status on error
    await conversation.update({
      status: "error",
      error_message: error.message,
    });

    // Emit error event via socket
    if (conversation?.id) {
      socketManager.emitProgress(conversation.id, "error", {
        message: "An error occurred during AI orchestration",
        error: error.message
      });
    }

    throw error;
  }
}

function getOrchestrationOptions(access, userId) {
  return {
    allowedProjectIds: access.allProjects ? undefined : access.projectIds,
    allowedToolNames: access.canConfigureTeam ? undefined : READ_ONLY_AI_TOOLS,
    canConfigureTeam: access.canConfigureTeam,
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
    elapsed_ms: usage.elapsed_ms,
    model: usage.model,
    prompt_tokens: usage.prompt_tokens,
    purpose: "ask_data",
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

async function respond({
  aiConversationId,
  context,
  message,
  persistence = "ephemeral",
  sessionId,
  teamId,
  userId,
}) {
  if (!message || !`${message}`.trim()) {
    throw createAiError("Ask a question about your data", 400);
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
  const resolvedSessionId = validateSessionId(sessionId);
  const existingSession = await runtimeCache.getAiSession({
    sessionId: resolvedSessionId,
    teamId,
    userId,
  });
  const validatedContext = context?.length
    ? await validateAiContext(access, context)
    : await validateAiContext(access, existingSession?.context || []);
  const promptContext = existingSession && !context?.length ? [] : validatedContext;
  const orchestration = await orchestrate(
    teamId,
    `${message}`.trim(),
    existingSession?.history || [],
    { id: resolvedSessionId, message_count: existingSession?.messageCount || 0 },
    promptContext,
    getOrchestrationOptions(access, userId),
  );
  const history = trimSessionHistory(orchestration.conversationHistory);
  const messageCount = history.filter((item) => item.role === "user").length;
  await Promise.all([
    runtimeCache.setAiSession({
      payload: {
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
    content: message.content,
    conversation_id: conversation.id,
    role: message.role,
    sequence,
    tool_call_id: message.tool_call_id,
    tool_calls: message.tool_calls,
    tool_name: message.name,
  })));
  await saveConversationContext(conversation.id, teamId, validatedContext);
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

  // Load messages from AiMessage table
  const messages = await db.AiMessage.findAll({
    where: { conversation_id: conversationId },
    order: [["sequence", "ASC"]],
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
  getOrchestration,
  respond,
  promoteSession,
  getAvailableTools,
  getConversations,
  getConversation,
  deleteConversation,
  getAiUsage,
};
