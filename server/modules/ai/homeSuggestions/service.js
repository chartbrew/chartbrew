/* oxlint-disable no-await-in-loop */
const { randomUUID } = require("crypto");
const { Op } = require("sequelize");
const db = require("../../../models/models");
const { getObservationAccess, getProjectScope, createHttpError } = require("../../observations/access");
const { getWorkspaceAccessEnvelope } = require("../../workspaceContext/accessEnvelope");
const { getWorkspaceOrchestratorPolicy } = require("../../workspaceContext/policy");
const { buildContextManifest } = require("../../workspaceContext/contextManifest");
const { searchAiContext, validateAiContext, serializeAiContext } = require("../contextAuthorization");
const { sanitizeUserRequest } = require("../orchestrator/runtime/egressBoundary");
const { callAiProvider, withAiUsageContext } = require("../usage");
const { DAY, INTERVAL, PROMPT, allowedActions, hash, isDue, validateOutput } = require("./rules");

const MANUAL_INTERVAL = 5 * 60000;

function scope(access) {
  return { team_id: access.teamId, user_id: access.userId };
}

async function settings(access) {
  const [team, envelope] = await Promise.all([
    db.Team.findByPk(access.teamId, { attributes: ["aiEnabled", "aiSuggestionsEnabled", "updatedAt"] }),
    getWorkspaceAccessEnvelope(access),
  ]);
  const policy = getWorkspaceOrchestratorPolicy();
  return {
    enabled: team?.aiEnabled !== false && team?.aiSuggestionsEnabled === true
      && envelope.canUseExternalWorkspaceContext,
    version: hash([envelope.accessVersion, team?.updatedAt, policy]),
    envelope,
    policy,
  };
}

async function stateFor(access) {
  const [state] = await db.AiHomeState.findOrCreate({ where: scope(access), defaults: { payload: {} } });
  return state;
}

async function recordActivity(access, context = []) {
  const config = await settings(access);
  if (!config.enabled) return;
  const entities = context.length ? await validateAiContext(access, context) : [];
  const state = await stateFor(access);
  const now = new Date();
  if (entities.length === 0 && state.payload.captureVersion === config.version
    && now - new Date(state.last_active_at) < 5 * 60000) return;
  const visited = entities.map((item) => `${item.entityType}:${item.entityId}`);
  const recent = [...new Set([...visited, ...(state.payload.recent || [])])].slice(0, 10);
  const edits = [
    ...entities.filter((item) => ["chart", "dataset"].includes(item.entityType))
      .map((item) => ({ ref: `${item.entityType}:${item.entityId}`, at: now.toISOString() })),
    ...(state.payload.edits || []).filter((item) => !visited.includes(item.ref)),
  ].slice(0, 10);
  await db.AiHomeState.update({
    last_active_at: now,
    payload: {
      ...state.payload, recent, edits, captureVersion: config.version,
      captureSince: state.payload.captureVersion === config.version ? state.payload.captureSince : now.toISOString(),
    },
    revision: state.revision + 1,
  }, { where: { ...scope(access), revision: state.revision } });
}

function log(status) {
  console.info("[homeSuggestions]", { status }); // oxlint-disable-line no-console
}

async function recordUserActivity(teamId, userId, context = []) {
  try {
    await recordActivity(await getObservationAccess(teamId, userId), context);
  } catch (error) {
    log("activity_unavailable");
  }
}

async function recordSubmission(teamId, userId, message) {
  if (typeof message !== "string") return false;
  try {
    const state = await db.AiHomeState.findOne({ where: { team_id: teamId, user_id: userId } });
    const matched = (state?.payload.suggestions || []).some((item) => item.prompt === message.trim());
    if (matched) log("submitted");
    return matched;
  } catch (error) {
    return false;
  }
}

function refContext(ref) {
  const [entityType, entityId] = ref.split(":");
  return { entityType, entityId };
}

