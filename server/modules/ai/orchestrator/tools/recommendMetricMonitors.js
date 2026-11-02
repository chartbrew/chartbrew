const MetricRecommendationController = require("../../../../controllers/MetricRecommendationController");
const { getObservationAccess } = require("../../../observations/access");
const { serializeRecommendation } = require("../../../observations/metricRecommendations");

async function recommendMetricMonitors(payload) {
  const access = await getObservationAccess(payload.team_id, payload.user_id);
  const limit = Math.min(Math.max(Number(payload.limit) || 5, 1), 20);
  const recommendations = await new MetricRecommendationController().generate(access, {
    includeDismissed: false,
    limit: 100,
  });
  const projectId = payload.project_id ? Number(payload.project_id) : null;
  return {
    items: recommendations
      .filter((recommendation) => !projectId
        || Number(recommendation.project?.id) === projectId)
      .slice(0, limit)
      .map(serializeRecommendation),
    truncated: recommendations.length > limit,
  };
}

module.exports = recommendMetricMonitors;
