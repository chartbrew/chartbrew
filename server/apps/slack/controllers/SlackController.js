const { getMemberAccess } = require("../../../modules/observations/access");
const { nanoid } = require("nanoid");

const db = require("../../../models/models");
const TeamController = require("../../../controllers/TeamController");
const { invalidateIntegration, LINK_INSTRUCTIONS } = require("../accounts");

const {
  exchangeCodeForToken,
  sendDM,
  postMessage,
  postResponseUrl,
  isWorkspaceAdmin,
  getChannels,
} = require("../utils/slackClient");
const { formatError } = require("../utils/formatResponse");

const clientUrl = process.env.VITE_APP_CLIENT_HOST;

class SlackController {
  constructor() {
    this.teamController = new TeamController();
    // Track errors that have already been sent to Slack (to avoid duplicates)
    this.sentErrors = new WeakSet();
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
        // oxlint-disable-next-line no-console
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
        // oxlint-disable-next-line no-console
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
      // oxlint-disable-next-line no-console
      console.error("handleConnect error:", error);
      const errorSent = await this.sendErrorMessage(
        error, slackTeamId, slackUserId, null, responseUrl
      );
      // Don't re-throw - error has been sent to user, just log it
      if (!errorSent) {
        // oxlint-disable-next-line no-console
        console.error("Failed to send error message to Slack");
      }
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

      if (!integration.team_id) {
        await sendDM(integration?.config?.bot_token, slackUserId, "This workspace isn't connected to Chartbrew. Use `/chartbrew connect` to get started.");
        return;
      }

      // Get bot token
      const botToken = integration.config.bot_token;
      if (!botToken) {
        await sendDM(integration.config.bot_token, slackUserId, "Bot token not found. Please reinstall the Chartbrew Slack app.");
        return;
      }

      const account = await db.SlackAccount.findOne({ where: {
        integration_id: integration.id, slack_user_id: slackUserId, team_id: integration.team_id,
      } });
      await sendDM(botToken, slackUserId, account
        ? "This workspace is connected. Your personal account is linked. Mention @chartbrew in an allowed channel or ask a question here."
        : `This workspace is connected. ${LINK_INSTRUCTIONS}`);
    } catch (error) {
      // oxlint-disable-next-line no-console
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
        // oxlint-disable-next-line no-console
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
              + "Tag @chartbrew in any channel to ask questions about your data. Answers arrive in the same thread.\n\n"
              + `${LINK_INSTRUCTIONS}\n\n`
              + "*Example:* `@chartbrew how many users do I have?`\n\n"
              + "*Setup Commands:*\n"
              + "• `/chartbrew link` - Link your Chartbrew account\n"
              + "• `/chartbrew unlink` - Unlink your account\n"
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
      // oxlint-disable-next-line no-console
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
        // oxlint-disable-next-line no-console
        console.error("Error posting via response_url:", e);
      }
    }

    // Fallback to bot token if available
    if (botToken) {
      try {
        await postMessage(botToken, channelId || slackUserId, helpMessage);
      } catch (e) {
        // oxlint-disable-next-line no-console
        console.error("Error posting help message via bot token:", e);
      }
    } else {
      // oxlint-disable-next-line no-console
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

      if (integration.team_id) {
        const account = await db.SlackAccount.findOne({ where: { integration_id: integration.id, slack_user_id: slackUserId } });
        if (!account || !(await getMemberAccess(integration.team_id, account.user_id)).canConfigureTeam) {
          throw new Error("Only Chartbrew team owners and admins can disconnect Slack. Link your account or disconnect in Chartbrew.");
        }
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

      if (!integration.team_id) {
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

      await invalidateIntegration(integration.id);

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
      // oxlint-disable-next-line no-console
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
        // oxlint-disable-next-line no-console
        console.error("Failed to send error message to Slack");
      }
    }
  }

  /**
   * Handle OAuth callback - Handle Slack app installation
   */
  async handleOAuthCallback(code, upgradeState = null) {
    const tokenData = await exchangeCodeForToken(code);

    if (upgradeState) {
      const state = await db.SlackAuthState.findOne({ where: {
        state_token: upgradeState, integration_type: "slack_upgrade", external_workspace_id: tokenData.team_id,
      } });
      if (!state || new Date(state.expires_at) <= new Date()) throw new Error("This update link has expired. Start again in Chartbrew.");
      const existing = await db.Integration.findOne({ where: { type: "slack", external_id: tokenData.team_id } });
      const role = existing?.team_id && await this.teamController.getTeamRole(existing.team_id, Number(state.external_user_id));
      if (!role || !["teamOwner", "teamAdmin"].includes(role.role)) throw new Error("Only team administrators can update Slack access.");
      await state.destroy();
      await existing.update({ config: { ...existing.config, bot_token: tokenData.bot_token, bot_user_id: tokenData.bot_user_id } });
      return { success: true };
    }

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
      await invalidateIntegration(integration.id);
      await integration.update({
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
  async handleAuthComplete(stateToken, teamId, userId, defaultProjectId) {
    // Find and verify auth state
    const authState = await db.SlackAuthState.findOne({
      where: { state_token: stateToken, integration_type: "slack" },
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

    if (Number(integration.team_id) !== Number(teamId)) {
      await invalidateIntegration(integration.id);
    }

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
      apikey_id: null,
      config: updatedConfig,
    });

    // Get team name
    const team = await db.Team.findByPk(teamId);

    // Send success DM
    const integrationUrl = `${clientUrl}/integrations/${integration.id}`;
    const personalSetup = `Need to link your personal account? ${LINK_INSTRUCTIONS}`;
    await sendDM(
      integration.config.bot_token,
      authState.external_user_id,
      {
        text: `Connected to ${team.name}. ${personalSetup}`,
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
              text: `${personalSetup}\n\n`
                + `1. Edit app channel access from the <${integrationUrl}|integrations settings>\n`
                + "2. Tag @chartbrew in your channels to ask questions about your data",
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
      integration_id: integration.id,
      team_id: teamId,
    };
  }

  /**
   * Get Slack channels
   */
  async getChannels(integrationId) {
    const integration = await db.Integration.findOne({
      where: {
        id: integrationId,
      },
    });

    if (!integration || !integration?.config?.bot_token) {
      throw new Error("Integration not found");
    }

    return getChannels(integration.config.bot_token);
  }
}

module.exports = SlackController;
