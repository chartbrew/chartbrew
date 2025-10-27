const { orchestrate, availableTools } = require("../modules/ai/orchestrator");
const db = require("../models/models");
const socketManager = require("../modules/socketManager");

async function getOrchestration(teamId, question, conversationHistory, aiConversationId, userId) {
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
    fullHistory = conversation.full_history || [];
  }

  try {
    const orchestration = await orchestrate(teamId, question, fullHistory, conversation);

    // Extract title from AI response for new conversations
    let finalMessage = orchestration.message;
    let extractedTitle = null;

    if (!conversation || conversation.message_count === 0) {
      // Try to extract title from the first response
      const titleMatch = orchestration.message?.match(/^\[TITLE:\s*([^\]]+)\]/m);
      if (titleMatch) {
        extractedTitle = titleMatch[1].trim();
        // Remove the title line from the response
        finalMessage = orchestration.message.replace(/^\[TITLE:\s*[^\]]+\]\s*/, "").trim();
      }
    }

    // Update conversation with new history and metadata
    const updateData = {
      full_history: orchestration.conversationHistory,
      message_count: orchestration.conversationHistory.filter((msg) => msg.role === "user").length,
      tool_calls_count: orchestration.iterations || 0,
      total_tokens: (orchestration.usage?.total_tokens || 0) + (conversation.total_tokens || 0),
      prompt_tokens: (orchestration.usage?.prompt_tokens || 0) + (conversation.prompt_tokens || 0),
      completion_tokens: (orchestration.usage?.completion_tokens || 0)
        + (conversation.completion_tokens || 0),
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
    attributes: ["id", "title", "status", "message_count", "tool_calls_count", "total_tokens", "createdAt", "updatedAt"],
  });

  return conversations;
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

  return conversation;
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

  await conversation.destroy();
  return { success: true };
}

module.exports = {
  getOrchestration,
  getAvailableTools,
  getConversations,
  getConversation,
  deleteConversation,
};
