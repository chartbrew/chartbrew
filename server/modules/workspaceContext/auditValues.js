function getMonitorAuditValues(monitor = {}) {
  const comparison = monitor.comparison || monitor.baseline_policy;
  const metricSpec = monitor.metric_spec || {};
  const publicationPolicy = monitor.publication_policy || {};
  return {
    active: monitor.active ?? monitor.is_active,
    comparisonPeriod: comparison?.period || comparison?.comparisonPeriod || null,
    desiredDirection: monitor.desiredDirection || metricSpec.desiredDirection || null,
    importance: monitor.importance,
    metricBehavior: monitor.metricBehavior || metricSpec.metricBehavior || null,
    name: monitor.name,
    thresholdType: monitor.threshold?.type || publicationPolicy.thresholdType || null,
    thresholdValue: monitor.threshold?.value ?? publicationPolicy.thresholdValue ?? null,
  };
}

function getKpiReviewAuditValues(review = {}) {
  let scope = "workspace";
  const projectId = review.projectId ?? review.project_id;
  const monitorId = review.monitorId ?? review.monitor_id;
  if (projectId) scope = `project:${projectId}`;
  if (monitorId) scope = `monitor:${monitorId}`;
  return {
    cadence: review.cadence,
    contentMode: review.contentMode || review.content_mode,
    dayOfMonth: review.dayOfMonth ?? review.day_of_month,
    dayOfWeek: review.dayOfWeek ?? review.day_of_week,
    deliveryDays: review.deliveryDays ?? review.delivery_days ?? null,
    enabled: review.enabled,
    evaluationWaitMinutes: review.evaluationWaitMinutes ?? review.evaluation_wait_minutes,
    localDeliveryTime: review.localDeliveryTime || review.local_delivery_time,
    name: review.scope?.name || "KPI review",
    scope,
    timezone: review.timezone,
  };
}

module.exports = {
  getKpiReviewAuditValues,
  getMonitorAuditValues,
};
