const { nanoid } = require("nanoid");
const jwt = require("jsonwebtoken");
const { WebClient } = require("@slack/web-api");
const { fn, col } = require("sequelize");

const db = require("../../../models/models");
const TeamController = require("../../../controllers/TeamController");
const { orchestrate } = require("../../../modules/ai/orchestrator/orchestrator");
const { getToolMilestone } = require("../../../modules/ai/orchestrator/toolMilestones");

const {
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

class SlackController {
  constructor() {
    this.teamController = new TeamController();
    // Track errors that have already been sent to Slack (to avoid duplicates)
    this.sentErrors = new WeakSet();

    // Array of thinking messages to show while processing
    this.thinkingMessages = [
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
  }

  /**
   * Send error messages to Slack
   */
  async sendErrorMessage(error, slackTeamId, slackUserId, channelId, responseUrl) {
    // Check if error was already sent (to avoid duplicates)
    if (this.sentErrors.has(error)) {
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
      this.sentErrors.add(error);
    }

    return errorSent;
  }

  /**
   * Get random thinking message
   */
  getThinkingMessage() {
    return this.thinkingMessages[Math.floor(Math.random() * this.thinkingMessages.length)];
  }

  /**
   * Handle connect command
   */
  async handleConnect(slackTeamId, slackUserId, responseUrl = null) {
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
      const errorSent = await this.sendErrorMessage(
        error, slackTeamId, slackUserId, null, responseUrl
      );
      // Don't re-throw - error has been sent to user, just log it
      if (!errorSent) {
        // eslint-disable-next-line no-console
        console.error("Failed to send error message to Slack");
      }
    }
  }

  /**
   * Get or create a conversation for a Slack thread
   * Each thread has its own conversation history
   */
  async getSlackConversation(integration, threadTs) {
    // Use thread-specific conversations for persistent context
    // Format: slack_conversations: { "thread_ts": "conversation_uuid" }
    const conversationKey = threadTs;
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
        title: `Slack Thread: ${threadTs.substring(0, 10)}...`,
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

  /**
   * Process a question in a Slack thread (shared logic for mentions and button clicks)
   */
  async processQuestionInThread(slackTeamId, slackUserId, channelId, question, threadTs) {
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

      if (!question || question.trim().length === 0) {
        // If no question provided, send helpful message
        const message = {
          text: "Hi! Ask me a question about your data.",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Hi! Ask me a question about your data. For example:\n• How many users do I have?\n• What's my revenue this month?\n• Show me active subscriptions",
              },
            },
          ],
        };
        const client = new WebClient(botToken);
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: message.text,
          blocks: message.blocks,
        });
        return;
      }

      // Send immediate "thinking" message to acknowledge request
      const client = new WebClient(botToken);
      const thinkingResult = await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: this.getThinkingMessage(),
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: this.getThinkingMessage(),
            },
          },
        ],
      });
      if (thinkingResult && thinkingResult.ts) {
        thinkingMessageTs = thinkingResult.ts;
      }

      // Get or create conversation for this thread
      const conversationId = await this.getSlackConversation(integration, threadTs);

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

      // Create progress callback for real-time Slack updates
      const toolProgressCallback = async (toolName, phase) => {
        if (!thinkingMessageTs || !botToken) return;

        try {
          const message = getToolMilestone(toolName, phase);
          await client.chat.update({
            channel: channelId,
            ts: thinkingMessageTs,
            thread_ts: threadTs,
            text: message,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: message,
                },
              },
            ],
          });
        } catch (updateError) {
          // eslint-disable-next-line no-console
          console.error("Failed to update progress message:", updateError);
        }
      };

      // Call orchestrator with conversation history (let agent decide project context)
      const result = await orchestrate(
        integration.team_id,
        question,
        conversationHistory,
        conversation,
        null, // No project context - let agent decide
        { toolProgressCallback }
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

      // Add token usage info as context footer
      if (formattedResponse.blocks) {
        formattedResponse.blocks.push({
          type: "divider",
        });
        formattedResponse.blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `💬 *${totalTokens.toLocaleString()}* credits used in this conversation`,
            },
          ],
        });
      }

      // Update the thinking message with actual response, or post new if update fails
      if (thinkingMessageTs) {
        try {
          await client.chat.update({
            channel: channelId,
            ts: thinkingMessageTs,
            thread_ts: threadTs,
            text: formattedResponse.text,
            blocks: formattedResponse.blocks,
          });
        } catch (updateError) {
          // eslint-disable-next-line no-console
          console.error("Failed to update thinking message, posting new message:", updateError);
          // Fallback: post new message if update fails
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: threadTs,
            text: formattedResponse.text,
            blocks: formattedResponse.blocks,
          });
        }
      } else {
        // No thinking message was posted, post new message
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: formattedResponse.text,
          blocks: formattedResponse.blocks,
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("processQuestionInThread error:", error);
      // eslint-disable-next-line no-console
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        thinkingMessageTs,
        botToken: !!botToken,
        channelId,
        threadTs,
      });
      let finalError = error;
      if (error.message.includes("OpenAI")) {
        finalError = new Error("AI features aren't available. Please configure OpenAI API keys.");
      }

      // If we have a thinking message, update it with the error
      if (thinkingMessageTs && botToken && channelId && threadTs) {
        try {
          const errorMessage = formatError(finalError.message || finalError || "An error occurred");
          const client = new WebClient(botToken);
          await client.chat.update({
            channel: channelId,
            ts: thinkingMessageTs,
            thread_ts: threadTs,
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
      if (botToken && channelId && threadTs) {
        try {
          const errorMessage = formatError(finalError.message || finalError || "An error occurred");
          const client = new WebClient(botToken);
          await client.chat.postMessage({
            channel: channelId,
            thread_ts: threadTs,
            text: errorMessage.text,
            blocks: errorMessage.blocks,
          });
        } catch (postError) {
          // eslint-disable-next-line no-console
          console.error("Failed to send error message to Slack:", postError);
        }
      } else {
        // eslint-disable-next-line no-console
        console.error("Cannot send error message - missing required data:", {
          botToken: !!botToken,
          channelId,
          threadTs,
        });
      }
    }
  }

  /**
   * Handle app_mention event - when user tags @chartbrew
   */
  async handleMention(event) {
    const {
      team: slackTeamId,
      user: slackUserId,
      channel: channelId,
      text: mentionText,
      ts: messageTs,
      thread_ts: existingThreadTs,
    } = event;

    // Determine thread_ts: use existing thread_ts if in a thread,
    // otherwise use message ts to start new thread
    const threadTs = existingThreadTs || messageTs;

    try {
      // Find integration to extract bot mention patterns
      const integration = await db.Integration.findOne({
        where: {
          type: "slack",
          external_id: slackTeamId,
        },
      });

      // Extract question from mention text (remove @chartbrew mention)
      // Slack mentions come as <@BOT_USER_ID> or <@BOT_USER_ID|display_name>
      let question = mentionText || "";

      // Remove bot mention patterns (handle both with and without bot_user_id)
      if (integration && integration.config && integration.config.bot_user_id) {
        const botUserId = integration.config.bot_user_id;
        question = question.replace(new RegExp(`<@${botUserId}[^>]*>`, "gi"), "").trim();
      }

      // Also handle generic @chartbrew mentions and any <@...> pattern
      question = question.replace(/@chartbrew/gi, "").trim();
      question = question.replace(/<@[^>]+>/g, "").trim();

      if (!question || question.length === 0) {
        // If no question provided, send helpful message
        const botToken = integration?.config?.bot_token;
        if (!botToken) {
          throw new Error("Bot token not found.");
        }
        const message = {
          text: "Hi! Ask me a question about your data.",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Hi! Ask me a question about your data. For example:\n• How many users do I have?\n• What's my revenue this month?\n• Show me active subscriptions",
              },
            },
          ],
        };
        const client = new WebClient(botToken);
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: threadTs,
          text: message.text,
          blocks: message.blocks,
        });
        return;
      }

      // Process the question in the thread
      await this.processQuestionInThread(slackTeamId, slackUserId, channelId, question, threadTs);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("handleMention error:", error);
      // Error handling is done in processQuestionInThread
      throw error;
    }
  }

  /**
   * Handle status command
   */
  async handleStatus(slackTeamId, slackUserId, channelId, responseUrl = null) {
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
      const errorSent = await this.sendErrorMessage(
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

  /**
   * Handle help command
   */
  async handleHelp(slackTeamId, slackUserId, channelId, responseUrl = null) { // eslint-disable-line max-len
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
            text: "*Ask Questions:*\n"
              + "Tag @chartbrew in any channel to ask questions about your data. Each thread maintains its own conversation history.\n\n"
              + "*Example:* `@chartbrew how many users do I have?`\n\n"
              + "*Setup Commands:*\n"
              + "• `/chartbrew connect` - Connect this workspace to a Chartbrew team\n"
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
      if (integration && integration.config && integration.config.bot_token) {
        botToken = integration.config.bot_token;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error finding integration:", e);
    }

    // Try response_url first (works even without bot token)
    if (responseUrl) {
      try {
        const result = await postResponseUrl(responseUrl, helpMessage);
        if (result) {
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
        await postMessage(botToken, channelId || slackUserId, helpMessage);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error posting help message via bot token:", e);
      }
    } else {
      // eslint-disable-next-line no-console
      console.error("No bot token or response_url available, cannot send help message");
    }
  }

  /**
   * Handle disconnect command
   */
  async handleDisconnect(slackTeamId, slackUserId, channelId, responseUrl = null) {
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
      const errorSent = await this.sendErrorMessage(
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

  /**
   * Handle OAuth callback - Handle Slack app installation
   */
  async handleOAuthCallback(code) {
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
      // Don't fail the installation if DM fails
    }

    return { success: true };
  }

  /**
   * Handle auth complete - Link Slack workspace to Chartbrew team
   */
  async handleAuthComplete(stateToken, teamId, userId, defaultProjectId, userEmail = null) {
    // Find and verify auth state
    const authState = await db.SlackAuthState.findOne({
      where: { state_token: stateToken },
    });

    if (!authState) {
      throw new Error("Invalid or expired state token");
    }

    if (new Date(authState.expires_at) < new Date()) {
      await authState.destroy();
      throw new Error("State token has expired");
    }

    // Verify user has teamOwner or teamAdmin role
    const teamRole = await this.teamController.getTeamRole(teamId, userId);
    if (!teamRole || !["teamOwner", "teamAdmin"].includes(teamRole.role)) {
      throw new Error("Only team owners and admins can connect Slack");
    }

    // Find the integration
    const integration = await db.Integration.findOne({
      where: {
        type: "slack",
        external_id: authState.external_workspace_id,
      },
    });

    if (!integration) {
      throw new Error("Slack integration not found");
    }

    // Create API key for the team
    const apiKeyToken = jwt.sign(
      {
        id: userId,
        email: userEmail,
      },
      settings.encryptionKey,
      { expiresIn: "9999 years" }
    );

    const apikey = await db.Apikey.create({
      name: `Slack Integration - ${integration.config.slack_team_name}`,
      team_id: teamId,
      token: apiKeyToken,
    });

    // Update integration config
    const updatedConfig = {
      ...integration.config,
    };
    if (defaultProjectId) {
      updatedConfig.default_project_id = defaultProjectId;
    }

    // Update integration
    await integration.update({
      team_id: teamId,
      apikey_id: apikey.id,
      config: updatedConfig,
    });

    // Get team name
    const team = await db.Team.findByPk(teamId);

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
              text: "You can now tag @chartbrew in any channel to ask questions about your data!",
            },
          },
        ],
      }
    );

    // Delete used auth state
    await authState.destroy();

    return {
      success: true,
      team_name: team.name,
      workspace_name: integration.config.slack_team_name,
    };
  }

  /**
   * Handle interactions - Handle button clicks and modal submissions
   */
  async handleInteraction(interaction) {
    const {
      type, user, team, channel, actions, view, message
    } = interaction;

    // Handle button clicks (quick replies)
    if (type === "block_actions" && actions && actions.length > 0) {
      const action = actions[0];

      // Get thread_ts from the message that contains the button
      // If message is in a thread, use thread_ts; otherwise use message ts to continue thread
      const threadTs = message?.thread_ts || message?.ts;

      if (!threadTs) {
        // eslint-disable-next-line no-console
        console.error("Cannot determine thread_ts from interaction message");
        return;
      }

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
          return;
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
                thread_ts: threadTs,
              }),
            },
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to open modal:", error);
        }
        return;
      }

      // Handle regular quick reply buttons - treat as if user typed the text
      if (action.action_id.startsWith("quick_reply_")) {
        const questionText = action.value;

        // Process the question in the same thread
        await this.processQuestionInThread(team.id, user.id, channel.id, questionText, threadTs);
        return;
      }
    }

    // Handle modal submission
    if (type === "view_submission" && view.callback_id === "custom_query_modal") {
      const metadata = JSON.parse(view.private_metadata);
      const queryText = view.state.values.query_input.query_text.value;

      if (queryText && queryText.trim() && metadata.thread_ts) {
        // Process the custom query in the thread
        await this.processQuestionInThread(
          team.id,
          metadata.user_id,
          metadata.channel_id,
          queryText.trim(),
          metadata.thread_ts
        );
      }
    }
  }
}

module.exports = SlackController;