async function snapshotFor(access, state, config, now = new Date()) {
  const options = await Promise.all(["project", "chart", "dataset"].map((type) => (
    searchAiContext(access, { type, limit: 5 })
  )));
  const resources = options.flat().map((item) => ({
    ref: `${item.entity_type}:${item.id}`,
    name: sanitizeUserRequest(item.name, 100),
    projectId: item.project_id,
  }));
  for (const ref of [...new Set([...(state.payload.edits || []).map((item) => item.ref),
    ...(config.policy.weakAttentionSignalsEnabled ? state.payload.recent || [] : [])])].slice(0, 10)) {
    if (!resources.some((item) => item.ref === ref)) {
      try {
        const [item] = await validateAiContext(access, [refContext(ref)]);
        resources.unshift({ ref, name: sanitizeUserRequest(item.name, 100), projectId: item.projectId });
      } catch (error) {
        if (![400, 403, 404].includes(error.statusCode)) throw error;
      }
    }
  }
  (state.payload.edits || []).forEach((edit) => {
    const resource = resources.find((item) => item.ref === edit.ref);
    if (resource) resource.lastUserEdit = { at: edit.at };
  });
  const chartIds = resources.filter((item) => item.ref.startsWith("chart:")).map((item) => Number(item.ref.split(":")[1]));
  const versions = chartIds.length ? await db.ChartVersion.findAll({
    attributes: ["chart_id", "version", "createdAt", "origin"],
    where: { chart_id: { [Op.in]: chartIds }, user_id: access.userId, origin: { [Op.in]: ["manual", "ai", "restore"] } },
    order: [["createdAt", "DESC"]], limit: 10,
  }) : [];
  versions.forEach((version) => {
    const resource = resources.find((item) => item.ref === `chart:${version.chart_id}`);
    if (resource && !resource.lastUserEdit) resource.lastUserEdit = { version: version.version, at: version.createdAt };
  });
  const evidence = [];
  const observations = await db.Observation.findAll({
    attributes: ["id", "title", "project_id"],
    where: { team_id: access.teamId, ...getProjectScope(access), status: "open" },
    order: [["last_detected_at", "DESC"]], limit: 3,
  });
  observations.forEach((item) => resources.push({
    ref: `observation:${item.id}`, name: sanitizeUserRequest(item.title, 100), projectId: item.project_id,
  }));
  const captureSince = state.payload.captureVersion === config.version ? state.payload.captureSince : now;
  const cutoff = new Date(Math.max(now.getTime() - 30 * DAY,
    new Date(state.forgotten_before || 0).getTime(), new Date(captureSince || now).getTime()));
  if (config.policy.externalLearningContextEnabled) {
    const [memories, conversations] = await Promise.all([
      db.AiMemory.findAll({ where: scope(access), order: [["updatedAt", "DESC"]], limit: 10 }),
      db.AiConversation.findAll({
        where: { ...scope(access), status: { [Op.in]: ["active", "completed"] }, updatedAt: { [Op.gt]: cutoff } },
        attributes: ["id"], order: [["updatedAt", "DESC"]], limit: 5,
      }),
    ]);
    memories.forEach((item) => evidence.push({
      ref: `memory:${item.id}`, kind: "memory", text: sanitizeUserRequest(item.text, 500),
    }));
    for (const conversation of conversations) {
      const [links, messages] = await Promise.all([
        db.AiConversationContext.findAll({ where: { conversation_id: conversation.id, team_id: access.teamId } }),
        db.AiMessage.findAll({
          where: { conversation_id: conversation.id, role: { [Op.in]: ["user", "assistant"] }, createdAt: { [Op.gt]: cutoff } },
          attributes: ["id", "role", "sequence", "content", "createdAt", "sensitive_workspace_context", "workspace_access_version"],
          order: [["sequence", "DESC"]], limit: 6,
        }),
      ]);
      try {
        const context = await validateAiContext(access, links);
        if (links.length && context.length !== links.length) throw createHttpError("Context is not available", 403);
        context.forEach((item) => {
          const ref = `${item.entityType}:${item.entityId}`;
          if (!resources.some((resource) => resource.ref === ref)) resources.push({
            ref, name: sanitizeUserRequest(item.name, 100), projectId: item.projectId,
          });
        });
        messages.filter((item) => item.role === "user" && !(state.payload.forgottenSources || []).includes(`chat:${item.id}`)
          && !/^\/remember\b/i.test(item.content || "")
          && (!item.sensitive_workspace_context || item.workspace_access_version === config.envelope.accessVersion))
          .slice(0, 3).forEach((item) => evidence.push({
            answered: messages.some((reply) => reply.role === "assistant" && reply.sequence > item.sequence && reply.content),
            ref: `chat:${item.id}`, kind: "chat", conversationId: conversation.id,
            text: sanitizeUserRequest(item.content, 500), activityAt: item.createdAt.toISOString(),
          }));
      } catch (error) {
        if (![400, 403, 404].includes(error.statusCode)) throw error;
      }
    }
  }
  const recent = config.policy.weakAttentionSignalsEnabled ? state.payload.recent || [] : [];
  resources.sort((a, b) => (new Date(b.lastUserEdit?.at || 0) - new Date(a.lastUserEdit?.at || 0))
    || Number(recent.includes(b.ref)) - Number(recent.includes(a.ref)) || a.ref.localeCompare(b.ref));
  const dependencies = {
    resources: resources.map((item) => item.ref),
    chats: evidence.filter((item) => item.kind === "chat").map((item) => item.ref.slice(5)),
    memories: evidence.filter((item) => item.kind === "memory").map((item) => item.ref.slice(7)),
  };
  const snapshot = {
    actions: allowedActions(access, config.envelope, config.policy),
    resources: resources.slice(0, 20), evidence,
  };
  // UTF-8 bytes bound token use conservatively, including languages with short tokens.
  while (Buffer.byteLength(PROMPT + JSON.stringify(snapshot), "utf8") > 5500) {
    if (snapshot.evidence.length) snapshot.evidence.pop();
    else if (snapshot.resources.length) snapshot.resources.pop();
    else throw new Error("Suggestion instructions exceed the input limit");
  }
  const inputHashes = [...snapshot.resources, ...snapshot.evidence].map(hash);
  const signature = hash([config.version, snapshot]);
  const sources = new Set(snapshot.evidence.map((item) => item.ref));
  const work = state.payload.accessVersion === config.version
    ? (state.payload.memories || []).filter((item) => sources.has(item.source)
      && item.sourceHash === hash(snapshot.evidence.find((entry) => entry.ref === item.source))
      && new Date(item.activityAt) > now - 30 * DAY) : [];
  const result = { ...snapshot, work };
  while (result.work.length && Buffer.byteLength(PROMPT + JSON.stringify(result), "utf8") > 5500) result.work = result.work.slice(0, -1);
  return { ...result, signature, accessVersion: config.version, dependencies, inputHashes };
}

