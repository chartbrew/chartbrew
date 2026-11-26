const { createSlackProgress } = require("./progress");
const { sendDashboardSnapshot, authorizeDashboard } = require("./dashboardSnapshot");
const { getIntegrationContext, withIntegrationContext } = require("../../modules/observations/integrationContext");
const { withAiUsageContext } = require("../../modules/ai/usage");
const crypto = require("crypto");
const { v5: uuidv5 } = require("uuid");
const { WebClient } = require("@slack/web-api");
const db = require("../../models/models");
const ai = require("../../controllers/AiController");
const { createHttpError } = require("../../modules/observations/access");
const { authorizeChartImage } = require("../../modules/chartImage/imageAccess");
const { clearPendingActions } = require("../../modules/workspaceContext/previewStore");
const { getSlackQueue } = require("./queue");
const { canReadHistoryMessage } = require("../../modules/workspaceContext/accessEnvelope");
const accounts = require("./accounts");
const { addImage, chartBlocks, editableDashboards, loadChart } = require("./charts");
const { answerBlocks, dataTable, plain, section } = require("./utils/resultBlocks");

function channelAllowed(integration, channel) {
  return integration.config?.allowAllChannels === true
    || (Array.isArray(integration.config?.allowedChannels) && integration.config.allowedChannels.includes(channel));
}

async function assertSourceChannel(identity, channel) {
  if (channel.startsWith("D")) {
    if (!identity.account.id) throw createHttpError(accounts.LINK_INSTRUCTIONS, 403);
    return;
  }
  if (!channelAllowed(identity.integration, channel)) throw createHttpError("Chartbrew is not allowed in this channel.", 403);
}

async function enqueue(input, key) {
  if (typeof input.workspaceId !== "string" || typeof input.slackUserId !== "string"
    || typeof input.channelId !== "string" || typeof key !== "string"
    || (input.question != null && (typeof input.question !== "string" || input.question.length > 20000))) {
    throw createHttpError("Enter a question with fewer than 20,000 characters.", 400);
  }
  const identity = await accounts.resolveAccount(input.workspaceId, input.slackUserId);
  await assertSourceChannel(identity, input.channelId);
  const requestKey = crypto.createHash("sha256").update(`${input.workspaceId}:${key}`).digest("hex");
  const [request] = await db.SlackRequest.findOrCreate({
    where: { request_key: requestKey },
    defaults: { team_id: identity.access.teamId, integration_id: identity.integration.id, account_id: identity.account.id, status: "queued", input },
  });
  await getSlackQueue().add("request", { requestId: request.id }, { jobId: request.id });
}

async function resolveRequest(request) {
  const identity = await accounts.resolveAccount(request.input.workspaceId, request.input.slackUserId);
  if ((request.team_id && request.team_id !== identity.access.teamId) || identity.account.id !== request.account_id || (request.integration_id && identity.integration.id !== request.integration_id)) throw createHttpError("Start a new conversation after linking your account.", 403);
  await assertSourceChannel(identity, request.input.channelId);
  return identity;
}

async function getThread(request, identity) {
  const input = request.input;
  if (input.parentId) {
    const parent = await db.SlackRequest.findByPk(input.parentId);
    if (!parent || parent.integration_id !== identity.integration.id || parent.account_id !== identity.account.id || parent.status !== "complete"
      || Date.now() - new Date(parent.createdAt).getTime() > 24 * 60 * 60 * 1000
      || parent.access_version !== identity.envelope.accessVersion
      || !(parent.messages || []).some((message) => message.ts === input.messageTs && message.channel === input.channelId)) {
      throw createHttpError("This result is no longer available. Ask again in this thread.", 409);
    }
    const thread = await db.SlackThread.findOne({ where: { id: parent.thread_id, integration_id: identity.integration.id } });
    if (!thread) throw createHttpError("Start a new conversation.", 409);
    await assertSourceChannel(identity, thread.channel_id);
    return { thread, parent };
  }
  const sharedKey = crypto.createHash("sha256").update(`${identity.access.teamId}:${identity.integration.id}:${input.channelId}:${input.threadTs}`).digest("hex");
  let thread = await db.SlackThread.findOne({ where: { shared_key: sharedKey, integration_id: identity.integration.id, team_id: identity.access.teamId } });
  if (!thread) {
    const conversation = await db.AiConversation.create({
      user_id: null, team_id: identity.access.teamId, integration_id: identity.integration.id,
      title: "Slack conversation", status: "active", source: "slack",
    });
    thread = await db.SlackThread.create({
      team_id: identity.access.teamId, integration_id: identity.integration.id, shared_key: sharedKey,
      channel_id: input.channelId, thread_ts: input.threadTs, conversation_id: conversation.id,
      dm_channel: input.channelId, dm_thread_ts: input.threadTs,
    });
  }
  await thread.update({ updatedAt: new Date(), dm_channel: input.channelId, dm_thread_ts: input.threadTs });
  return { thread, parent: null };
}

