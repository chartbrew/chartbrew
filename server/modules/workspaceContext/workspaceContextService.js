const { Op } = require("sequelize");

const DigestController = require("../../controllers/DigestController");
const MonitorController = require("../../controllers/MonitorController");
const db = require("../../models/models");
const { assertCanViewProject } = require("../observations/access");
const {
  getContextLimits,
  truncateContextSections,
} = require("./contextLimits");
const { getWorkspaceLearningProjection } = require("./workspaceLearningProjection");
const { getWorkspaceOrchestratorPolicy } = require("./policy");

const ALLOWED_SECTIONS = new Set([
  "account",
  "business_profile",
  "dashboards",
  "datasets",
  "kpiReviews",
  "learning",
  "watches",
]);

function normalizeSections(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    const error = new Error("Choose the workspace context needed for this task");
    error.statusCode = 400;
    throw error;
  }
  const normalized = [...new Set(sections.map((section) => `${section}`))];
  if (normalized.some((section) => !ALLOWED_SECTIONS.has(section))) {
    const error = new Error("Choose valid workspace context sections");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function isDatasetVisible(dataset, access, projectId) {
  const projectIds = Array.isArray(dataset.project_ids)
    ? dataset.project_ids.map(Number)
    : [];
  if (projectId) return projectIds.includes(Number(projectId));
  return access.allProjects || projectIds.some((id) => access.projectIds.includes(id));
}

function getDatasetProfileSummary(dataset) {
  const intelligence = dataset.DatasetIntelligence;
  if (!intelligence || intelligence.status !== "ready") return null;
  if (intelligence.expires_at && new Date(intelligence.expires_at) <= new Date()) return null;
  const profile = intelligence.profile || {};
  const fields = Object.entries(profile.fields || {})
    .filter(([, field]) => Number(field?.confidence) >= 0.8)
    .slice(0, 8)
    .map(([path, field]) => ({
      aggregation: field.defaultAggregation || null,
      path,
      role: field.role || null,
    }));
  return {
    fields,
    primaryTimeField: profile.primaryTimeField || null,
  };
}

async function readWatches(access, envelope, projectId, limit) {
  const monitors = await new MonitorController().list(access);
  return monitors
    .filter((monitor) => !projectId || Number(monitor.projectId) === Number(projectId))
    .slice(0, limit)
    .map((monitor) => ({
      active: monitor.active,
      canEdit: envelope.editableProjectIds.includes(Number(monitor.projectId)),
      chart: monitor.chartId ? { id: monitor.chartId, name: monitor.chartName } : null,
      comparison: monitor.comparison,
      desiredDirection: monitor.desiredDirection,
      id: monitor.id,
      importance: monitor.importance,
      metricBehavior: monitor.metricBehavior,
      name: monitor.name,
      project: monitor.projectId ? { id: monitor.projectId, name: monitor.projectName } : null,
      status: monitor.status,
      statusReason: monitor.statusReason,
      threshold: monitor.threshold,
      valueFormat: monitor.valueFormat,
    }));
}

async function readKpiReviews(access, projectId, limit) {
  const subscriptions = await new DigestController().list(access);
  return subscriptions
    .filter((subscription) => !projectId
      || Number(subscription.projectId) === Number(projectId)
      || Number(subscription.scope?.projectId) === Number(projectId))
    .slice(0, limit)
    .map((subscription) => ({
      cadence: subscription.cadence,
      contentMode: subscription.contentMode,
      dayOfMonth: subscription.dayOfMonth,
      dayOfWeek: subscription.dayOfWeek,
      deliveryDays: subscription.deliveryDays,
      enabled: subscription.enabled,
      id: subscription.id,
      lastDelivery: subscription.lastDelivery,
      localDeliveryTime: subscription.localDeliveryTime,
      nextDeliveryAt: subscription.nextDeliveryAt,
      scope: subscription.scope,
      timezone: subscription.timezone,
    }));
}

async function readDashboards(access, projectId, limit) {
  let projectScope = {};
  if (projectId) projectScope = { id: projectId };
  else if (!access.allProjects) {
    projectScope = {
      id: { [Op.in]: access.projectIds.length > 0 ? access.projectIds : [-1] },
    };
  }
  const [projects, pins] = await Promise.all([
    db.Project.findAll({
      include: [{ model: db.Chart, attributes: ["id"], required: false }],
      limit: Math.min(limit, 25),
      order: [["lastUpdatedAt", "DESC"], ["updatedAt", "DESC"]],
      where: {
        ghost: false,
        team_id: access.teamId,
        ...projectScope,
      },
    }),
    db.PinnedDashboard.findAll({
      attributes: ["project_id"],
      where: { team_id: access.teamId, user_id: access.userId },
    }),
  ]);
  const pinnedIds = new Set(pins.map((pin) => Number(pin.project_id)));
  return projects.map((project) => ({
    chartCount: project.Charts?.length || 0,
    id: project.id,
    lastUpdatedAt: project.lastUpdatedAt || project.updatedAt,
    name: project.name,
    pinned: pinnedIds.has(Number(project.id)),
  }));
}

async function readDatasets(access, projectId, query, limit) {
  const datasets = await db.Dataset.findAll({
    attributes: ["id", "name", "project_ids", "updatedAt"],
    include: [{
      model: db.DatasetIntelligence,
      attributes: ["expires_at", "profile", "status"],
      required: false,
    }],
    limit: 200,
    order: [["updatedAt", "DESC"]],
    where: { draft: false, team_id: access.teamId },
  });
  const search = `${query || ""}`.trim().toLowerCase().slice(0, 100);
  return datasets
    .filter((dataset) => isDatasetVisible(dataset, access, projectId))
    .filter((dataset) => !search || `${dataset.name || ""}`.toLowerCase().includes(search))
    .slice(0, limit)
    .map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      profile: getDatasetProfileSummary(dataset),
      updatedAt: dataset.updatedAt,
    }));
}

