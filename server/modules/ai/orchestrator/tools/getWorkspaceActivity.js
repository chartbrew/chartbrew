const { getObservationAccess } = require("../../../observations/access");
const { readWorkspaceActivity } = require("../../../workspaceContext/workspaceActivityProjection");

async function getWorkspaceActivity(payload) {
  const access = await getObservationAccess(payload.team_id, payload.user_id);
  return readWorkspaceActivity(access, {
    alertLimit: payload.alert_limit,
    evaluationLimit: payload.evaluation_limit,
    from: payload.from,
    healthLimit: payload.health_limit,
    includeAlerts: payload.include_alerts,
    includeHealth: payload.include_health,
    observationLimit: payload.observation_limit,
    projectId: payload.project_id,
    to: payload.to,
  });
}

module.exports = getWorkspaceActivity;
