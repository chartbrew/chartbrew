const { adminRoles, teamRoles } = require("../../../shared/roles.json");
const crypto = require("crypto");
const { Op } = require("sequelize");
const db = require("../../models/models");
const { createHttpError, getObservationAccess, getMemberAccess } = require("../../modules/observations/access");
const { getWorkspaceAccessEnvelope } = require("../../modules/workspaceContext/accessEnvelope");
const { getWorkspaceOrchestratorPolicy } = require("../../modules/workspaceContext/policy");
const slackClient = require("./utils/slackClient");

const LINK_INSTRUCTIONS = "Open a direct message with the Chartbrew app in Slack. Send `/chartbrew link`, then select Link account and confirm in Chartbrew.";

function hashToken(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    throw createHttpError("This link has expired. Run /chartbrew link again.", 400);
  }
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getIntegration(workspaceId) {
  const integration = await db.Integration.findOne({ where: { type: "slack", external_id: workspaceId } });
  if (!integration?.team_id || !integration.config?.bot_token) {
    throw createHttpError("Ask your administrator to connect this Slack workspace to Chartbrew.", 403);
  }
  return integration;
}

async function resolveAccount(workspaceId, slackUserId) {
  const integration = await getIntegration(workspaceId);
  const account = await db.SlackAccount.findOne({
    where: { integration_id: integration.id, slack_user_id: slackUserId, team_id: integration.team_id },
  });
  const mode = integration.config.accessMode || "admins-only";
  if (!account && mode !== "everyone") throw createHttpError(LINK_INSTRUCTIONS, 403);
  const access = account ? await getMemberAccess(integration.team_id, account.user_id) : {
    teamId: Number(integration.team_id), userId: null, role: "projectViewer", projectIds: [], allProjects: false,
    canConfigureTeam: false, teamAiEnabled: (await db.Team.findByPk(integration.team_id))?.aiEnabled !== false,
  };
  if ((mode === "admins-only" && !adminRoles.includes(access.role))
    || (mode === "team" && !teamRoles.includes(access.role))
    || !["admins-only", "team", "team-and-clients", "everyone"].includes(mode)) {
    throw createHttpError("Your role cannot ask questions through this integration.", 403);
  }
  let selected = Array.isArray(integration.config.dashboardIds) ? integration.config.dashboardIds : [];
  if (integration.config.allowAllDashboards === true) {
    const dashboards = await db.Project.findAll({
      where: { team_id: integration.team_id, ghost: false }, attributes: ["id"],
    });
    selected = dashboards.map((project) => Number(project.id));
  }
  access.projectIds = selected.filter((id) => !account || access.allProjects || access.projectIds.includes(id));
  access.allProjects = false;
  access.canConfigureTeam = false;
  access.integrationId = integration.id;
  if (!access.teamAiEnabled || !getWorkspaceOrchestratorPolicy().enabled) {
    throw createHttpError("AI is unavailable for this workspace. Open Chartbrew to check access.", 403);
  }
  const envelope = await getWorkspaceAccessEnvelope(access);
  return { integration, account: account || { id: null, user_id: null }, access, envelope };
}

async function startLink(workspaceId, slackUserId) {
  const integration = await getIntegration(workspaceId);
  const token = crypto.randomBytes(32).toString("hex");
  await db.SlackLinkToken.destroy({ where: {
    integration_id: integration.id, slack_user_id: slackUserId,
  } });
  await db.SlackLinkToken.create({
    token_hash: hashToken(token), integration_id: integration.id,
    team_id: integration.team_id, slack_user_id: slackUserId,
    expires_at: new Date(Date.now() + 15 * 60 * 1000),
  });
  await slackClient.sendDM(integration.config.bot_token, slackUserId, {
    text: "Link your Chartbrew account. This link expires in 15 minutes.",
    blocks: [{ type: "actions", elements: [{
      type: "button", text: { type: "plain_text", text: "Link account" },
      url: `${process.env.VITE_APP_CLIENT_HOST}/integrations/slack/account?token=${token}`,
    }] }],
  });
}

async function getLink(token, userId, transaction) {
  const state = await db.SlackLinkToken.findOne({
    where: { token_hash: hashToken(token), expires_at: { [Op.gt]: new Date() } },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!state) throw createHttpError("This link has expired. Run /chartbrew link again.", 400);
  const integration = await db.Integration.findOne({
    where: { id: state.integration_id, type: "slack", team_id: state.team_id }, transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!integration?.config?.bot_token) throw createHttpError("This workspace is no longer connected.", 403);
  await getObservationAccess(state.team_id, userId);
  return { state, integration };
}

async function inspectLink(token, userId) {
  const { integration } = await getLink(token, userId);
  return { workspace: integration.config.slack_team_name, teamId: integration.team_id };
}

async function completeLink(token, userId) {
  let notification;
  const result = await db.sequelize.transaction(async (transaction) => {
    const { state, integration } = await getLink(token, userId, transaction);
    const [account] = await db.SlackAccount.findOrCreate({
      where: { integration_id: integration.id, slack_user_id: state.slack_user_id },
      defaults: { user_id: userId, team_id: integration.team_id }, transaction,
    });
    if (Number(account.user_id) !== Number(userId) || Number(account.team_id) !== Number(integration.team_id)) {
      throw createHttpError("Unlink the existing account in Slack before linking another account.", 409);
    }
    await state.destroy({ transaction });
    notification = { botToken: integration.config.bot_token, userId: state.slack_user_id };
    return { linked: true, workspace: integration.config.slack_team_name };
  });
  await slackClient.sendDM(notification.botToken, notification.userId, "Your Chartbrew account is linked. Mention @chartbrew in an allowed channel or ask a question here.").catch(() => {});
  return result;
}

async function unlink(where) {
  const accounts = await db.SlackAccount.findAll({ where });
  await Promise.all(accounts.map(async (account) => {
    // Removing the account also makes all old request and action references unusable.
    await db.SlackAccount.destroy({ where: { id: account.id } });
    await db.SlackLinkToken.destroy({ where: {
      integration_id: account.integration_id, slack_user_id: account.slack_user_id,
    } });
  }));
}

async function invalidateIntegration(integrationId) {
  await unlink({ integration_id: integrationId });
  await db.SlackLinkToken.destroy({ where: { integration_id: integrationId } });
}

module.exports = {
  LINK_INSTRUCTIONS, completeLink, getIntegration, hashToken, inspectLink, invalidateIntegration,
  resolveAccount, startLink, unlink,
};