async function readState(access) {
  const state = await db.AiHomeState.findOne({ where: scope(access) });
  if (!state) return { suggestions: [], memories: [] };
  const config = await settings(access);
  if (!config.enabled) return { suggestions: [], memories: [] };
  const snapshot = await snapshotFor(access, state, config);
  if (snapshot.signature !== state.signature) return { suggestions: [], memories: [] };
  const payload = state.payload;
  const now = new Date();
  const memories = config.policy.externalLearningContextEnabled
    ? (payload.memories || []).filter((item) => new Date(item.activityAt) > now - 30 * DAY) : [];
  if (!payload.generatedAt || new Date(payload.generatedAt) < now - 7 * DAY) return { suggestions: [], memories };
  const suggestions = [];
  for (const item of payload.suggestions || []) {
    try {
      const context = await validateAiContext(access, item.refs.map(refContext));
      suggestions.push({ id: item.id, title: item.title, prompt: item.prompt, context: serializeAiContext(context) });
    } catch (error) {
      if (![400, 403, 404].includes(error.statusCode)) throw error;
    }
  }
  return { suggestions, memories };
}

async function readSuggestions(access) {
  try { return (await readState(access)).suggestions; }
  catch (error) { log("read_unavailable"); return []; }
}

async function readRecentWork(access) {
  const state = await db.AiHomeState.findOne({ where: scope(access) });
  if (!state) return [];
  const config = await settings(access);
  const scopeVersion = hash([access.role, config.envelope.visibleProjectIds]);
  if (state.payload.scopeVersion !== scopeVersion) return [];
  const dependencies = state.payload.dependencies;
  if (!dependencies) return [];
  try {
    for (let index = 0; index < dependencies.resources.length; index += 10) {
      await validateAiContext(access, dependencies.resources.slice(index, index + 10).map(refContext));
    }
    const [messages, memories] = await Promise.all([
      db.AiMessage.count({
        where: { id: dependencies.chats },
        include: [{ model: db.AiConversation, required: true, where: scope(access), attributes: [] }],
      }),
      db.AiMemory.count({ where: { ...scope(access), id: dependencies.memories } }),
    ]);
    if (messages !== dependencies.chats.length || memories !== dependencies.memories.length) return [];
  } catch (error) {
    if ([400, 403, 404].includes(error.statusCode)) return [];
    throw error;
  }
  const result = [];
  for (const item of state.payload.memories || []) {
    const message = await db.AiMessage.findOne({
      where: { id: item.source.slice(5), role: "user" },
      include: [{ model: db.AiConversation, required: true, where: scope(access), attributes: ["id"] }],
    });
    if (message && new Date(item.activityAt) > Date.now() - 30 * DAY) {
      const links = await db.AiConversationContext.findAll({ where: { conversation_id: message.conversation_id, team_id: access.teamId } });
      try {
        await validateAiContext(access, links);
        result.push({ id: item.id, text: item.text, intent: item.intent });
      } catch (error) {
        if (![400, 403, 404].includes(error.statusCode)) throw error;
      }
    }
  }
  return result;
}

