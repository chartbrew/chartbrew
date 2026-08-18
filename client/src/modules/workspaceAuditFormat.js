const ACTION_LABELS = {
  "kpi_review.create": "Created a KPI review",
  "kpi_review.update": "Updated a KPI review",
  "metric_monitor.create": "Created a watched metric",
  "metric_monitor.update": "Updated a watched metric",
};

const FIELD_LABELS = {
  cadence: "Schedule",
  comparisonPeriod: "Comparison",
  contentMode: "Report content",
  desiredDirection: "Better result",
  importance: "Priority",
  localDeliveryTime: "Delivery time",
  metricBehavior: "Calculation",
  name: "Name",
  scope: "Scope",
  thresholdType: "Change rule",
  thresholdValue: "Change amount",
  timezone: "Timezone",
};

const SECTION_LABELS = {
  account: "available actions",
  activity: "workspace activity",
  business_profile: "business profile",
  dashboards: "dashboard details",
  datasets: "dataset details",
  kpiReviews: "KPI reviews",
  learning: "feedback and corrections",
  recommendations: "metric suggestions",
  watches: "watched metrics",
};

function formatDate(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatActionLabel(actionType) {
  return ACTION_LABELS[actionType] || "Changed an AI setting";
}

function formatChangedFields(fields = []) {
  return fields.map((field) => FIELD_LABELS[field] || "Other settings").join(", ")
    || "No saved fields";
}

function formatContextSections(manifest = {}) {
  const sections = Array.isArray(manifest.contextSections) ? manifest.contextSections : [];
  return sections.map((section) => SECTION_LABELS[section] || "other workspace information")
    .join(", ") || "No workspace data";
}

function formatContextVolume(manifest = {}) {
  const factCounts = Object.values(manifest.factCounts || {});
  const factCount = factCounts.reduce((total, value) => total + (Number(value) || 0), 0);
  const projectCount = Number(manifest.projectCount) || 0;
  const characterCount = Number(manifest.characterCount) || 0;
  const parts = [
    `${factCount.toLocaleString()} ${factCount === 1 ? "fact" : "facts"}`,
    `${projectCount.toLocaleString()} ${projectCount === 1 ? "dashboard" : "dashboards"}`,
    `${characterCount.toLocaleString()} characters`,
  ];
  if (manifest.truncated) parts.push("Shortened to fit the limit");
  return parts.join(" · ");
}

function formatPurpose(purpose) {
  if (`${purpose || ""}`.includes("summary")) return "Workspace summary";
  if (`${purpose || ""}`.includes("recommend")) return "Metric suggestions";
  if (`${purpose || ""}`.includes("preview")) return "Prepared change";
  return "Workspace question";
}

function formatResult(status) {
  if (["applied", "complete", "validated"].includes(status)) return "Completed";
  if (["failed", "rejected"].includes(status)) return "Failed";
  if (status === "partial") return "Partial";
  return "Completed";
}

export {
  formatActionLabel,
  formatChangedFields,
  formatContextSections,
  formatContextVolume,
  formatDate,
  formatPurpose,
  formatResult,
};
