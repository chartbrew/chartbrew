const HomeController = require("../../../../controllers/HomeController");
const { getObservationAccess } = require("../../../observations/access");

function serializeChange(change) {
  return {
    baselineValue: change.baselineValue,
    chart: change.chart?.name || null,
    comparisonLabel: change.comparisonLabel || null,
    comparisonPeriod: change.comparisonPeriod,
    currentValue: change.currentValue,
    currentPeriod: change.currentPeriod,
    direction: change.direction,
    impact: change.impact,
    lastDetectedAt: change.lastDetectedAt,
    project: change.project?.name || null,
    relativeDelta: change.relativeDelta,
    severity: change.severity,
    summary: change.summary,
    title: change.title,
    unit: change.unit,
  };
}

async function getWorkspaceActivity(payload) {
  const access = await getObservationAccess(payload.team_id, payload.user_id);
  const home = await new HomeController().getHome(access);

  return {
    dataHealth: {
      count: home.dataHealth.count,
      issues: home.dataHealth.items.map((issue) => ({
        detectedAt: issue.detectedAt,
        message: issue.message,
        title: issue.title,
        type: issue.type,
      })),
    },
    needsAttention: home.needsAttention.map(serializeChange),
    notableChanges: home.notableChanges.map(serializeChange),
    setupState: home.setupState,
  };
}

module.exports = getWorkspaceActivity;
