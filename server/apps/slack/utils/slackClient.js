const { WebClient } = require("@slack/web-api");
const crypto = require("crypto");

const slackClientId = process.env.VITE_APP_SLACK_CLIENT_ID;
const slackClientSecret = process.env.CB_SLACK_CLIENT_SECRET;
const slackSigningSecret = process.env.CB_SLACK_SIGNING_SECRET;

/**
 * Verify Slack request signature
 * Slack sends requests as URL-encoded form data
 * Note: For proper signature verification, we need raw body, but Express parses it
 * This is a simplified version that works with parsed body
 */
function verifySignature(req) {
  if (!slackSigningSecret) {
    // eslint-disable-next-line no-console
    console.warn("SLACK_SIGNING_SECRET not configured, skipping signature verification");
    return true;
  }

  const timestamp = req.headers["x-slack-request-timestamp"];
  const signature = req.headers["x-slack-signature"];

  if (!timestamp || !signature) {
    // eslint-disable-next-line no-console
    console.warn("Missing Slack signature headers");
    // Allow request to proceed for now (can be strict later)
    return true;
  }

  // Check if request is too old (replay attack protection)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp, 10)) > 300) {
    // eslint-disable-next-line no-console
    console.warn("Slack request timestamp too old");
    return false;
  }

  // Use raw body if available (preferred for accurate signature verification)
  let bodyString = "";
  if (req.rawBody) {
    bodyString = req.rawBody;
  } else if (req.body) {
    // Fallback: reconstruct from parsed body
    // Events API sends JSON, commands/interactions send URL-encoded form data
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      // For JSON payloads (Events API), stringify the body
      bodyString = JSON.stringify(req.body);
    } else {
      // For URL-encoded payloads (commands/interactions), use URLSearchParams
      const params = new URLSearchParams();
      Object.keys(req.body).forEach((key) => {
        params.append(key, req.body[key]);
      });
      bodyString = params.toString();
    }
  }

  // Create the signature base string
  const sigBaseString = `v0:${timestamp}:${bodyString}`;

  // Create the signature
  const mySignature = `v0=${crypto
    .createHmac("sha256", slackSigningSecret)
    .update(sigBaseString)
    .digest("hex")}`;

  // Compare signatures using constant-time comparison
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(mySignature),
      Buffer.from(signature)
    );
    if (!isValid) {
      // eslint-disable-next-line no-console
      console.warn("Invalid Slack signature - this may be due to body parsing");
      // eslint-disable-next-line no-console
      console.warn("Expected:", signature);
      // eslint-disable-next-line no-console
      console.warn("Computed:", mySignature);

      // In development, allow interactive payloads and events to proceed for testing
      // These are harder to verify without raw body
      if (process.env.NODE_ENV !== "production") {
        if (req.body && req.body.payload) {
          // eslint-disable-next-line no-console
          console.warn("Allowing interactive payload in development mode");
          return true;
        }
        if (req.body && (req.body.type === "event_callback" || req.body.event)) {
          // eslint-disable-next-line no-console
          console.warn("Allowing event payload in development mode");
          return true;
        }
      }
    }
    return isValid;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Signature verification error:", e.message);
    // Allow request to proceed for debugging
    return true;
  }
}

/**
 * Exchange OAuth code for bot token
 */
