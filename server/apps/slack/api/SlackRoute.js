const { nanoid } = require("nanoid");
const jwt = require("jsonwebtoken");
const { WebClient } = require("@slack/web-api");
const { fn, col } = require("sequelize");

const db = require("../../../models/models");
const TeamController = require("../../../controllers/TeamController");
const { orchestrate } = require("../../../modules/ai/orchestrator/orchestrator");
const verifyToken = require("../../../modules/verifyToken");

const {
  verifySignature,
  exchangeCodeForToken,
  sendDM,
  postMessage,
  postResponseUrl,
  isWorkspaceAdmin,
} = require("../utils/slackClient");
const { formatResponse, formatError } = require("../utils/formatResponse");

const settings = process.env.NODE_ENV === "production"
  ? require("../../../settings")
  : require("../../../settings-dev"); // eslint-disable-line
const clientUrl = process.env.NODE_ENV === "production"
  ? process.env.VITE_APP_CLIENT_HOST
  : process.env.VITE_APP_CLIENT_HOST_DEV;

module.exports = (app) => {
  const teamController = new TeamController();

  // Track errors that have already been sent to Slack (to avoid duplicates)
  const sentErrors = new WeakSet();

  // Middleware to verify Slack signature (with lenient mode for interactive payloads)
  const verifySlackSignature = (req, res, next) => {
    if (!verifySignature(req)) {
      return res.status(401).json({ error: "Invalid Slack signature" });
    }
    return next();
  };

  // Helper function to send error messages
  async function sendErrorMessage(error, slackTeamId, slackUserId, channelId, responseUrl) {
    // Check if error was already sent (to avoid duplicates)
    if (sentErrors.has(error)) {
      return true;
    }

    const errorMessage = formatError(error.message || error || "An error occurred");
    let errorSent = false;

    // Try response_url first
    if (responseUrl) {
      try {
        const result = await postResponseUrl(responseUrl, errorMessage);
        if (result) {
          errorSent = true;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error posting via response_url:", e);
      }
    }

    // Fallback to bot token
    if (!errorSent) {
      try {
        const integration = await db.Integration.findOne({
          where: {
            type: "slack",
            external_id: slackTeamId,
          },
        });
        if (integration && integration.config && integration.config.bot_token) {
          await postMessage(integration.config.bot_token, channelId || slackUserId, errorMessage);
          errorSent = true;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error sending error message:", e);
      }
    }

    // Mark error as sent to prevent duplicate sending
    if (errorSent) {
      sentErrors.add(error);
    }

    return errorSent;
  }

  // Helper functions
  async function handleConnect(slackTeamId, slackUserId, responseUrl = null) {
    try {
      // Find integration
      const integration = await db.Integration.findOne({
        where: {
          type: "slack",
          external_id: slackTeamId,
        },
      });

      if (!integration) {
        throw new Error(
          "Chartbrew app is not installed in this workspace. "
          + "Please install the Chartbrew app from the Slack App Directory first, "
          + "then run `/chartbrew connect` again."
        );
      }

      // Check if user is installer or admin
      const botToken = integration.config.bot_token;
      const isAdmin = await isWorkspaceAdmin(botToken, slackUserId);
      const isInstaller = integration.config.installer_slack_user_id === slackUserId;

      if (!isAdmin && !isInstaller) {
        throw new Error("Only workspace admins can connect to Chartbrew.");
      }

      // Generate state token
      const stateToken = nanoid(32);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await db.SlackAuthState.create({
        state_token: stateToken,
        integration_type: "slack",
        external_workspace_id: slackTeamId,
        external_user_id: slackUserId,
        expires_at: expiresAt,
      });

      // Build magic link
      const magicLink = `${clientUrl}/integrations/auth/slack?state=${stateToken}`;

      // Send DM with magic link
      await sendDM(
        botToken,
        slackUserId,
        {
          text: "Connect this Slack workspace to your Chartbrew team",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "🔗 Connect this Slack workspace to your Chartbrew team:",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `<${magicLink}|Click here to connect>`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "_This link expires in 15 minutes._",
                },
              ],
            },
          ],
        }
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("handleConnect error:", error);
      const errorSent = await sendErrorMessage(error, slackTeamId, slackUserId, null, responseUrl);
      // Don't re-throw - error has been sent to user, just log it
      if (!errorSent) {
        // eslint-disable-next-line no-console
        console.error("Failed to send error message to Slack");
      }
    }
  }

  /**
   * Get or create a conversation for a Slack channel
   */
  async function getSlackConversation(integration, channelId, slackUserId) {
    // Use channel-specific conversations for persistent context
    // Format: slack_conversations: { "channel_id": "conversation_uuid" }
    const conversationKey = channelId || slackUserId;
    const slackConversations = integration.config.slack_conversations || {};

    let conversationId = slackConversations[conversationKey];

    // Verify conversation exists and is active
    if (conversationId) {
      const conversation = await db.AiConversation.findByPk(conversationId);
      if (!conversation || conversation.team_id !== integration.team_id) {
        // Conversation was deleted or doesn't belong to team - create new one
        conversationId = null;
      }
    }

    // Create new conversation if needed
    if (!conversationId) {
      // Find a Chartbrew user from this team to own the conversation
      // Prefer team owner/admin
      const teamRole = await db.TeamRole.findOne({
        where: {
          team_id: integration.team_id,
          role: ["teamOwner", "teamAdmin"],
        },
        order: [
          ["role", "ASC"], // teamOwner comes before teamAdmin alphabetically
        ],
      });

      let chartbrewUserId = 1; // fallback to default
      if (teamRole) {
        chartbrewUserId = teamRole.user_id;
      } else {
        // If no owner/admin found, find any user from the team
        const anyTeamRole = await db.TeamRole.findOne({
          where: { team_id: integration.team_id },
        });
        if (anyTeamRole) {
          chartbrewUserId = anyTeamRole.user_id;
        }
      }

      const conversation = await db.AiConversation.create({
        team_id: integration.team_id,
        user_id: chartbrewUserId,
        title: `Slack: ${conversationKey}`,
        status: "active",
      });
      conversationId = conversation.id;

      // Save conversation ID to integration config
      slackConversations[conversationKey] = conversationId;
      await integration.update({
        config: {
          ...integration.config,
          slack_conversations: slackConversations,
        },
      });
    }

    return conversationId;
  }

  // Array of thinking messages to show while processing
  const thinkingMessages = [
    "🤔 Thinking...",
    "🔍 Looking into that right now...",
    "⚡ Processing your request...",
    "🧠 Working on it...",
    "📊 Analyzing the data...",
    "🔎 Checking that for you...",
    "💭 Let me think about that...",
    "🚀 On it...",
    "⏳ Just a moment...",
    "🎯 Fetching the information...",
  ];

  // Get random thinking message
  function getThinkingMessage() {
    return thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)];
  }

  async function handleAsk(slackTeamId, slackUserId, channelId, question, responseUrl = null) {
    let thinkingMessageTs = null;
    let botToken = null;

    try {
      // Find integration first to get bot token
      const integration = await db.Integration.findOne({
        where: {
          type: "slack",
          external_id: slackTeamId,
        },
      });

      if (!question || question.trim().length === 0) {
        const message = {
          text: "Please provide a question. Usage: `/chartbrew ask <your question>`",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Please provide a question.\n\n*Usage:* `/chartbrew ask <your question>`",
              },
            },
          ],
        };
        if (responseUrl) {
          await postResponseUrl(responseUrl, message);
        } else if (integration && integration.config && integration.config.bot_token) {
          await postMessage(integration.config.bot_token, channelId || slackUserId, message);
        }
        return;
      }

      if (!integration) {
        throw new Error("This workspace isn't connected to Chartbrew. Use `/chartbrew connect` to get started.");
      }

      if (!integration.team_id || !integration.apikey_id) {
        throw new Error("This workspace isn't connected to a Chartbrew team. Use `/chartbrew connect` to get started.");
      }

      // Get bot token
      botToken = integration.config.bot_token;
      if (!botToken) {
        throw new Error("Bot token not found. Please reinstall the Chartbrew Slack app.");
      }

      // Send immediate "thinking" message to acknowledge request
      const thinkingResult = await postMessage(
        botToken,
        channelId || slackUserId,
        {
          text: getThinkingMessage(),
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: getThinkingMessage(),
              },
            },
          ],
        }
      );
      if (thinkingResult && thinkingResult.ts) {
        thinkingMessageTs = thinkingResult.ts;
      }

      // Parse project context if specified: "ask in [project] <question>"
      let projectContext = null;
      let finalQuestion = question;
      const projectMatch = question.match(/^in\s+([^\s]+)\s+(.+)$/i);
      if (projectMatch) {
        const [, projectName, questionText] = projectMatch;
        finalQuestion = questionText;
        // Find project by name
        const project = await db.Project.findOne({
          where: {
            team_id: integration.team_id,
            name: projectName,
          },
        });
        if (project) {
          projectContext = [{ label: project.name, value: project.id }];
        }
      } else if (integration.config.default_project_id) {
        // Use default project if no project specified
        const project = await db.Project.findByPk(integration.config.default_project_id);
        if (project) {
          projectContext = [{ label: project.name, value: project.id }];
        }
      }

      // Get or create conversation for this Slack channel
      const conversationId = await getSlackConversation(integration, channelId, slackUserId);

      // Load conversation and history
      const conversation = await db.AiConversation.findByPk(conversationId);
      const messages = await db.AiMessage.findAll({
        where: { conversation_id: conversationId },
        order: [["sequence", "ASC"]],
      });

      // Rebuild conversation history
      const conversationHistory = messages.map((msg) => {
        const messageObj = {
          role: msg.role,
          content: msg.content,
        };
        if (msg.tool_calls) messageObj.tool_calls = msg.tool_calls;
        if (msg.tool_name) messageObj.name = msg.tool_name;
        if (msg.tool_call_id) messageObj.tool_call_id = msg.tool_call_id;
        return messageObj;
      });

      // Call orchestrator with conversation history
      const result = await orchestrate(
        integration.team_id,
        finalQuestion,
        conversationHistory,
        conversation,
        projectContext
      );

      // Save new messages to database
      const existingMessageCount = messages.length;
      const newMessages = result.conversationHistory.slice(existingMessageCount);

      const messagePromises = newMessages.map((msg, index) => {
        const messageData = {
          conversation_id: conversationId,
          role: msg.role,
          content: msg.content,
          sequence: existingMessageCount + index,
        };
        if (msg.tool_calls) messageData.tool_calls = msg.tool_calls;
        if (msg.role === "tool") {
          messageData.tool_name = msg.name;
          messageData.tool_call_id = msg.tool_call_id;
          const resultStr = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          messageData.tool_result_preview = resultStr.substring(0, 500);
        }
        return db.AiMessage.create(messageData);
      });

      await Promise.all(messagePromises);

      // Save usage records
      const usagePromises = (result.usageRecords || []).map((usage) => db.AiUsage.create({
        conversation_id: conversationId,
        team_id: integration.team_id,
        model: usage.model,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        elapsed_ms: usage.elapsed_ms,
        cost_micros: 0,
      }));

      await Promise.all(usagePromises);

      // Update conversation metadata
      await conversation.update({
        message_count: result.conversationHistory.filter((msg) => msg.role === "user").length,
        status: "active",
        error_message: null,
      });

      // Get total token usage for this conversation
      const usageStats = await db.AiUsage.findAll({
        where: { conversation_id: conversationId },
        attributes: [
          [fn("SUM", col("total_tokens")), "total_tokens"],
        ],
        raw: true,
      });
      const totalTokens = parseInt(usageStats[0]?.total_tokens, 10) || 0;

      // Format response for Slack using Block Kit
      const formattedResponse = formatResponse(result.message, result.snapshots);

      // Add token usage and reset info as context footer
      if (formattedResponse.blocks) {
        formattedResponse.blocks.push({
          type: "divider",
        });
        formattedResponse.blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `💬 *${totalTokens.toLocaleString()}* tokens used in this conversation · Continue conversation with \`/chartbrew ask\` · Use \`/chartbrew reset\` to start fresh`,
            },
          ],
        });
      }

      // Update the thinking message with actual response, or post new if update fails
      if (thinkingMessageTs) {
        try {
          const client = new WebClient(botToken);
          await client.chat.update({
            channel: channelId || slackUserId,
            ts: thinkingMessageTs,
            text: formattedResponse.text,
            blocks: formattedResponse.blocks,
          });
        } catch (updateError) {
          // eslint-disable-next-line no-console
          console.error("Failed to update thinking message, posting new message:", updateError);
          // Fallback: post new message if update fails
          const postResult = await postMessage(
            botToken,
            channelId || slackUserId,
            formattedResponse
          );
          if (!postResult) {
            throw new Error("Failed to post message to Slack");
          }
        }
      } else {
        // No thinking message was posted, post new message
        const postResult = await postMessage(botToken, channelId || slackUserId, formattedResponse);
        if (!postResult) {
          throw new Error("Failed to post message to Slack");
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("handleAsk error:", error);
      let finalError = error;
      if (error.message.includes("OpenAI")) {
        finalError = new Error("AI features aren't available. Please configure OpenAI API keys.");
      }

      // If we have a thinking message, update it with the error
      if (thinkingMessageTs && botToken) {
        try {
          const errorMessage = formatError(finalError.message || finalError || "An error occurred");
          const client = new WebClient(botToken);
          await client.chat.update({
            channel: channelId || slackUserId,
            ts: thinkingMessageTs,
            text: errorMessage.text,
            blocks: errorMessage.blocks,
          });
          return; // Error displayed, don't send duplicate
        } catch (updateError) {
          // eslint-disable-next-line no-console
          console.error("Failed to update thinking message with error:", updateError);
          // Fall through to send error message normally
        }
      }

      // Fallback: send error message if we couldn't update thinking message
      const errorSent = await sendErrorMessage(
        finalError,
        slackTeamId,
        slackUserId,
        channelId,
        responseUrl
      );
      // Don't re-throw - error has been sent to user, just log it
      if (!errorSent) {
        // eslint-disable-next-line no-console
        console.error("Failed to send error message to Slack");
      }
    }
  }

  async function handleStatus(slackTeamId, slackUserId, channelId, responseUrl = null) {
    try {
      const integration = await db.Integration.findOne({
        where: {
          type: "slack",
          external_id: slackTeamId,
        },
      });

      if (!integration) {
        throw new Error("This workspace isn't connected to Chartbrew. Use `/chartbrew connect` to get started.");
      }

      const botToken = integration.config.bot_token;
      if (!botToken) {
        throw new Error("Bot token not found. Please reinstall the Chartbrew Slack app.");
      }

      const blocks = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Chartbrew Integration Status",
          },
        },
      ];

      if (integration.team_id && integration.apikey_id) {
        const team = await db.Team.findByPk(integration.team_id);
        let statusText = `✅ Connected to team: *${team.name}*`;

        if (integration.config.default_project_id) {
          const project = await db.Project.findByPk(integration.config.default_project_id);
          if (project) {
            statusText += `\n📊 Default dashboard: *${project.name}*`;
          }
        }

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: statusText,
          },
        });
      } else {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: "❌ Not connected to a Chartbrew team\nUse `/chartbrew connect` to get started",
          },
        });
      }

      const statusMessage = {
        text: "Chartbrew Integration Status",
        blocks,
      };

      // Try response_url first, fallback to bot token
      let result = null;
      if (responseUrl) {
        result = await postResponseUrl(responseUrl, statusMessage);
      }
      if (!result && botToken) {
        result = await postMessage(botToken, channelId || slackUserId, statusMessage);
      }
      if (!result) {
        throw new Error("Failed to post status message");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("handleStatus error:", error);
      const errorSent = await sendErrorMessage(
        error,
        slackTeamId,
        slackUserId,
        channelId,
        responseUrl
      );
      // Don't re-throw - error has been sent to user, just log it
      if (!errorSent) {
        // eslint-disable-next-line no-console
        console.error("Failed to send error message to Slack");
      }
    }
  }

  async function handleReset(slackTeamId, slackUserId, channelId, responseUrl = null) {
    try {
      const integration = await db.Integration.findOne({
        where: {
          type: "slack",
          external_id: slackTeamId,
        },
      });

      if (!integration) {
        throw new Error("This workspace isn't connected to Chartbrew.");
      }

      const botToken = integration.config.bot_token;
      if (!botToken) {
        throw new Error("Bot token not found.");
      }

      // Clear conversation for this channel
      const conversationKey = channelId || slackUserId;
      const slackConversations = integration.config.slack_conversations || {};

      if (slackConversations[conversationKey]) {
        delete slackConversations[conversationKey];
        await integration.update({
          config: {
            ...integration.config,
            slack_conversations: slackConversations,
          },
        });
      }

      const message = {
        text: "Conversation reset successfully",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "✅ Conversation history cleared! Your next question will start a fresh conversation.",
            },
          },
        ],
      };

      let result = null;
      if (responseUrl) {
        result = await postResponseUrl(responseUrl, message);
      }
      if (!result && botToken) {
        result = await postMessage(botToken, channelId || slackUserId, message);
      }
      if (!result) {
        throw new Error("Failed to post reset message");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("handleReset error:", error);
      const errorSent = await sendErrorMessage(
        error,
        slackTeamId,
        slackUserId,
        channelId,
        responseUrl
      );
      if (!errorSent) {
        // eslint-disable-next-line no-console
        console.error("Failed to send error message to Slack");
      }
    }
  }

  async function handleHelp(slackTeamId, slackUserId, channelId, responseUrl = null) { // eslint-disable-line max-len
    // eslint-disable-next-line no-console
    console.log("handleHelp called with:", {
      slackTeamId, slackUserId, channelId, responseUrl,
    });

    const helpMessage = {
      text: "Chartbrew Slack Commands",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Chartbrew Slack Commands",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "• `/chartbrew connect` - Connect this workspace to a Chartbrew team\n"
              + "• `/chartbrew ask <question>` - Ask a question about your data\n"
              + "• `/chartbrew ask in [dashboard] <question>` - Ask a question in a specific dashboard context\n"
              + "• `/chartbrew reset` - Clear conversation history and start fresh\n"
              + "• `/chartbrew status` - Check connection status\n"
              + "• `/chartbrew disconnect` - Disconnect from Chartbrew team\n"
              + "• `/chartbrew help` - Show this help message",
          },
        },
      ],
    };

    // Try to get bot token
    let botToken = null;
    try {
      const integration = await db.Integration.findOne({
        where: {
          type: "slack",
          external_id: slackTeamId,
        },
      });
      // eslint-disable-next-line no-console
      console.log("Integration found:", integration ? "yes" : "no");
      if (integration && integration.config && integration.config.bot_token) {
        botToken = integration.config.bot_token;
        // eslint-disable-next-line no-console
        console.log("Bot token found:", botToken ? "yes" : "no");
      } else {
        // eslint-disable-next-line no-console
        console.log("Integration config:", integration ? JSON.stringify(integration.config) : "null");
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error finding integration:", e);
    }

    // Try response_url first (works even without bot token)
    if (responseUrl) {
      try {
        // eslint-disable-next-line no-console
        console.log("Attempting to post via response_url");
        const result = await postResponseUrl(responseUrl, helpMessage);
        if (result) {
          // eslint-disable-next-line no-console
          console.log("Help message posted via response_url: success");
          return;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error posting via response_url:", e);
      }
    }

    // Fallback to bot token if available
    if (botToken) {
      try {
        const result = await postMessage(botToken, channelId || slackUserId, helpMessage);
        // eslint-disable-next-line no-console
        console.log("Help message posted via bot token result:", result ? "success" : "failed");
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error posting help message via bot token:", e);
      }
    } else {
      // eslint-disable-next-line no-console
      console.error("No bot token or response_url available, cannot send help message");
    }
  }

  async function handleDisconnect(slackTeamId, slackUserId, channelId, responseUrl = null) {
    try {
      const integration = await db.Integration.findOne({
        where: {
          type: "slack",
          external_id: slackTeamId,
        },
      });

      if (!integration) {
        throw new Error("This workspace isn't connected to Chartbrew.");
      }

      // Check if user is admin
      const botToken = integration.config.bot_token;
      if (!botToken) {
        throw new Error("Bot token not found. Please reinstall the Chartbrew Slack app.");
      }

      const isAdmin = await isWorkspaceAdmin(botToken, slackUserId);

      if (!isAdmin) {
        const message = {
          text: "Only workspace admins can disconnect.",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "❌ Only workspace admins can disconnect.",
              },
            },
          ],
        };
        if (responseUrl) {
          await postResponseUrl(responseUrl, message);
        } else {
          await postMessage(botToken, channelId || slackUserId, message);
        }
        return;
      }

      if (!integration.team_id || !integration.apikey_id) {
        const message = {
          text: "Not connected to a Chartbrew team.",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "❌ Not connected to a Chartbrew team.",
              },
            },
          ],
        };
        if (responseUrl) {
          await postResponseUrl(responseUrl, message);
        } else {
          await postMessage(botToken, channelId || slackUserId, message);
        }
        return;
      }

      // Disconnect (set team_id and apikey_id to null)
      await integration.update({
        team_id: null,
        apikey_id: null,
      });

      const successMessage = {
        text: "Disconnected from Chartbrew team. Use `/chartbrew connect` to reconnect.",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "✅ Disconnected from Chartbrew team. Use `/chartbrew connect` to reconnect.",
            },
          },
        ],
      };
      let result = null;
      if (responseUrl) {
        result = await postResponseUrl(responseUrl, successMessage);
      }
      if (!result) {
        result = await postMessage(botToken, channelId || slackUserId, successMessage);
      }
      if (!result) {
        throw new Error("Failed to post disconnect message");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("handleDisconnect error:", error);
      const errorSent = await sendErrorMessage(
        error,
        slackTeamId,
        slackUserId,
        channelId,
        responseUrl
      );
      // Don't re-throw - error has been sent to user, just log it
      if (!errorSent) {
        // eslint-disable-next-line no-console
        console.error("Failed to send error message to Slack");
      }
    }
  }

  /*
  ** Commands API
  */
  app.post("/apps/slack/commands", verifySlackSignature, async (req, res) => {
    // eslint-disable-next-line no-console
    console.log("Slack command received:", req.body);

    const {
      command, text, team_id, user_id, channel_id, response_url,
    } = req.body;

    // Slack requires immediate response (within 3 seconds)
    res.status(200).send();

    if (command === "/chartbrew") {
      const parts = text ? text.trim().split(/\s+/) : [];
      const subcommand = parts[0] || "";

      try {
        switch (subcommand) {
          case "connect": {
            await handleConnect(team_id, user_id, response_url);
            break;
          }

          case "ask": {
            const question = parts.slice(1).join(" ");
            await handleAsk(team_id, user_id, channel_id, question, response_url);
            break;
          }

          case "status": {
            await handleStatus(team_id, user_id, channel_id, response_url);
            break;
          }

          case "reset": {
            await handleReset(team_id, user_id, channel_id, response_url);
            break;
          }

          case "help": {
            await handleHelp(team_id, user_id, channel_id, response_url);
            break;
          }

          case "disconnect": {
            await handleDisconnect(team_id, user_id, channel_id, response_url);
            break;
          }

          default: {
            await handleHelp(team_id, user_id, channel_id, response_url);
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Slack command error:", error);
        // eslint-disable-next-line no-console
        console.error("Error stack:", error.stack);

        // Only send error if it wasn't already sent by the handler
        if (!sentErrors.has(error)) {
          await sendErrorMessage(error, team_id, user_id, channel_id, response_url);
        }
      }
    }
  });
  // --------------------------------------

  /*
  ** OAuth Callback - Handle Slack app installation
  * Slack redirects here via GET with query parameters after user authorizes
  */
  app.get("/apps/slack/oauth/callback", async (req, res) => {
    const { code, error } = req.query;

    // Handle OAuth errors from Slack
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Slack OAuth error:", error);
      return res.status(400).send(`
        <html>
          <head><title>Slack Installation Failed</title></head>
          <body>
            <h1>Installation Failed</h1>
            <p>Error: ${error}</p>
            <p>Please try installing the app again from Slack.</p>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send(`
        <html>
          <head><title>Slack Installation Failed</title></head>
          <body>
            <h1>Installation Failed</h1>
            <p>Missing authorization code. Please try installing the app again from Slack.</p>
          </body>
        </html>
      `);
    }

    try {
      const tokenData = await exchangeCodeForToken(code);

      // Find or create Integration
      const [integration, created] = await db.Integration.findOrCreate({
        where: {
          type: "slack",
          external_id: tokenData.team_id,
        },
        defaults: {
          name: `Slack - ${tokenData.team_name}`,
          team_id: null,
          apikey_id: null,
          config: {
            slack_team_id: tokenData.team_id,
            slack_team_name: tokenData.team_name,
            bot_user_id: tokenData.bot_user_id,
            bot_token: tokenData.bot_token,
            installer_slack_user_id: tokenData.installer_user_id,
          },
        },
      });

      // Update if already exists
      if (!created) {
        await integration.update({
          name: `Slack - ${tokenData.team_name}`,
          config: {
            ...integration.config,
            slack_team_id: tokenData.team_id,
            slack_team_name: tokenData.team_name,
            bot_user_id: tokenData.bot_user_id,
            bot_token: tokenData.bot_token,
            installer_slack_user_id: tokenData.installer_user_id,
          },
        });
      }

      // Send welcome DM
      try {
        await sendDM(
          tokenData.bot_token,
          tokenData.installer_user_id,
          {
            text: "Chartbrew has been installed in your workspace!",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "🎉 *Chartbrew has been installed in your workspace!*",
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "To connect this workspace to a Chartbrew team, use the command:\n`/chartbrew connect`",
                },
              },
            ],
          }
        );
      } catch (dmError) {
        // eslint-disable-next-line no-console
        console.error("Failed to send welcome DM:", dmError);
        // Don't fail the installation if DM fails
      }

      // Return success page (Slack redirects the browser here)
      return res.status(200).send(`
        <html>
          <head><title>Chartbrew Installed</title></head>
          <body>
            <h1>✅ Chartbrew has been installed!</h1>
            <p>The app has been successfully installed in your Slack workspace: <strong>${tokenData.team_name}</strong></p>
            <p>You can close this window and return to Slack.</p>
            <p>To connect this workspace to a Chartbrew team, use the command in Slack:</p>
            <p><code>/chartbrew connect</code></p>
          </body>
        </html>
      `);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("OAuth callback error:", error);
      return res.status(500).send(`
        <html>
          <head><title>Installation Error</title></head>
          <body>
            <h1>Installation Error</h1>
            <p>An error occurred during installation: ${error.message}</p>
            <p>Please try installing the app again from Slack.</p>
          </body>
        </html>
      `);
    }
  });
  // --------------------------------------

  /*
  ** Auth Complete - Link Slack workspace to Chartbrew team
  */
  app.post("/apps/slack/auth/complete", verifyToken, async (req, res) => {
    const { state_token, team_id, default_project_id } = req.body;

    if (!state_token || !team_id) {
      return res.status(400).json({ error: "state_token and team_id are required" });
    }

    try {
      // Find and verify auth state
      const authState = await db.SlackAuthState.findOne({
        where: { state_token },
      });

      if (!authState) {
        return res.status(400).json({ error: "Invalid or expired state token" });
      }

      if (new Date(authState.expires_at) < new Date()) {
        await authState.destroy();
        return res.status(400).json({ error: "State token has expired" });
      }

      // Verify user has teamOwner or teamAdmin role
      const teamRole = await teamController.getTeamRole(team_id, req.user.id);
      if (!teamRole || !["teamOwner", "teamAdmin"].includes(teamRole.role)) {
        return res.status(403).json({ error: "Only team owners and admins can connect Slack" });
      }

      // Find the integration
      const integration = await db.Integration.findOne({
        where: {
          type: "slack",
          external_id: authState.external_workspace_id,
        },
      });

      if (!integration) {
        return res.status(404).json({ error: "Slack integration not found" });
      }

      // Create API key for the team
      const apiKeyToken = jwt.sign(
        {
          id: req.user.id,
          email: req.user.email,
        },
        settings.encryptionKey,
        { expiresIn: "9999 years" }
      );

      const apikey = await db.Apikey.create({
        name: `Slack Integration - ${integration.config.slack_team_name}`,
        team_id,
        token: apiKeyToken,
      });

      // Update integration config
      const updatedConfig = {
        ...integration.config,
      };
      if (default_project_id) {
        updatedConfig.default_project_id = default_project_id;
      }

      // Update integration
      await integration.update({
        team_id,
        apikey_id: apikey.id,
        config: updatedConfig,
      });

      // Get team name
      const team = await db.Team.findByPk(team_id);

      // Send success DM
      await sendDM(
        integration.config.bot_token,
        authState.external_user_id,
        {
          text: `Successfully connected to Chartbrew team: ${team.name}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `✅ *Successfully connected to Chartbrew team: ${team.name}*`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "You can now use `/chartbrew ask <question>` to query your data!",
              },
            },
          ],
        }
      );

      // Delete used auth state
      await authState.destroy();

      return res.status(200).json({
        success: true,
        team_name: team.name,
        workspace_name: integration.config.slack_team_name,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
  // --------------------------------------

  app.get("/apps/slack/oauth/start", (req, res) => {
    const params = new URLSearchParams({
      client_id: process.env.CB_SLACK_CLIENT_ID,
      scope: "commands,chat:write,chat:write.public,im:write,users:read",
      redirect_uri: process.env.NODE_ENV === "production" ? `${process.env.VITE_APP_CLIENT_HOST}/apps/slack/oauth/callback` : `${process.env.CB_SLACK_REDIRECT_HOST_DEV}/apps/slack/oauth/callback`,
      state: `dev_${Date.now()}`,
    });

    res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
  });

  /*
  ** Interactivity API - Handle button clicks and modal submissions
  */
  app.post("/apps/slack/interactions", verifySlackSignature, async (req, res) => {
    const { payload } = req.body;

    if (!payload) {
      return res.status(200).send({ message: "No payload" });
    }

    try {
      const interaction = JSON.parse(payload);
      const {
        type, user, team, channel, actions, view
      } = interaction;

      // eslint-disable-next-line no-console
      console.log("Slack interaction received:", {
        type, user: user.id, team: team.id
      });

      // Handle button clicks (quick replies)
      if (type === "block_actions" && actions && actions.length > 0) {
        const action = actions[0];

        // Acknowledge immediately
        res.status(200).send();

        // Handle "Something else" button - open modal
        if (action.action_id === "quick_reply_something_else") {
          const integration = await db.Integration.findOne({
            where: {
              type: "slack",
              external_id: team.id,
            },
          });

          if (!integration || !integration.config || !integration.config.bot_token) {
            // eslint-disable-next-line no-console
            console.error("Bot token not found for modal");
            return undefined;
          }

          // Open modal for free text input
          const client = new WebClient(integration.config.bot_token);

          try {
            await client.views.open({
              trigger_id: interaction.trigger_id,
              view: {
                type: "modal",
                callback_id: "custom_query_modal",
                title: {
                  type: "plain_text",
                  text: "Custom Query",
                },
                submit: {
                  type: "plain_text",
                  text: "Submit",
                },
                close: {
                  type: "plain_text",
                  text: "Cancel",
                },
                blocks: [
                  {
                    type: "input",
                    block_id: "query_input",
                    element: {
                      type: "plain_text_input",
                      action_id: "query_text",
                      placeholder: {
                        type: "plain_text",
                        text: "What would you like to query?",
                      },
                      multiline: true,
                    },
                    label: {
                      type: "plain_text",
                      text: "What should I query instead?",
                    },
                  },
                ],
                private_metadata: JSON.stringify({
                  channel_id: channel.id,
                  user_id: user.id,
                }),
              },
            });
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("Failed to open modal:", error);
          }
          return undefined;
        }

        // Handle regular quick reply buttons - treat as if user typed the text
        if (action.action_id.startsWith("quick_reply_")) {
          const questionText = action.value;

          // Call handleAsk with the selected option
          await handleAsk(team.id, user.id, channel.id, questionText, null);
          return undefined;
        }
      }

      // Handle modal submission
      if (type === "view_submission" && view.callback_id === "custom_query_modal") {
        // Acknowledge immediately
        res.status(200).send();

        const metadata = JSON.parse(view.private_metadata);
        const queryText = view.state.values.query_input.query_text.value;

        if (queryText && queryText.trim()) {
          // Call handleAsk with the custom query
          await handleAsk(team.id, metadata.user_id, metadata.channel_id, queryText.trim(), null);
        }
        return undefined;
      }

      // Default response for unhandled interactions
      return res.status(200).send();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Interaction handling error:", error);
      return res.status(200).send(); // Always acknowledge to Slack
    }
  });
  // --------------------------------------

  /*
  ** Events API
  */
  app.post("/apps/slack/events", (req, res) => {
    const { challenge } = req.body;
    if (challenge) {
      return res.status(200).send({ challenge });
    }
    return res.status(200).send({ message: "Event received" });
  });
  // --------------------------------------

  return (req, res, next) => {
    next();
  };
};