/* oxlint-disable no-await-in-loop -- Slack delivery and conversation writes must stay ordered. */
async function execute(request, identity, thread, parent) {
  const input = request.input;
  const base = { teamId: identity.access.teamId, userId: identity.account.user_id,
    aiConversationId: thread.conversation_id, persistence: "persistent" };
  const card = parent?.result?.cards?.[input.cardIndex];
  if (input.action === "slack_place_submit") {
    if (!card || input.version !== card.chart.configurationVersion) throw createHttpError("This chart changed. Refresh it before adding it.", 409);
    const current = await loadChart(card.chart.id, identity);
    if (current.chart.configurationVersion !== input.version) throw createHttpError("This chart changed. Refresh it before adding it.", 409);
    await ai.placeChartPreview({ ...base, action: { type: "add_preview_to_dashboard", chartId: card.chart.id, targetProjectId: input.projectId } });
    return { message: "Chart added to the dashboard.", cards: [await loadChart(card.chart.id, identity)] };
  }
  if (["slack_refresh", "slack_period_submit", "slack_data", "slack_share"].includes(input.action)) {
    if (!card) throw createHttpError("This chart is unavailable. Ask again.", 409);
    await loadChart(card.chart.id, identity);
    if (input.action === "slack_share") {
      await authorizeChartImage({ chartId: card.chart.id, projectId: card.chart.project_id, userId: identity.account.user_id });
      return { cards: [card], share: true };
    }
    if (input.action === "slack_data") return { cards: [], dataChartId: card.chart.id, data: [...dataTable(card.chart), {
      type: "actions", elements: [{ type: "button", text: plain("Open in Chartbrew"),
        url: `${process.env.VITE_APP_CLIENT_HOST}/previews/${card.chart.id}` }],
    }] };
    const filters = input.action === "slack_period_submit" ? input.filters : card.filters;
    const updated = await loadChart(card.chart.id, identity, { refresh: true, filters });
    updated.canPlace = identity.envelope.editableProjectIds.length > 0;
    return { cards: [updated], replace: true };
  }
  if (input.action === "slack_change") {
    await clearPendingActions({ access: identity.access, sessionId: `conversation:${thread.conversation_id}` });
    return { message: "What would you like to change?", cards: [] };
  }
  const action = input.action === "slack_confirm"
    ? { type: "confirm_pending_action", actionId: parent?.result?.pendingAction?.actionId } : undefined;
  if (action && !action.actionId) throw createHttpError("This change is no longer available. Ask again.", 409);
  const reply = input.action?.match(/^slack_reply_(\d)$/);
  const message = reply ? parent.result.replies?.[Number(reply[1])] : input.question;
  if (!action && (!message?.trim() || message.length > 20000)) throw createHttpError("Enter a question with fewer than 20,000 characters.", 400);
  const conversation = await db.AiConversation.findByPk(thread.conversation_id);
  const context = !conversation.message_count && !parent && identity.integration.config.default_project_id
    && identity.envelope.historyAccessScope.visibleProjectIds.includes(Number(identity.integration.config.default_project_id))
    ? [{ entityType: "project", entityId: Number(identity.integration.config.default_project_id) }] : undefined;
  const result = await withIntegrationContext({
    ...getIntegrationContext(),
    resolveSnapshotProjectIds: async () => {
      const previous = await db.SlackRequest.findAll({ where: {
        thread_id: thread.id, integration_id: identity.integration.id, status: "complete",
        access_version: identity.envelope.accessVersion,
      }, order: [["createdAt", "DESC"]], limit: 10 });
      const references = previous.map((item) => item.result?.dashboardReferences
        || [...new Set((item.result?.cards || []).map((card) => card.chart.project_id))]);
      return references.find((ids) => ids.length) || [];
    },
  }, () => ai.respond({ ...base, action, message, context }));
  const ids = [...new Set([...(result.chartPreviews || [])
    .filter((chart) => chart.toolName !== "read_chart_results").map((chart) => chart.chartId),
    ...(result.snapshots || []).map((chart) => chart.chart_id)].filter(Boolean))];
  const cards = [];
  for (const id of ids) {
    try {
      const refresh = result.chartPreviews?.some((chart) => chart.chartId === id && chart.refreshRequested === true);
      const preview = await loadChart(id, identity, { refresh });
      preview.canPlace = identity.envelope.editableProjectIds.length > 0;
      cards.push(preview);
    } catch (_) {
      result.message = `${result.message || ""}\n\nThe chart could not be loaded. Open it in Chartbrew and try again.`.trim();
    }
  }
  const answer = answerBlocks(result, `${request.id}:answer`);
  const dashboardSnapshots = [...new Map((result.dashboardSnapshots || []).map((snapshot) => [snapshot.projectId, snapshot])).values()];
  const dashboardReferences = [...new Set([
    ...dashboardSnapshots.map((snapshot) => snapshot.projectId),
    ...(result.chartPreviews || []).map((chart) => chart.projectId),
  ].filter(Number.isSafeInteger))];
  return { message: result.message, pendingAction: result.pendingAction || null, replies: answer.replies, cards, dashboardSnapshots, dashboardReferences };
}

