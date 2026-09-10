const db = require("../../models/models");
const { getIntelligencePolicy } = require("../intelligence/policy");
const { recordIntelligenceEvent } = require("./observability");

function normalizeTerms(query) {
  return [...new Set(
    `${query || ""}`.slice(0, 500).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  )].slice(0, 20);
}

function getPathScopeTerms(value) {
  return [...`${value || ""}`.toLowerCase().matchAll(/(?:^|[\s(])(\/[a-z0-9][a-z0-9/_-]*)/g)]
    .flatMap((match) => normalizeTerms(match[1]));
}

function buildSearchText(dataset, profile) {
  const values = [
    dataset.name,
    dataset.legend,
    profile?.dataset?.summary,
    profile?.dataset?.grain,
    ...Object.keys(profile?.fields || {}),
    ...(profile?.usage?.analyses || []).flatMap((item) => [
      item.chartName,
      item.dashboardName,
    ]),
  ];
  return values.filter(Boolean).join(" ").toLowerCase();
}

function scoreDataset(dataset, profile, query) {
  const terms = normalizeTerms(query);
  if (terms.length === 0) return { score: 0, reasons: [] };

  const name = `${dataset.name || dataset.legend || ""}`.toLowerCase();
  if (getPathScopeTerms(name).some((term) => !terms.includes(term))) {
    return { score: 0, reasons: ["scope_mismatch"] };
  }
  const summary = `${profile?.dataset?.summary || ""}`.toLowerCase();
  const fields = Object.keys(profile?.fields || {}).join(" ").toLowerCase();
  const usage = (profile?.usage?.analyses || [])
    .flatMap((item) => [item.chartName, item.dashboardName])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const allText = buildSearchText(dataset, profile);
  let score = 0;
  const reasons = [];

  terms.forEach((term) => {
    if (name.includes(term)) {
      score += 8;
      reasons.push("dataset_name");
    }
    if (summary.includes(term)) {
      score += 5;
      reasons.push("dataset_summary");
    }
    if (fields.includes(term)) {
      score += 3;
      reasons.push("field");
    }
    if (usage.includes(term)) {
      score += 4;
      reasons.push("existing_chart");
    }
    if (allText.includes(term)) score += 1;
  });

  return {
    score,
    reasons: [...new Set(reasons)],
  };
}

function summarizeCandidate(dataset, intelligence, score) {
  const profile = intelligence?.profile;
  return {
    dataset_id: dataset.id,
    name: dataset.name || dataset.legend || `Dataset ${dataset.id}`,
    summary: profile?.dataset?.summary || null,
    grain: profile?.dataset?.grain || null,
    metrics: (profile?.monitoring?.candidateMetrics || []).slice(0, 5),
    dimensions: (profile?.monitoring?.candidateSegments || []).slice(0, 5),
    defaultTimeField: profile?.monitoring?.defaultTimeField || null,
    charts: (profile?.usage?.analyses || []).slice(0, 5).map((item) => ({
      id: item.chartId,
      name: item.chartName,
      dashboardId: item.dashboardId,
      dashboardName: item.dashboardName,
    })),
    profileStatus: intelligence?.status === "ready"
      && intelligence.expires_at
      && new Date(intelligence.expires_at).getTime() <= Date.now()
      ? "stale"
      : intelligence?.status || "missing",
    relevance: score.score,
    relevanceReasons: score.reasons,
  };
}

async function searchDatasetProfiles({
  teamId,
  query,
  projectId,
  allowedProjectIds,
  limit = 5,
}) {
  const startedAt = Date.now();
  const policy = (await getIntelligencePolicy({ teamId })).datasetIntelligence;
  if (!policy.enabled) return { datasets: [], status: "disabled" };

  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 5, 1), 20);
  const datasets = await db.Dataset.findAll({
    where: { team_id: teamId, draft: false },
    attributes: ["id", "name", "legend", "project_ids"],
    include: [{
      model: db.DatasetIntelligence,
      required: false,
      attributes: ["dataset_id", "status", "profile", "generated_at", "expires_at"],
    }],
    limit: 500,
    order: [["updatedAt", "DESC"]],
  });

  const accessible = datasets.filter((dataset) => {
    const projectIds = dataset.project_ids || [];
    if (projectId && !projectIds.includes(Number(projectId))) return false;
    if (Array.isArray(allowedProjectIds)) {
      return projectIds.some((id) => allowedProjectIds.includes(id));
    }
    return true;
  });

  const candidates = accessible.map((dataset) => {
    const intelligence = dataset.DatasetIntelligence;
    const score = scoreDataset(dataset, intelligence?.profile, query);
    return summarizeCandidate(dataset, intelligence, score);
  });

  const result = {
    datasets: candidates
      .filter((candidate) => !query || candidate.relevance > 0)
      .sort((left, right) => right.relevance - left.relevance)
      .slice(0, safeLimit),
    truncated: datasets.length === 500,
  };
  recordIntelligenceEvent("search_completed", {
    teamId,
    durationMs: Date.now() - startedAt,
    candidateCount: result.datasets.length,
    selectedDatasetId: result.datasets[0]?.dataset_id,
    relevance: result.datasets[0]?.relevance || 0,
    truncated: result.truncated,
    status: "completed",
  });
  return result;
}

module.exports = {
  buildSearchText,
  normalizeTerms,
  scoreDataset,
  searchDatasetProfiles,
  summarizeCandidate,
};
