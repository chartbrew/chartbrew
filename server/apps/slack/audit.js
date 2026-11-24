const { Op, fn, col } = require("sequelize");
const db = require("../../models/models");
const { createHttpError, getMemberAccess } = require("../../modules/observations/access");

async function authorize(integrationId, userId) {
  const integration = await db.Integration.findByPk(integrationId);
  if (!integration || integration.type !== "slack") throw createHttpError("Integration not found", 404);
  const access = await getMemberAccess(integration.team_id, userId);
  if (!access.canConfigureTeam) throw createHttpError("Only owners and admins can review Slack conversations.", 403);
  return integration;
}

async function listConversations(integration, offset = 0) {
  const { rows, count } = await db.SlackThread.findAndCountAll({
    where: { team_id: integration.team_id, integration_id: integration.id }, order: [["updatedAt", "DESC"], ["id", "ASC"]], limit: 25, offset,
  });
  const usage = rows.length ? await db.AiUsage.findAll({
    where: { team_id: integration.team_id, integration_id: integration.id, conversation_id: { [Op.in]: rows.map((row) => row.conversation_id) } },
    attributes: ["conversation_id", "usage_status", [fn("SUM", col("total_tokens")), "tokens"], [fn("COUNT", col("id")), "calls"]],
    group: ["conversation_id", "usage_status"], raw: true,
  }) : [];
  return { total: count, conversations: rows.map((row) => ({
    id: row.id, channel: row.channel_id, startedAt: row.createdAt, updatedAt: row.updatedAt,
    url: `https://app.slack.com/client/${integration.external_id}/${row.channel_id}/thread/${row.channel_id}-${row.thread_ts}`,
    tokens: usage.filter((item) => item.conversation_id === row.conversation_id).reduce((total, item) => total + Number(item.tokens || 0), 0),
    incomplete: usage.some((item) => item.conversation_id === row.conversation_id && !["reported", "rejected", "legacy"].includes(item.usage_status)),
  })) };
}

async function getConversation(integration, threadId, offset = 0) {
  const thread = await db.SlackThread.findOne({ where: { id: threadId, integration_id: integration.id, team_id: integration.team_id } });
  if (!thread) throw createHttpError("Conversation not found", 404);
  const { rows, count } = await db.SlackRequest.findAndCountAll({
    where: { team_id: integration.team_id, integration_id: integration.id, thread_id: thread.id }, order: [["createdAt", "ASC"], ["id", "ASC"]], limit: 25, offset,
  });
  const usage = rows.length ? await db.AiUsage.findAll({
    where: { team_id: integration.team_id, integration_id: integration.id, integration_request_id: { [Op.in]: rows.map((row) => row.id) } },
    attributes: ["integration_request_id", "total_tokens", "usage_status"], raw: true,
  }) : [];
  return { total: count, requests: rows.map((row) => {
    const calls = usage.filter((item) => item.integration_request_id === row.id);
    return {
      id: row.id, requester: row.input.requesterName || "Slack user",
      requesterUrl: `https://app.slack.com/team/${row.input.slackUserId}`, question: row.input.question || null,
      action: row.input.action || null, answer: row.result?.message?.replace(/```cb-[\s\S]*?```/g, "").trim() || null,
      charts: (row.result?.cards || []).map((card) => ({ id: card.chart.id, name: card.chart.name })),
      error: row.error || row.result?.error || null, delivered: row.status === "complete" && !row.error, createdAt: row.createdAt,
      tokens: thread.shared_key ? calls.reduce((total, item) => total + Number(item.total_tokens || 0), 0) : null,
      incomplete: !thread.shared_key || calls.some((item) => !["reported", "rejected", "legacy"].includes(item.usage_status)),
    };
  }) };
}

module.exports = { authorize, getConversation, listConversations };