async function deliver(request, identity, thread, parent, client) {
  const assertDeliveryAccess = async () => {
    const current = await resolveRequest(request);
    if (current.envelope.accessVersion !== request.access_version) throw createHttpError("Your access changed. Ask again in this thread.", 403);
    for (const snapshot of request.result.dashboardSnapshots || []) {
      await authorizeDashboard(snapshot.projectId, current.access.teamId, current.account.user_id);
    }
    if (request.result.dataChartId) await loadChart(request.result.dataChartId, current);
    for (const card of request.result.cards) {
      await loadChart(card.chart.id, current);
      if (request.result.share) {
        await authorizeChartImage({ chartId: card.chart.id, projectId: card.chart.project_id, userId: current.account.user_id });
      }
    }
    return current;
  };
  await assertDeliveryAccess();
  const result = request.result;
  const messages = [...(request.messages || [])];
  const isShared = result.share;
  let channel = thread.dm_channel;
  let threadTs = thread.dm_thread_ts;
  if (isShared) {
    if (thread.channel_id.startsWith("D") || !channelAllowed(identity.integration, thread.channel_id)) throw createHttpError("This result cannot be shared in that channel.", 403);
    const info = await client.conversations.info({ channel: thread.channel_id });
    if (!info.channel || info.channel.is_ext_shared !== false || info.channel.is_org_shared) throw createHttpError("Sharing is unavailable for this channel.", 403);
    channel = thread.channel_id;
    threadTs = thread.thread_ts;
  }
  const payloads = [];
  if (result.message) {
    const answer = answerBlocks(result, `${request.id}:answer`);
    let blocks = [];
    const addPayload = () => {
      if (!blocks.length) return;
      payloads.push({ blocks, text: blocks.map((block) => block.type === "markdown"
        ? block.text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
        : block.text?.text || "").filter(Boolean).join("\n") || "Chartbrew result" });
      blocks = [];
    };
    for (const block of answer.blocks) {
      if (blocks.length === 10 || (block.type === "markdown" && blocks.length)) addPayload();
      blocks.push(block);
    }
    addPayload();
  }
  if (result.data) payloads.push({ text: "Chart data", blocks: result.data });
  for (let index = 0; index < result.cards.length; index++) {
    payloads.push({ cardIndex: index });
  }
  for (const snapshot of result.dashboardSnapshots || []) payloads.push({ dashboardSnapshot: snapshot });
  for (let index = messages.length; index < payloads.length; index++) {
    const current = await assertDeliveryAccess();
    if (payloads[index].dashboardSnapshot) {
      const fileId = await sendDashboardSnapshot(payloads[index].dashboardSnapshot, client, channel, threadTs, assertDeliveryAccess);
      messages.push({ channel, fileId });
      await request.update({ messages });
    } else {
      const cardIndex = payloads[index].cardIndex;
      if (cardIndex !== undefined) {
        const card = await addImage(result.cards[cardIndex], current, client, channel, assertDeliveryAccess, threadTs);
        await assertDeliveryAccess();
        result.cards[cardIndex] = card;
        await request.update({ result });
        payloads[index] = { ...chartBlocks(card, `${request.id}:${cardIndex}`, {
          shared: isShared, canShare: channel !== thread.channel_id && !thread.channel_id.startsWith("D"),
        }), cardIndex };
      }
      const payload = { text: payloads[index].text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), blocks: payloads[index].blocks };
      let replacement = index === 0 ? request.progress_ts : null;
      if (result.replace) replacement = request.input.messageTs;
      let sent;
      const send = (body) => replacement
        ? client.chat.update({ channel, ts: replacement, ...body })
        : client.chat.postMessage({ channel, thread_ts: threadTs || undefined,
          client_msg_id: uuidv5(`${request.id}:${index}`, uuidv5.URL), ...body });
      try {
        sent = await send({ ...payload, unfurl_links: false, unfurl_media: false });
      } catch (error) {
        if (error.data?.error !== "invalid_blocks") throw error;
        const fallback = payload.blocks.filter((block) => !["data_table", "markdown"].includes(block.type));
        if (payload.blocks.some((block) => block.type === "markdown")) {
          for (let offset = 0; offset < payload.text.length; offset += 2800) {
            fallback.push(section(payload.text.slice(offset, offset + 2800)));
          }
        } else {
          fallback.unshift(section("Open in Chartbrew to view the full result."));
        }
        await assertDeliveryAccess();
        try {
          sent = await send({ text: payload.text, blocks: fallback, unfurl_links: false, unfurl_media: false });
        } catch (fallbackError) {
          if (fallbackError.data?.error !== "invalid_blocks") throw fallbackError;
          await assertDeliveryAccess();
          sent = await send({ text: payload.text, blocks: [], unfurl_links: false, unfurl_media: false });
        }
      }
      messages.push({ channel, ts: sent.ts });
      await request.update({ messages });
      if (!thread.dm_thread_ts && !isShared) {
        threadTs = sent.ts;
        await thread.update({ dm_thread_ts: sent.ts });
      }
    }
  }
  if (result.replace && parent) {
    const remaining = (parent.messages || []).filter((message) => message.ts !== request.input.messageTs);
    await parent.update({ messages: remaining });
  }
}