function readAccount(envelope) {
  return {
    aiAvailable: envelope.canUseExternalAi,
    canConfigureConnections: envelope.canConfigureConnections,
    canEditWatchedMetrics: envelope.editableProjectIds.length > 0,
    canConfirmKpiReview: envelope.kpiReviewWritesEnabled,
    canConfirmWatchedMetric: envelope.metricMonitorWritesEnabled
      && envelope.editableProjectIds.length > 0,
    canSchedulePersonalReview: envelope.canCreatePersonalKpiReview,
    hasDeliveryEmail: envelope.hasDeliveryEmail,
  };
}

async function readBusinessProfile(access) {
  const profile = await db.TeamBusinessProfile.findOne({
    attributes: ["businessName", "description", "domain", "metadata"],
    include: [{
      model: db.Team,
      attributes: ["useCases"],
    }],
    where: {
      aiContextAllowed: true,
      team_id: access.teamId,
    },
  });
  if (!profile) return null;
  return {
    businessName: profile.businessName,
    description: profile.description,
    domain: profile.domain,
    metadata: profile.metadata || {},
    useCases: profile.Team?.useCases || null,
  };
}

async function readWorkspaceContext(access, envelope, input = {}) {
  const policy = getWorkspaceOrchestratorPolicy();
  const sections = normalizeSections(input.sections);
  const projectId = input.projectId ? Number(input.projectId) : null;
  if (projectId) assertCanViewProject(access, projectId);
  const limits = getContextLimits({
    dashboards: input.limitPerSection,
    datasets: input.limitPerSection,
    kpiReviews: input.limitPerSection,
    watches: input.limitPerSection,
  });
  const context = {};
  const coverage = {};

  await Promise.all(sections.map(async (section) => {
    if (section === "account") context.account = readAccount(envelope);
    if (section === "business_profile") {
      if (envelope.workspaceOrchestratorEnabled === false
        || (input.externalProvider && !envelope.canUseExternalWorkspaceContext)) {
        coverage.businessProfileUnavailable = true;
        return;
      }
      const profile = await readBusinessProfile(access);
      if (profile) context.business_profile = profile;
      else coverage.businessProfileUnavailable = true;
    }
    if (section === "watches") {
      context.watches = await readWatches(access, envelope, projectId, limits.watches);
    }
    if (section === "kpiReviews") {
      context.kpiReviews = await readKpiReviews(access, projectId, limits.kpiReviews);
    }
    if (section === "dashboards") {
      context.dashboards = await readDashboards(access, projectId, limits.dashboards);
    }
    if (section === "datasets") {
      context.datasets = await readDatasets(
        access,
        projectId,
        input.query,
        limits.datasets
      );
    }
    if (section === "learning") {
      if (input.externalProvider && !policy.externalLearningContextEnabled) {
        context.learning = [];
        coverage.learningUnavailable = true;
        return;
      }
      const learning = await getWorkspaceLearningProjection(access, {
        limits,
        maximumAgeDays: input.maximumAgeDays,
        metricKey: input.metricKey,
        monitorId: input.monitorId,
        projectId,
        task: input.task,
      });
      context.learning = learning.items;
      coverage.learningLowSample = learning.lowSample;
      coverage.learningTruncated = learning.truncated;
    }
  }));
  Object.entries(context).forEach(([section, value]) => {
    coverage[`${section}Count`] = Array.isArray(value) ? value.length : 1;
  });
  const bounded = truncateContextSections(context, limits.totalCharacters);
  return {
    ...bounded.context,
    coverage: {
      ...coverage,
      characterCount: bounded.characterCount,
      requestedSections: sections,
      truncated: bounded.truncated,
    },
  };
}

module.exports = {
  ALLOWED_SECTIONS,
  getDatasetProfileSummary,
  isDatasetVisible,
  normalizeSections,
  readBusinessProfile,
  readWorkspaceContext,
};
