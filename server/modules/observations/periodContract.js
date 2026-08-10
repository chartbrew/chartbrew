const { IANAZone } = require("luxon");

const PERIOD_POLICY_VERSION = "completed-period-v1";
const SUPPORTED_BEHAVIORS = new Set(["distribution", "flow", "ratio", "state"]);
const SUPPORTED_PERIODS = new Set(["day", "month", "week"]);
const SUPPORTED_THRESHOLDS = new Set(["absolute", "percentage_points", "relative"]);

class PeriodContractError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function readInput(input = {}) {
  return {
    calendarTimezone: input.comparison?.timezone
      ?? input.calendarTimezone
      ?? input.baselinePolicy?.calendarTimezone,
    checkpointToleranceMinutes: input.comparison?.checkpointToleranceMinutes
      ?? input.checkpointToleranceMinutes
      ?? input.baselinePolicy?.checkpointToleranceMinutes,
    comparison: input.comparison?.rule
      ?? input.comparisonRule
      ?? input.baselinePolicy?.comparison,
    comparisonPeriod: input.comparison?.period
      ?? input.comparisonPeriod
      ?? input.baselinePolicy?.comparisonPeriod,
    metricBehavior: input.metricBehavior ?? input.metricSpec?.metricBehavior,
    periodMode: input.comparison?.mode
      ?? input.periodMode
      ?? input.baselinePolicy?.periodMode,
    settlingDelayMinutes: input.comparison?.settlingDelayMinutes
      ?? input.settlingDelayMinutes
      ?? input.baselinePolicy?.settlingDelayMinutes,
    thresholdType: input.threshold?.type
      ?? input.thresholdType
      ?? input.publicationPolicy?.thresholdType,
    thresholdValue: input.threshold?.value
      ?? input.thresholdValue
      ?? input.publicationPolicy?.thresholdValue,
    weekStartsOn: input.comparison?.weekStartsOn
      ?? input.weekStartsOn
      ?? input.baselinePolicy?.weekStartsOn,
  };
}

function normalizeInteger(value, fallback, minimum, maximum, message, code) {
  const resolved = value ?? fallback;
  const number = Number(resolved);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new PeriodContractError(message, code);
  }
  return number;
}