async function changeState(access, { forget = false, forgetId } = {}) {
  return db.sequelize.transaction(async (transaction) => {
    const state = await db.AiHomeState.findOne({ where: scope(access), transaction, lock: transaction.LOCK.UPDATE });
    if (!state) return;
    const payload = state.payload;
    const now = new Date();
    const memory = (payload.memories || []).find((item) => item.id === forgetId);
    if (forgetId && !memory) throw createHttpError("Memory is no longer available.", 404);
    const forgottenSources = [...new Set([...(payload.forgottenSources || []), ...(memory ? [memory.source] : [])])];
    await state.update({
      payload: {
        ...payload, suggestions: [],
        memories: forget ? [] : payload.memories.filter((item) => item.id !== forgetId),
        forgottenSources: forgottenSources.slice(-100),
      },
      signature: null,
      forgotten_before: forget || forgottenSources.length > 100 ? now : state.forgotten_before,
      revision: state.revision + 1,
    }, { transaction });
  });
}

async function requestRefresh(access, queue) {
  if (!(await settings(access)).enabled) throw createHttpError("Enable AI and personalized suggestions first.", 403);
  if (!queue) throw createHttpError("Refresh is unavailable. Try again later.", 503);
  const state = await db.AiHomeState.findOne({ where: scope(access) });
  if (state?.last_attempt_at && Date.now() - new Date(state.last_attempt_at) < MANUAL_INTERVAL) {
    throw createHttpError("Suggestions were refreshed recently. Try again in five minutes.", 429);
  }
  await recordActivity(access);
  await queue.add("homeSuggestions", { teamId: access.teamId, userId: access.userId, manual: true }, {
    deduplication: { id: `home-suggestions-manual-${access.teamId}-${access.userId}` },
    attempts: 1,
  });
}

