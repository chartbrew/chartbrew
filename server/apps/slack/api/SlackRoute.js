const audit = require("../audit");
const crypto = require("crypto");
const db = require("../../../models/models");
const verifyToken = require("../../../modules/verifyToken");
const SlackController = require("../controllers/SlackController");

const accounts = require("../accounts");
const conversations = require("../conversations");
const { WebClient } = require("@slack/web-api");

const { verifySignature, sendDM, SLACK_SCOPES } = require("../utils/slackClient");

module.exports = (app) => {
  const slackController = new SlackController();

  // Verify the signed Slack request before reading its identity.
  const verifySlackSignature = (req, res, next) => {
    if (!verifySignature(req)) {
      return res.status(401).json({ error: "Invalid Slack signature" });
    }
    return next();
  };

  /*
  ** Commands API
  */
  app.post("/apps/slack/commands", verifySlackSignature, async (req, res) => {
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
          case "link": {
            await accounts.startLink(team_id, user_id);
            break;
          }

          case "unlink": {
            const integration = await accounts.getIntegration(team_id);
            await accounts.unlink({ integration_id: integration.id, slack_user_id: user_id });
            await sendDM(integration.config.bot_token, user_id, "Your Chartbrew account is unlinked.");
            break;
          }

          case "connect": {
            await slackController.handleConnect(team_id, user_id, response_url);
            break;
          }

          case "status": {
            await slackController.handleStatus(team_id, user_id, channel_id, response_url);
            break;
          }

          case "help": {
            await slackController.handleHelp(team_id, user_id, channel_id, response_url);
            break;
          }

          case "disconnect": {
            await slackController.handleDisconnect(team_id, user_id, channel_id, response_url);
            break;
          }

          default: {
            await slackController.handleHelp(team_id, user_id, channel_id, response_url);
          }
        }
      } catch (error) {
        // oxlint-disable-next-line no-console
        console.error("Slack command error:", error);
        // oxlint-disable-next-line no-console
        console.error("Error stack:", error.stack);

        // Only send error if it wasn't already sent by the handler
        await slackController.sendErrorMessage(error, team_id, user_id, channel_id, response_url);
      }
    }
  });
  // --------------------------------------

  /*
  ** OAuth Callback - Handle Slack app installation
  * Slack redirects here via GET with query parameters after user authorizes
  */
  app.get("/apps/slack/oauth/callback", async (req, res) => {
    const { code, error, state } = req.query;

    // Handle OAuth errors from Slack
    if (error) {
      return res.status(400).send(error);
    }

    if (!code) {
      return res.status(400).send("Missing authorization code. Please try installing the app again from Slack.");
    }

    try {
      const result = await slackController.handleOAuthCallback(code, state?.startsWith("upgrade_") ? state : null);
      return res.status(200).send(result);
    } catch (error) {
      return res.status(500).send({ error: error.message });
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
      const result = await slackController.handleAuthComplete(
        state_token,
        team_id,
        req.user.id,
        default_project_id,
        req.user.email
      );
      return res.status(200).json(result);
    } catch (error) {
      // Map specific errors to appropriate status codes
      if (error.message.includes("Invalid or expired") || error.message.includes("expired")) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes("Only team owners") || error.message.includes("not found")) {
        return res.status(error.message.includes("not found") ? 404 : 403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message });
    }
  });
  // --------------------------------------

  app.post("/apps/slack/:id/upgrade", verifyToken, async (req, res) => {
    const integration = await db.Integration.findOne({ where: { id: req.params.id, type: "slack" } });
    const role = integration?.team_id && await db.TeamRole.findOne({ where: { team_id: integration.team_id, user_id: req.user.id } });
    if (!role || !["teamOwner", "teamAdmin"].includes(role.role)) return res.status(403).json({ error: "Access denied" });
    const state = `upgrade_${crypto.randomBytes(24).toString("hex")}`;
    await db.SlackAuthState.create({ state_token: state, integration_type: "slack_upgrade",
      external_workspace_id: integration.external_id, external_user_id: String(req.user.id),
      expires_at: new Date(Date.now() + 15 * 60 * 1000) });
    const params = new URLSearchParams({ client_id: process.env.VITE_APP_SLACK_CLIENT_ID,
      scope: SLACK_SCOPES, state, redirect_uri: `${process.env.VITE_APP_CLIENT_HOST}/integrations/auth/slack/callback` });
    return res.json({ url: `https://slack.com/oauth/v2/authorize?${params}` });
  });

  app.get("/apps/slack/oauth/start", (req, res) => {
    const params = new URLSearchParams({
      client_id: process.env.VITE_APP_SLACK_CLIENT_ID,
      scope: SLACK_SCOPES,
      redirect_uri: `${process.env.VITE_APP_CLIENT_HOST}/integrations/auth/slack/callback`,
      state: `dev_${Date.now()}`,
    });

    res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
  });

  const privateError = async (workspaceId, userId, error) => {
    const integration = await db.Integration.findOne({ where: { type: "slack", external_id: workspaceId } });
    if (!integration?.config?.bot_token) return;
    const text = error.statusCode ? error.message : "Chartbrew could not complete the request. Open Chartbrew to try again.";
    await sendDM(integration.config.bot_token, userId, text);
  };

  app.post("/apps/slack/interactions", verifySlackSignature, async (req, res) => {
    let interaction;
    try {
      interaction = JSON.parse(req.body.payload);
    } catch (_) {
      return res.status(400).send();
    }
    const { type, team, user, view } = interaction;
    try {
      if (type === "block_actions") {
        const action = interaction.actions?.[0];
        if (["slack_place", "slack_period"].includes(action?.action_id)) {
          res.status(200).send();
          await conversations.openActionModal(interaction);
          return;
        }
        if (!action || !/^(slack_(refresh|data|share|confirm|change)|slack_reply_[0-3])$/.test(action.action_id)) {
          res.status(200).send();
          await privateError(team.id, user.id, { statusCode: 409, message: "This control has expired. Ask again in the thread." });
          return;
        }
        const [parentId, cardIndex] = String(action.value).split(":");
        const input = {
          workspaceId: team.id, slackUserId: user.id, channelId: interaction.channel.id,
          messageTs: interaction.message.ts, parentId, cardIndex: Number(cardIndex), action: action.action_id,
        };
        const once = ["slack_confirm", "slack_share"].includes(action.action_id);
        await conversations.enqueue(input, `${user.id}:${action.value}:${action.action_id}:${once ? "once" : action.action_ts}`);
      } else if (type === "view_submission" && ["slack_place_submit", "slack_period_submit"].includes(view.callback_id)) {
        const metadata = JSON.parse(view.private_metadata);
        const input = { ...metadata, workspaceId: team.id, slackUserId: user.id, action: view.callback_id };
        if (view.callback_id === "slack_place_submit") {
          input.projectId = Number(view.state.values.dashboard.value.selected_option.value);
        } else {
          const start = view.state.values.start.value.selected_date;
          const end = view.state.values.end.value.selected_date;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(end || "") || start > end) {
            return res.json({ response_action: "errors", errors: { end: "Select an end date on or after the start date." } });
          }
          input.filters = [{ type: "date", startDate: start, endDate: end }];
        }
        await conversations.enqueue(input, `${user.id}:${input.parentId}:${input.cardIndex}:${view.callback_id}:${view.id}`);
      }
      if (!res.headersSent) res.status(200).send();
    } catch (error) {
      if (!res.headersSent) res.status(200).send();
      await privateError(team?.id, user?.id, error).catch(() => {});
    }
  });

  app.post("/apps/slack/events", verifySlackSignature, async (req, res) => {
    const { challenge, type, event, team_id: workspaceId, event_id: eventId } = req.body;
    if (type === "url_verification") return res.json({ challenge });
    if (type !== "event_callback" || !event || event.bot_id || event.subtype
      || !["app_mention", "message"].includes(event.type)
      || (event.type === "message" && event.channel_type !== "im")) return res.status(200).send();
    try {
      if (!eventId || !workspaceId || !event.user || !event.channel || !event.ts) return res.status(400).send();
      await conversations.enqueue({
        workspaceId, slackUserId: event.user, channelId: event.channel,
        threadTs: event.thread_ts || event.ts,
        question: String(event.text || "").replace(/<@[A-Z0-9]+>/g, "").trim(),
      }, eventId);
      res.status(200).send();

    } catch (error) {
      if (!res.headersSent) res.status(error.statusCode ? 200 : 503).send();
      await privateError(workspaceId, event.user, error).catch(async () => {
        if (!event.channel?.startsWith("C") && !event.channel?.startsWith("G")) return;
        const integration = await accounts.getIntegration(workspaceId).catch(() => null);
        if (integration) await new WebClient(integration.config.bot_token).chat.postEphemeral({
          channel: event.channel, user: event.user, text: error.message === accounts.LINK_INSTRUCTIONS ? accounts.LINK_INSTRUCTIONS : "Open the Chartbrew app's private chat in Slack to continue.",
        }).catch(() => {});
      });
    }
  });

  app.get("/apps/slack/:integrationId/conversations{/:threadId}", verifyToken, async (req, res) => {
    try {
      const integration = await audit.authorize(req.params.integrationId, req.user.id);
      const offset = Number(req.query.offset || 0);
      if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ error: "Choose a valid page." });
      const result = req.params.threadId
        ? await audit.getConversation(integration, req.params.threadId, offset)
        : await audit.listConversations(integration, offset);
      return res.json(result);
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Conversations could not load. Try again." });
    }
  });

  app.get("/apps/slack/:integrationId/dashboards", verifyToken, async (req, res) => {
    try {
      const integration = await audit.authorize(req.params.integrationId, req.user.id);
      return res.json(await db.Project.findAll({ where: { team_id: integration.team_id, ghost: false }, attributes: ["id", "name"], order: [["name", "ASC"]] }));
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Dashboards could not load. Try again." });
    }
  });

  app.get("/apps/slack/account", verifyToken, async (req, res) => {
    try {
      if (req.query.token) return res.json(await accounts.inspectLink(req.query.token, req.user.id));
      const linked = await db.SlackAccount.findAll({ where: { user_id: req.user.id } });
      const items = await Promise.all(linked.map(async (account) => {
        const integration = await db.Integration.findOne({ where: { id: account.integration_id, team_id: account.team_id, type: "slack" } });
        return integration ? { id: account.id, workspace: integration.config.slack_team_name } : null;
      }));
      return res.json({ accounts: items.filter(Boolean) });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "The account could not load. Try again." });
    }
  });

  app.post("/apps/slack/account", verifyToken, async (req, res) => {
    try {
      return res.json(await accounts.completeLink(req.body.token, req.user.id));
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "The account could not be linked. Run /chartbrew link again." });
    }
  });

  app.delete("/apps/slack/account/:id", verifyToken, async (req, res) => {
    await accounts.unlink({ id: req.params.id, user_id: req.user.id });
    return res.json({ linked: false });
  });

  /*
  ** Get Slack channels
  */
  app.get("/apps/slack/:integrationId/channels", verifyToken, async (req, res) => {
    const { team_id } = req.query;

    // allow only team owners and admins
    const teamRole = await db.TeamRole.findOne({
      where: {
        team_id,
        user_id: req.user.id,
      },
    });

    if (!teamRole?.role || !["teamOwner", "teamAdmin"].includes(teamRole.role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const integration = await db.Integration.findOne({ where: { id: req.params.integrationId, team_id, type: "slack" } });
    if (!integration) return res.status(404).json({ error: "Integration not found" });
    const channels = await slackController.getChannels(integration.id);
    return res.status(200).json(channels);
  });

  return (req, res, next) => {
    next();
  };
};
