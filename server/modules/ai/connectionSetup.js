const db = require("../../models/models");
const { getSourceById } = require("../../sources");
const { assertSourceServerEnabled } = require("../../sources/sourceAvailability");
const providers = require("../../sources/plugins/mcp/mcp.providers");
const { createHttpError, getObservationAccess } = require("../observations/access");
const { getWorkspaceAccessEnvelope } = require("../workspaceContext/accessEnvelope");

async function connectionSetup({ teamId, userId, conversationId, providerId, create = false }) {
  const access = await getObservationAccess(teamId, userId);
  if (!access.canConfigureTeam) throw createHttpError("Ask a team owner or admin to connect this source.", 403);
  const provider = providers.find((entry) => entry.id === providerId);
  if (!provider || typeof conversationId !== "string") {
    throw createHttpError("This connection option is no longer available. Ask again.", 400);
  }
  const source = getSourceById("mcp");
  assertSourceServerEnabled(source);
  const envelope = await getWorkspaceAccessEnvelope(access);

  // Lock the saved conversation so retries and duplicate cards cannot create two connections.
  return db.sequelize.transaction(async (transaction) => {
    const conversation = await db.AiConversation.findOne({
      where: { id: conversationId, team_id: teamId, user_id: userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!conversation) throw createHttpError("Open the conversation that offered this connection.", 404);
    const messages = await db.AiMessage.findAll({
      where: { conversation_id: conversationId, role: ["user", "tool"] },
      order: [["sequence", "ASC"]],
      transaction,
    });
    const references = [];
    let question = "";
    messages.forEach((message) => {
      if (message.role === "user") {
        question = [question, message.content].filter(Boolean).join("\n").slice(-2000);
        return;
      }
      if (message.tool_name !== "list_connections") return;
      if (message.sensitive_workspace_context && message.workspace_access_version !== envelope.accessVersion) return;
      try {
        const content = JSON.parse(message.content);
        const option = content.options?.find((entry) => entry.provider_id === providerId);
        if (option) references.push({ message, content, option, question });
      } catch (_) { /* Old messages may not contain a structured result. */ }
    });
    if (!references.length) throw createHttpError("This connection was not offered in this conversation. Ask again.", 409);
    const ids = references.map(({ option }) => option.connection_id).filter(Boolean);
    let connection = ids.length ? await db.Connection.findOne({
      where: { id: ids, team_id: teamId, type: "mcp" }, transaction,
    }) : null;
    if (!connection && ids.length) {
      throw createHttpError("This connection was removed. Ask for a new connection.", 404);
    }
    if (connection) {
      const endpoint = new URL(provider.url);
      let matches = false;
      try {
        const currentUrl = new URL(connection.host);
        matches = currentUrl.origin === endpoint.origin
          && currentUrl.pathname.replace(/\/$/, "") === endpoint.pathname;
      } catch (_) { /* An edited URL must be reviewed in the connection form. */ }
      if (!matches || (!connection.active && connection.authentication?.type !== "oauth")) {
        throw createHttpError("This connection changed. Open Connections to review its settings.", 409);
      }
    }
    if (!connection && create) {
      const data = await source.backend.prepareConnectionData({
        connection: {
          name: provider.name, team_id: teamId, host: provider.url, authentication: { type: "oauth" },
          options: { mcp: { toolQuery: references.at(-1).question } },
        },
        user: { id: userId, isEditor: true },
      });
      connection = await db.Connection.create(data, { transaction });
    }
    const option = {
      provider_id: provider.id, source_id: source.id, name: provider.name,
      state: "mcp_oauth_setup",
    };
    if (connection) {
      option.connection_id = connection.id;
      option.setup_url = `/connections/${connection.id}`;
      if (connection.active) {
        option.state = "connected";
        option.needs_approval = source.backend.ai.getCapabilities({ connection }).approvedToolCount === 0;
      }
      if (create) {
        await Promise.all(references.map(({ message, content }) => {
          content.options = content.options.map((entry) => entry.provider_id === providerId ? option : entry);
          const serialized = JSON.stringify(content);
          return message.update({ content: serialized, tool_result_preview: serialized.slice(0, 500) }, { transaction });
        }));
      }
    }
    return option;
  });
}

module.exports = connectionSetup;
