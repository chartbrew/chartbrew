const { getObservationAccess } = require("../../../observations/access");
const { getWorkspaceAccessEnvelope } = require("../../../workspaceContext/accessEnvelope");
const { readWorkspaceContext } = require("../../../workspaceContext/workspaceContextService");

async function getWorkspaceContext(payload) {
  const access = await getObservationAccess(payload.team_id, payload.user_id);
  const envelope = await getWorkspaceAccessEnvelope(access);
  return readWorkspaceContext(access, envelope, {
    externalProvider: true,
    limitPerSection: payload.limit_per_section,
    maximumAgeDays: payload.maximum_age_days,
    metricKey: payload.metric_key,
    monitorId: payload.monitor_id,
    projectId: payload.project_id,
    query: payload.query,
    sections: payload.sections,
    task: payload.task,
  });
}

module.exports = getWorkspaceContext;
