const db = require("../../models/models");

const ALLOWED_CHANGED_FIELDS = new Set([
  "active",
  "cadence",
  "comparisonPeriod",
  "contentMode",
  "dayOfMonth",
  "dayOfWeek",
  "deliveryDays",
  "desiredDirection",
  "evaluationWaitMinutes",
  "enabled",
  "importance",
  "localDeliveryTime",
  "metricBehavior",
  "name",
  "scope",
  "thresholdType",
  "thresholdValue",
  "timezone",
]);

function normalizeChangedValues(values = {}) {
  return Object.keys(values).sort().reduce((result, key) => {
    if (ALLOWED_CHANGED_FIELDS.has(key)) result[key] = values[key];
    return result;
  }, {});
}

function getChangedFields(beforeValues = {}, afterValues = {}) {
  const before = normalizeChangedValues(beforeValues);
  const after = normalizeChangedValues(afterValues);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

async function createActionAudit({
  access,
  actionId,
  actionType,
  afterValues,
  authorityType,
  beforeValues = {},
  failureCode = null,
  projectId = null,
  proposalHash,
  resourceId = null,
  resourceType,
  sessionBindingHash = null,
  source = "orchestrator",
  status,
  transaction,
}) {
  const normalizedBefore = normalizeChangedValues(beforeValues);
  const normalizedAfter = normalizeChangedValues(afterValues);
  return db.OrchestratorActionAudit.create({
    action_id: actionId,
    action_type: actionType,
    actor_user_id: access.userId,
    after_values: normalizedAfter,
    authority_type: authorityType,
    before_values: normalizedBefore,
    changed_fields: getChangedFields(normalizedBefore, normalizedAfter),
    completed_at: ["applied", "conflicted", "failed", "rejected"].includes(status)
      ? new Date()
      : null,
    failure_code: failureCode,
    project_id: projectId,
    proposal_hash: proposalHash,
    resource_id: resourceId ? `${resourceId}` : null,
    resource_type: resourceType,
    session_binding_hash: sessionBindingHash,
    source,
    status,
    team_id: access.teamId,
  }, { transaction });
}

module.exports = {
  ALLOWED_CHANGED_FIELDS,
  createActionAudit,
  getChangedFields,
  normalizeChangedValues,
};
