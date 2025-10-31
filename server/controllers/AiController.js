const { fn, col, Op } = require("sequelize");

const { orchestrate, availableTools } = require("../modules/ai/orchestrator");
const db = require("../models/models");
const socketManager = require("../modules/socketManager");

async function getOrchestration(teamId, question, conversationHistory, aiConversationId, userId, context = null) {
  let conversation;

  // Load existing conversation or create new one
  if (aiConversationId) {
    conversation = await db.AiConversation.findByPk(aiConversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    if (conversation.team_id !== teamId) {
      throw new Error("Conversation does not belong to this team");
    }
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

  // Load conversation history from database if not provided
  let fullHistory = conversationHistory;
  if (!conversationHistory || conversationHistory.length === 0) {
    // Rebuild history from AiMessage table
    const messages = await db.AiMessage.findAll({
      where: { conversation_id: conversation.id },
      order: [["sequence", "ASC"]],
    });

    fullHistory = messages.map((msg) => {
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
  }

  try {
    const orchestration = await orchestrate(teamId, question, fullHistory, conversation, context);

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
    attributes: ["id", "title", "status", "message_count", "createdAt", "updatedAt"],
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

async function getConversation(conversationId, teamId) {
  const conversation = await db.AiConversation.findOne({
    where: {
      id: conversationId,
      team_id: teamId,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

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

async function deleteConversation(conversationId, teamId) {
  const conversation = await db.AiConversation.findOne({
    where: {
      id: conversationId,
      team_id: teamId,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

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
  getAvailableTools,
  getConversations,
  getConversation,
  deleteConversation,
  getAiUsage,
};