async function runRequest(requestId) {
  const request = await db.SlackRequest.findByPk(requestId);
  if (!request || request.status === "complete") return;
  const identity = await resolveRequest(request);
  return withIntegrationContext({
    accountLinkInstructions: identity.account.id ? undefined : accounts.LINK_INSTRUCTIONS,
    integrationId: identity.integration.id, teamId: identity.access.teamId, userId: identity.account.user_id,
    resolveAccess: async () => (await resolveRequest(request)).access,
  }, () => withAiUsageContext({
    teamId: identity.access.teamId, source: "slack", integrationId: identity.integration.id, integrationRequestId: request.id,
  }, async () => {
    const client = new WebClient(identity.integration.config.bot_token);
    const resolved = request.result && request.thread_id
      ? { thread: await db.SlackThread.findOne({ where: { id: request.thread_id, integration_id: identity.integration.id } }), parent: request.input.parentId ? await db.SlackRequest.findByPk(request.input.parentId) : null }
      : await getThread(request, identity);
    const { thread, parent } = resolved;
    if (!thread) throw createHttpError("This conversation is unavailable. Start again.", 409);
    await assertSourceChannel(identity, thread.channel_id);
    await request.update({ thread_id: thread.id });
    if (!request.result && !request.input.requesterName) {
      const profile = await client.users.info({ user: request.input.slackUserId }).catch(() => null);
      const requesterName = profile?.user?.profile?.display_name || profile?.user?.real_name || profile?.user?.name;
      if (requesterName) await request.update({ input: { ...request.input, requesterName } });
    }
    if (!request.result) {
      if (!request.progress_ts && !["slack_refresh", "slack_period_submit", "slack_share"].includes(request.input.action)) {
        const progress = await client.chat.postMessage({ channel: thread.dm_channel,
          thread_ts: thread.dm_thread_ts || undefined, text: "Checking your request…", unfurl_links: false }).catch(() => null);
        if (progress) {
          await request.update({ progress_ts: progress.ts });
          if (!thread.dm_thread_ts) await thread.update({ dm_thread_ts: progress.ts });
        }
      }
      if (request.status === "running") {
        await request.update({ result: { message: "The previous request stopped before completion. Check Chartbrew before repeating a change.", cards: [] }, access_version: identity.envelope.accessVersion });
      } else {
        await request.update({ status: "running", access_version: identity.envelope.accessVersion });
        let result;
        try {
          const progressClient = new WebClient(identity.integration.config.bot_token, {
            retryConfig: { retries: 0 }, rejectRateLimitedCalls: true, timeout: 3000,
          });
          result = await withIntegrationContext({
            ...getIntegrationContext(),
            toolProgressCallback: createSlackProgress(progressClient, thread.dm_channel, request.progress_ts),
          }, () => withAiUsageContext({ teamId: identity.access.teamId, conversationId: thread.conversation_id },
            () => execute(request, identity, thread, parent)));
        } catch (error) {
          let message = error.statusCode ? error.message : "Chartbrew could not complete the request. Check Chartbrew before repeating a change.";
          if (error.statusCode === 402) message += " Ask a team owner to check billing in Chartbrew.";
          result = { message, error: "The request could not be completed.", cards: [] };
        }
        const latest = await resolveRequest(request);
        if (!canReadHistoryMessage({ sensitive_workspace_context: true,
          workspace_access_version: identity.envelope.accessVersion,
          workspace_access_scope: identity.envelope.historyAccessScope }, latest.envelope)) {
          result = { message: "Your access changed. Ask again in this thread.", cards: [] };
        }
        await request.update({ result, status: "delivering", access_version: latest.envelope.accessVersion });
      }
    }
    await deliver(request, identity, thread, parent, client);
    await request.update({ status: "complete", error: null });
  }));
}

