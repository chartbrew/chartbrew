const MonitorController = require("../../../../controllers/MonitorController");
const { getObservationAccess } = require("../../../observations/access");

async function listMetricMonitors(payload) {
  const access = await getObservationAccess(payload.team_id, payload.user_id);
  const monitors = await new MonitorController().list(access);
  const projectId = payload.project_id ? Number(payload.project_id) : null;
  const limit = Math.min(Math.max(Number(payload.limit) || 50, 1), 100);
  return {
    items: monitors
      .filter((monitor) => !projectId || Number(monitor.projectId) === projectId)
      .slice(0, limit),
    truncated: monitors.length > limit,
  };
}

module.exports = listMetricMonitors;