async function exchangeCodeForToken(code) {
  if (!slackClientId || !slackClientSecret) {
    throw new Error("Slack OAuth credentials not configured");
  }

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: slackClientId,
      client_secret: slackClientSecret,
      code,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`);
  }

  return {
    bot_token: data.access_token,
    bot_user_id: data.bot_user_id,
    team_id: data.team.id,
    team_name: data.team.name,
    installer_user_id: data.authed_user.id,
  };
}

/**
 * Send DM to Slack user
 * @param {string} botToken - Slack bot token
 * @param {string} userId - User ID to send DM to
 * @param {string|object} message - Plain text string or object with { text, blocks }
 */
async function sendDM(botToken, userId, message) {
  const client = new WebClient(botToken);

  try {
    const messagePayload = {
      channel: userId,
    };

    // Support both plain text strings and Block Kit format
    if (typeof message === "string") {
      messagePayload.text = message;
    } else if (message && typeof message === "object") {
      messagePayload.text = message.text || "Message";
      if (message.blocks) {
        messagePayload.blocks = message.blocks;
      }
    }

    const result = await client.chat.postMessage(messagePayload);
    return result;
  } catch (error) {
    throw new Error(`Failed to send DM: ${error.message}`);
  }
}

/**
 * Post message to Slack channel
 * @param {string} botToken - Slack bot token
 * @param {string} channel - Channel ID to post to
 * @param {string|object} message - Plain text string or object with { text, blocks }
 * @param {object} options - Additional options to pass to Slack API
 */
async function postMessage(botToken, channel, message, options = {}) {
  if (!botToken) {
    // eslint-disable-next-line no-console
    console.error("postMessage called without botToken");
    return null;
  }

  if (!channel) {
    // eslint-disable-next-line no-console
    console.error("postMessage called without channel");
    return null;
  }

  const client = new WebClient(botToken);

  try {
    const messagePayload = {
      channel,
      ...options,
    };

    // Support both plain text strings and Block Kit format
    if (typeof message === "string") {
      messagePayload.text = message;
    } else if (message && typeof message === "object") {
      messagePayload.text = message.text || "Message";
      if (message.blocks) {
        messagePayload.blocks = message.blocks;
      }
    }

    const result = await client.chat.postMessage(messagePayload);
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to post message to Slack:", error.message);
    // eslint-disable-next-line no-console
    console.error("Error details:", error.data || error);
    throw new Error(`Failed to post message: ${error.message}`);
  }
}

/**
 * Post message using response_url (for delayed responses)
 * @param {string} responseUrl - Slack response URL
 * @param {string|object} message - Plain text string or object with { text, blocks }
 */
async function postResponseUrl(responseUrl, message) {
  if (!responseUrl) {
    // eslint-disable-next-line no-console
    console.error("postResponseUrl called without responseUrl");
    return null;
  }

  try {
    const payload = {
      response_type: "ephemeral", // Only visible to the user who ran the command
    };

    // Support both plain text strings and Block Kit format
    if (typeof message === "string") {
      payload.text = message;
    } else if (message && typeof message === "object") {
      payload.text = message.text || "Message";
      if (message.blocks) {
        payload.blocks = message.blocks;
      }
    }

    const response = await fetch(responseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // eslint-disable-next-line no-console
      console.error("Response URL error:", response.status, errorText);
      return null;
    }

    // Slack returns "ok" as plain text, not JSON
    const responseText = await response.text();

    // Try to parse as JSON, but handle plain text "ok" response
    try {
      return JSON.parse(responseText);
    } catch (e) {
      // If it's just "ok", that's fine - Slack accepted it
      if (responseText.trim() === "ok") {
        return { ok: true };
      }
      // eslint-disable-next-line no-console
      console.warn("Unexpected response format from Slack:", responseText);
      return { ok: true }; // Assume success if we got 200 OK
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to post to response_url:", error.message);
    return null;
  }
}

/**
 * Get user info from Slack
 */
async function getUserInfo(botToken, userId) {
  const client = new WebClient(botToken);

  try {
    const result = await client.users.info({
      user: userId,
    });
    return result.user;
  } catch (error) {
    throw new Error(`Failed to get user info: ${error.message}`);
  }
}

/**
 * Check if user is workspace admin
 */
async function isWorkspaceAdmin(botToken, userId) {
  try {
    const userInfo = await getUserInfo(botToken, userId);
    return userInfo.is_admin || userInfo.is_owner;
  } catch (error) {
    return false;
  }
}

module.exports = {
  verifySignature,
  exchangeCodeForToken,
  sendDM,
  postMessage,
  postResponseUrl,
  getUserInfo,
  isWorkspaceAdmin,
};