async function processRequest(requestId) {
  try {
    await runRequest(requestId);
  } catch (error) {
    const request = await db.SlackRequest.findByPk(requestId);
    if (!request) return;
    await request.update({ error: error.statusCode ? error.message : "Slack could not receive the complete reply. Try again." });
    if (!error.statusCode) throw error;
    const integration = await accounts.getIntegration(request.input.workspaceId).catch(() => null);
    if (integration) {
      await new WebClient(integration.config.bot_token).chat.postMessage({
        channel: request.input.channelId, thread_ts: request.input.threadTs || undefined, text: error.message, unfurl_links: false, unfurl_media: false,
      });
    }
    await request.update({ status: "complete" });
  }
}

async function openActionModal(interaction) {
  const selected = interaction.actions[0];
  const [parentId, index] = String(selected.value).split(":");
  const identity = await accounts.resolveAccount(interaction.team.id, interaction.user.id);
  const input = { parentId, cardIndex: Number(index), messageTs: interaction.message.ts,
    channelId: interaction.channel.id, workspaceId: interaction.team.id, slackUserId: interaction.user.id };
  const client = new WebClient(identity.integration.config.bot_token);
  const { parent } = await getThread({ input }, identity);
  const card = parent.result.cards[input.cardIndex];
  if (!card) throw createHttpError("This chart is unavailable. Ask again.", 409);
  const current = await withIntegrationContext({
    integrationId: identity.integration.id, teamId: identity.access.teamId, userId: identity.account.user_id,
    resolveAccess: async () => (await accounts.resolveAccount(interaction.team.id, interaction.user.id)).access,
  }, () => loadChart(card.chart.id, identity));
  let blocks;
  const placing = selected.action_id === "slack_place";
  if (placing) {
    const projects = await editableDashboards(identity);
    if (!projects.length) throw createHttpError("You cannot add charts to a dashboard.", 403);
    blocks = [{ type: "input", block_id: "dashboard", label: plain("Dashboard"), element: {
      type: "static_select", action_id: "value", options: projects.slice(0, 100).map((project) => ({ text: plain(project.name, 75), value: String(project.id) })),
    } }];
    input.version = card.chart.configurationVersion;
  } else {
    if (!current.canQuery || !current.chart.isTimeseries) throw createHttpError("This chart does not support period changes.", 403);
    blocks = ["start", "end"].map((name) => ({ type: "input", block_id: name,
      label: plain(name === "start" ? "Start date" : "End date"), element: { type: "datepicker", action_id: "value" } }));
  }
  await client.views.open({ trigger_id: interaction.trigger_id, view: {
    type: "modal", callback_id: placing ? "slack_place_submit" : "slack_period_submit",
    title: plain(placing ? "Add to dashboard" : "Change period"), submit: plain(placing ? "Add chart" : "Apply"),
    close: plain("Cancel"), private_metadata: JSON.stringify(input), blocks,
  } });
}

module.exports = { channelAllowed, enqueue, openActionModal, processRequest, resolveRequest };
