const verifyToken = require("../../../modules/verifyToken");
const SlackController = require("../controllers/SlackController");

const { verifySignature } = require("../utils/slackClient");

module.exports = (app) => {
  const slackController = new SlackController();

  // Middleware to verify Slack signature (with lenient mode for interactive payloads)
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
        // eslint-disable-next-line no-console
        console.error("Slack command error:", error);
        // eslint-disable-next-line no-console
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
    const { code, error } = req.query;

    // Handle OAuth errors from Slack
    if (error) {
      return res.status(400).send(error);
    }

    if (!code) {
      return res.status(400).send("Missing authorization code. Please try installing the app again from Slack.");
    }

    try {
      const result = await slackController.handleOAuthCallback(code);
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

  app.get("/apps/slack/oauth/start", (req, res) => {
    const params = new URLSearchParams({
      client_id: process.env.CB_SLACK_CLIENT_ID,
      scope: "commands,chat:write,chat:write.public,im:write,users:read,app_mentions:read",
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
      const { type, actions } = interaction;

      // Acknowledge immediately for block_actions
      if (type === "block_actions" && actions && actions.length > 0) {
        res.status(200).send();
      }

      // Acknowledge immediately for modal submissions
      if (type === "view_submission") {
        res.status(200).send();
      }

      // Handle interaction in controller
      await slackController.handleInteraction(interaction);

      // Default response for unhandled interactions
      return res.status(200).send();
    } catch (error) {
      return res.status(200).send(); // Always acknowledge to Slack
    }
  });
  // --------------------------------------

  /*
  ** Events API
  */
  app.post("/apps/slack/events", verifySlackSignature, async (req, res) => {
    const { challenge, type, event } = req.body;

    // Handle URL verification challenge
    if (challenge) {
      return res.status(200).send({ challenge });
    }

    // Slack Events API wraps events in event_callback
    // Structure: { type: "event_callback", event: { type: "app_mention", ... } }
    if (type === "event_callback" && event && event.type === "app_mention") {
      // Acknowledge immediately (Slack requires response within 3 seconds)
      res.status(200).send();

      try {
        await slackController.handleMention(event);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Slack app_mention event error:", error);
        // eslint-disable-next-line no-console
        console.error("Error stack:", error.stack);
        // Error handling is done in the controller
      }
      return true;
    } else {
      // Acknowledge other events
      return res.status(200).send({ message: "Event received" });
    }
  });
  // --------------------------------------

  return (req, res, next) => {
    next();
  };
};