function normalizePeriodContract(input = {}, metricSpec = {}) {
  const values = readInput(input);
  if (!SUPPORTED_BEHAVIORS.has(values.metricBehavior)) {
    throw new PeriodContractError(
      "Choose how this metric behaves over time",
      "metric_behavior_required"
    );
  }
  if (!SUPPORTED_PERIODS.has(values.comparisonPeriod)) {
    throw new PeriodContractError(
      "Choose a daily, weekly, or monthly comparison",
      "comparison_period_required"
    );
  }

  const comparison = values.comparison || "previous_period";
  if (comparison !== "previous_period") {
    throw new PeriodContractError(
      "Only previous-period comparison is supported",
      "comparison_rule_unsupported"
    );
  }
  const periodMode = values.periodMode || "completed";
  if (periodMode !== "completed") {
    throw new PeriodContractError(
      "Only completed periods are supported",
      "period_mode_unsupported"
    );
  }

  const calendarTimezone = values.calendarTimezone || "";
  if (calendarTimezone !== "UTC" && !IANAZone.isValidZone(calendarTimezone)) {
    throw new PeriodContractError(
      "Choose a valid calendar timezone",
      "calendar_timezone_required"
    );
  }

  const aggregate = metricSpec.aggregate || "none";
  if (values.metricBehavior === "flow" && !["count", "sum"].includes(aggregate)) {
    throw new PeriodContractError(
      "Period totals require a sum or count metric",
      "flow_aggregate_unsupported"
    );
  }
  if (["distribution", "ratio"].includes(values.metricBehavior)
    && metricSpec.timeUnit !== values.comparisonPeriod) {
    throw new PeriodContractError(
      "This calculation must use the same period as the chart",
      "native_period_required"
    );
  }
  if (["distribution", "ratio"].includes(values.metricBehavior)
    && metricSpec.kind && metricSpec.kind !== "timeseries") {
    throw new PeriodContractError(
      "This calculation requires complete time-series period values",
      "native_timeseries_required"
    );
  }

  if (!SUPPORTED_THRESHOLDS.has(values.thresholdType)) {
    throw new PeriodContractError(
      "Choose when a period change should be shown",
      "threshold_required"
    );
  }
  const thresholdValue = Number(values.thresholdValue);
  if (!Number.isFinite(thresholdValue) || thresholdValue <= 0) {
    throw new PeriodContractError(
      "The change threshold must be greater than zero",
      "threshold_invalid"
    );
  }
  if (values.thresholdType === "relative" && thresholdValue > 10) {
    throw new PeriodContractError(
      "The relative change threshold is too large",
      "threshold_invalid"
    );
  }
  if (values.thresholdType === "percentage_points" && thresholdValue > 100) {
    throw new PeriodContractError(
      "The percentage-point threshold cannot exceed 100",
      "threshold_invalid"
    );
  }
  if (values.thresholdType === "percentage_points"
    && metricSpec.valueFormat?.meaning !== "percentage") {
    throw new PeriodContractError(
      "Percentage-point thresholds require a percentage metric",
      "percentage_threshold_unsupported"
    );
  }

  return {
    baselinePolicy: {
      calendarTimezone,
      checkpointToleranceMinutes: normalizeInteger(
        values.checkpointToleranceMinutes,
        values.comparisonPeriod === "day" ? 360 : 1440,
        0,
        10080,
        "Checkpoint tolerance must be between 0 and 10080 minutes",
        "checkpoint_tolerance_invalid"
      ),
      comparison,
      comparisonPeriod: values.comparisonPeriod,
      periodMode,
      policyVersion: PERIOD_POLICY_VERSION,
      settlingDelayMinutes: normalizeInteger(
        values.settlingDelayMinutes,
        360,
        0,
        10080,
        "Settling delay must be between 0 and 10080 minutes",
        "settling_delay_invalid"
      ),
      type: "completed_period",
      weekStartsOn: normalizeInteger(
        values.weekStartsOn,
        1,
        1,
        7,
        "Week start must be from 1 to 7",
        "week_start_invalid"
      ),
    },
    metricBehavior: values.metricBehavior,
    publicationPolicy: {
      thresholdType: values.thresholdType,
      thresholdValue,
    },
  };
}

function getMonitorPeriodContract(monitor) {
  return normalizePeriodContract({
    baselinePolicy: monitor.baseline_policy,
    metricBehavior: monitor.metric_spec?.metricBehavior,
    publicationPolicy: monitor.publication_policy,
  }, { ...monitor.metric_spec, kind: monitor.kind });
}

function mergeMonitorPeriodInput(data, monitor) {
  return {
    baselinePolicy: monitor?.baseline_policy,
    calendarTimezone: data.comparison?.timezone ?? data.calendarTimezone,
    checkpointToleranceMinutes: data.comparison?.checkpointToleranceMinutes
      ?? data.checkpointToleranceMinutes,
    comparisonPeriod: data.comparison?.period ?? data.comparisonPeriod,
    comparisonRule: data.comparison?.rule ?? data.comparisonRule,
    metricBehavior: data.metricBehavior ?? monitor?.metric_spec?.metricBehavior,
    periodMode: data.comparison?.mode ?? data.periodMode,
    publicationPolicy: monitor?.publication_policy,
    settlingDelayMinutes: data.comparison?.settlingDelayMinutes ?? data.settlingDelayMinutes,
    thresholdType: data.threshold?.type ?? data.thresholdType,
    thresholdValue: data.threshold?.value ?? data.thresholdValue,
    weekStartsOn: data.comparison?.weekStartsOn ?? data.weekStartsOn,
  };
}

function hasPeriodContractInput(data = {}) {
  return Boolean(
    data.comparison
    || data.threshold
    || data.metricBehavior !== undefined
    || data.comparisonPeriod !== undefined
    || data.calendarTimezone !== undefined
    || data.thresholdType !== undefined
    || data.thresholdValue !== undefined
  );
}

module.exports = {
  PERIOD_POLICY_VERSION,
  PeriodContractError,
  getMonitorPeriodContract,
  hasPeriodContractInput,
  mergeMonitorPeriodInput,
  normalizePeriodContract,
};