async function generate(teamId, userId, dependencies = {}) {
  const now = dependencies.now || new Date();
  const access = await getObservationAccess(teamId, userId);
  const config = await settings(access);
  if (!config.enabled) return "disabled";
  const state = await db.AiHomeState.findOne({ where: scope(access) });
  if (!state) return "inactive";
  const snapshot = await snapshotFor(access, state, config, now);
  const interval = dependencies.manual === true ? MANUAL_INTERVAL : INTERVAL;
  if (dependencies.manual !== true && !isDue(state, snapshot.signature, now, snapshot)) return "unchanged_or_inactive";
  if (!snapshot.resources.length || !snapshot.actions.length) return "no_evidence";
  const [claimed] = await db.AiHomeState.update({ last_attempt_at: now }, {
    where: {
      ...scope(access), revision: state.revision,
      [Op.or]: [{ last_attempt_at: null }, { last_attempt_at: { [Op.lte]: new Date(now - interval) } }],
    },
  });
  if (!claimed) return "already_claimed";
  const beforeAccess = await getObservationAccess(teamId, userId);
  const beforeConfig = await settings(beforeAccess);
  if (!beforeConfig.enabled || beforeConfig.version !== config.version) return "discarded";
  const beforeState = await db.AiHomeState.findOne({ where: scope(access) });
  if (!beforeState || beforeState.revision !== state.revision) return "discarded";
  const beforeSnapshot = await snapshotFor(beforeAccess, beforeState, beforeConfig, now);
  if (beforeSnapshot.signature !== snapshot.signature) return "discarded";
  // Load the provider after startup to avoid the controller/module import cycle.
  // oxlint-disable-next-line node/global-require
  const provider = dependencies.provider || require("../orchestrator/orchestrator").getChartCreationProvider();
  const { signature, accessVersion, dependencies: evidenceDependencies, inputHashes, ...input } = snapshot;
  const response = await withAiUsageContext({ teamId, activity: "internal" }, () => callAiProvider({
    client: provider.client,
    purpose: "home_suggestions",
    contextManifest: buildContextManifest({
      context: { resources: input.resources, memory: input.evidence }, purpose: "home_suggestions",
      externalProviderUsed: true, modelRoleCalls: { synthesis: 1 }, resultStatus: "requested",
      projectIds: input.resources.map((item) => item.projectId).filter(Boolean),
    }),
    request: {
      model: provider.model,
      instructions: PROMPT,
      input: `Return JSON for this evidence:\n${JSON.stringify(input)}`,
      max_output_tokens: 1500,
      text: { format: { type: "json_object" } },
    },
    options: { timeout: 60000, maxRetries: 0 },
  }));
  const text = response.output_text || response.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("");
  const output = validateOutput(JSON.parse(text), snapshot);
  const freshAccess = await getObservationAccess(teamId, userId);
  const freshConfig = await settings(freshAccess);
  if (!freshConfig.enabled) return "discarded";
  const freshState = await db.AiHomeState.findOne({ where: scope(access) });
  if (!freshState || freshState.revision !== state.revision) return "discarded";
  const freshSnapshot = await snapshotFor(freshAccess, freshState, freshConfig, now);
  if (freshSnapshot.signature !== signature) return "discarded";
  const [saved] = await db.AiHomeState.update({
    signature,
    revision: state.revision + 1,
    payload: {
      ...state.payload, generatedAt: now.toISOString(), accessVersion,
      dependencies: evidenceDependencies, inputHashes,
      scopeVersion: hash([access.role, config.envelope.visibleProjectIds]),
      suggestions: output.suggestions.map((item) => ({ ...item, id: randomUUID() })),
      memories: output.memories.map((item) => ({
        ...item, id: randomUUID(), sourceHash: hash(snapshot.evidence.find((entry) => entry.ref === item.source)),
      })),
    },
  }, { where: { ...scope(access), revision: state.revision, last_attempt_at: now } });
  if (!saved) return "discarded";
  return output.suggestions.length ? "generated" : "no_suggestions";
}

module.exports = { changeState, generate, log, readRecentWork, readState, readSuggestions, recordActivity, recordSubmission, recordUserActivity, requestRefresh, settings, snapshotFor };
