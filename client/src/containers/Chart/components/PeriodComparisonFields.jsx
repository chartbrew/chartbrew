import React from "react";
import PropTypes from "prop-types";
import {
  Autocomplete,
  EmptyState,
  Input,
  Label,
  ListBox,
  SearchField,
  Select,
  useFilter,
} from "@heroui/react";
import {
  LuCalendarClock,
  LuCalendarDays,
  LuCalendarRange,
  LuChartNoAxesColumnIncreasing,
  LuGauge,
  LuPercent,
  LuSigma,
} from "react-icons/lu";

import timezones from "../../../modules/timezones";

const WEEK_DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
];

const PERIOD_OPTIONS = {
  day: {
    description: "Yesterday compared with the day before",
    example: "For example, August 8 compared with August 7.",
    icon: LuCalendarDays,
    label: "Day over day",
    plural: "days",
    singular: "day",
  },
  month: {
    description: "Last complete month compared with the month before",
    example: "For example, July compared with June.",
    icon: LuCalendarClock,
    label: "Month over month",
    plural: "months",
    singular: "month",
  },
  quarter: {
    description: "Last complete quarter compared with the quarter before",
    example: "For example, April–June compared with January–March.",
    icon: LuCalendarRange,
    label: "Quarter over quarter",
    plural: "quarters",
    singular: "quarter",
  },
  week: {
    description: "Last complete week compared with the week before",
    example: "For example, July 27–August 2 compared with July 20–26.",
    icon: LuCalendarRange,
    label: "Week over week",
    plural: "weeks",
    singular: "week",
  },
  year: {
    description: "Last complete year compared with the year before",
    example: "For example, 2025 compared with 2024.",
    icon: LuCalendarClock,
    label: "Year over year",
    plural: "years",
    singular: "year",
  },
};

const COMPARISON_PERIODS = ["day", "week", "month", "quarter", "year"];

function getPeriodCopy(period) {
  return PERIOD_OPTIONS[period] || {
    description: "Last complete period versus the one before",
    example: "The last complete period compared with the one before it.",
    icon: LuCalendarRange,
    label: "Period over period",
    plural: "periods",
    singular: "period",
  };
}

function getBehaviorCopy(behavior, period) {
  const { singular } = getPeriodCopy(period);
  const options = {
    distribution: {
      description: "Best for latency percentiles or median values",
      icon: LuChartNoAxesColumnIncreasing,
      label: `Median or percentile for the ${singular}`,
      summary: `a median or percentile for each complete ${singular}`,
    },
    flow: {
      description: "Best for revenue, orders, or sign-ups",
      icon: LuSigma,
      label: `Total across the ${singular}`,
      summary: `the total for each complete ${singular}`,
    },
    ratio: {
      description: "Best for conversion or failure rates",
      icon: LuPercent,
      label: `Rate for the ${singular}`,
      summary: `a rate for each complete ${singular}`,
    },
    state: {
      description: "Best for MRR, balances, or active accounts",
      icon: LuGauge,
      label: `Value at the end of the ${singular}`,
      summary: `the value at the end of each complete ${singular}`,
    },
  };
  return options[behavior] || options.state;
}

function getThresholdCopy(type, value) {
  const number = Number(value);
  const displayValue = Number.isFinite(number) ? number : value;
  if (type === "absolute") {
    return {
      summary: `${displayValue} chart units or more`,
    };
  }
  if (type === "percentage_points") {
    return {
      summary: `${displayValue} percentage points or more`,
    };
  }
  return {
    summary: `${displayValue}% or more`,
  };
}

function formatExampleNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function getThresholdEffectCopy(type, value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  if (type === "absolute") {
    return `For example, 100 to ${formatExampleNumber(100 + number)} would create a change.`;
  }
  if (type === "percentage_points") {
    return `For example, 10% to ${formatExampleNumber(10 + number)}% would create a change.`;
  }
  return `For example, 100 to ${formatExampleNumber(100 * (1 + (number / 100)))} would create a change.`;
}

function OptionContent({ description, icon: Icon, label, recommended = false }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <Icon className="mt-0.5 shrink-0 text-foreground-400" size={17} aria-hidden />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {recommended ? (
            <span className="text-xs font-medium text-primary">Recommended</span>
          ) : null}
        </div>
        <p className="text-xs text-foreground-500">{description}</p>
      </div>
    </div>
  );
}

OptionContent.propTypes = {
  description: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  recommended: PropTypes.bool,
};

OptionContent.defaultProps = {
  recommended: false,
};

function getMachineTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getDefaultPeriodSettings(source = {}) {
  const supportedSourcePeriod = COMPARISON_PERIODS.includes(source.timeUnit)
    ? source.timeUnit
    : null;
  return {
    calendarTimezone: source.comparison?.timezone
      || source.calendarTimezone
      || getMachineTimezone(),
    comparisonPeriod: source.comparison?.period || supportedSourcePeriod || "month",
    metricBehavior: source.metricBehavior
      || source.recommendedMetricBehavior
      || (["count", "sum"].includes(source.aggregate) ? "flow" : "state"),
    thresholdType: source.threshold?.type || "relative",
    thresholdValue: source.threshold?.type === "relative"
      ? `${Number(source.threshold.value) * 100}`
      : `${source.threshold?.value || 10}`,
    weekStartsOn: `${source.comparison?.weekStartsOn || 1}`,
  };
}

function getRecommendedBehavior(aggregate, recommendedMetricBehavior) {
  return recommendedMetricBehavior
    || (["count", "sum"].includes(aggregate) ? "flow" : "state");
}

function canBuildCompleteFlow(timeUnit, comparisonPeriod) {
  if (!timeUnit || timeUnit === comparisonPeriod) return true;
  const supportedRollups = {
    day: new Set(["week", "month", "quarter", "year"]),
    hour: new Set(["day", "week"]),
    month: new Set(["quarter", "year"]),
  };
  return supportedRollups[timeUnit]?.has(comparisonPeriod) || false;
}

function getRefreshScheduleWarning({
  comparisonPeriod,
  metricBehavior,
  refreshSchedule,
  timeUnit,
}) {
  const periodCopy = getPeriodCopy(comparisonPeriod);
  if (metricBehavior === "flow" && !canBuildCompleteFlow(timeUnit, comparisonPeriod)) {
    return `This chart may not contain every value needed for a complete ${periodCopy.singular}. Group the chart by ${periodCopy.singular} or use a smaller time unit.`;
  }
  if (!refreshSchedule?.automatic) {
    return `This chart has no automatic update schedule. Refresh it after each ${periodCopy.singular} closes so Chartbrew can compare it.`;
  }
  if (metricBehavior === "state" && refreshSchedule.intervalSeconds) {
    const toleranceSeconds = comparisonPeriod === "day" ? 6 * 60 * 60 : 24 * 60 * 60;
    if (refreshSchedule.intervalSeconds > toleranceSeconds * 2) {
      return `This chart may not update near the end of each ${periodCopy.singular}. Use a more frequent update schedule.`;
    }
  }
  return null;
}

function getPeriodComparisonPayload(settings) {
  const rawThreshold = Number(settings.thresholdValue);
  return {
    comparison: {
      checkpointToleranceMinutes: settings.comparisonPeriod === "day" ? 360 : 1440,
      mode: "completed",
      period: settings.comparisonPeriod,
      rule: "previous_period",
      settlingDelayMinutes: 360,
      timezone: settings.calendarTimezone,
      weekStartsOn: Number(settings.weekStartsOn),
    },
    metricBehavior: settings.metricBehavior,
    threshold: {
      type: settings.thresholdType,
      value: settings.thresholdType === "relative" ? rawThreshold / 100 : rawThreshold,
    },
  };
}

function isPeriodSettingsValid(settings, {
  aggregate, kind, periodAvailability, timeUnit, valueMeaning,
} = {}) {
  const thresholdValue = Number(settings.thresholdValue);
  if (!settings.calendarTimezone || !Number.isFinite(thresholdValue) || thresholdValue <= 0) {
    return false;
  }
  if (periodAvailability?.[settings.comparisonPeriod]?.available === false) return false;
  if (settings.metricBehavior === "flow"
    && (kind !== "timeseries"
      || !["count", "sum"].includes(aggregate)
      || !canBuildCompleteFlow(timeUnit, settings.comparisonPeriod))) return false;
  if (["distribution", "ratio"].includes(settings.metricBehavior)
    && (kind !== "timeseries" || timeUnit !== settings.comparisonPeriod)) return false;
  if (settings.thresholdType === "percentage_points" && valueMeaning !== "percentage") return false;
  return true;
}

function PeriodComparisonFields({
  aggregate,
  kind,
  onChange,
  periodAvailability,
  recommendedMetricBehavior,
  refreshSchedule,
  timeUnit,
  value,
  valueMeaning,
}) {
  const setValue = (field, nextValue) => onChange({ ...value, [field]: nextValue });
  const periodCopy = getPeriodCopy(value.comparisonPeriod);
  const nativePeriodAvailable = kind === "timeseries" && timeUnit === value.comparisonPeriod;
  const flowAvailable = kind === "timeseries"
    && ["count", "sum"].includes(aggregate)
    && canBuildCompleteFlow(timeUnit, value.comparisonPeriod);
  const behaviorOptions = ["flow", "state", "ratio", "distribution"];
  const recommendedBehavior = getRecommendedBehavior(aggregate, recommendedMetricBehavior);
  const selectedPeriodAvailability = periodAvailability?.[value.comparisonPeriod];
  const availabilityWarning = selectedPeriodAvailability?.available === false
    ? `${selectedPeriodAvailability.reason}. Extend the chart date range and try again.`
    : null;
  const scheduleWarning = availabilityWarning || getRefreshScheduleWarning({
    comparisonPeriod: value.comparisonPeriod,
    metricBehavior: value.metricBehavior,
    refreshSchedule,
    timeUnit,
  });

  return (
    <div className="flex flex-col gap-5">
      <Select
        fullWidth
        onChange={(period) => setValue("comparisonPeriod", period)}
        value={value.comparisonPeriod}
      >
        <Label>How often should Chartbrew compare results?</Label>
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox>
            {COMPARISON_PERIODS.map((period) => {
              const option = getPeriodCopy(period);
              const availability = periodAvailability?.[period];
              const needsNativePeriod = ["ratio", "distribution"].includes(value.metricBehavior)
                && (kind !== "timeseries" || timeUnit !== period);
              const cannotBuildFlow = value.metricBehavior === "flow"
                && !canBuildCompleteFlow(timeUnit, period);
              const disabled = availability?.available === false
                || needsNativePeriod
                || cannotBuildFlow;
              let description = option.description;
              if (availability?.available === false) {
                description = availability.reason;
              } else if (needsNativePeriod) {
                description = `Needs one complete ${option.singular} value from the chart`;
              } else if (cannotBuildFlow) {
                description = `This chart cannot build a complete ${option.singular} total`;
              }
              return (
                <ListBox.Item
                  id={period}
                  isDisabled={disabled}
                  key={period}
                  textValue={option.label}
                >
                  <OptionContent {...option} description={description} />
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        fullWidth
        onChange={(behavior) => setValue("metricBehavior", behavior)}
        value={value.metricBehavior}
      >
        <Label>What should Chartbrew use for each {periodCopy.singular}?</Label>
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox>
            {behaviorOptions.map((behavior) => {
              const option = getBehaviorCopy(behavior, value.comparisonPeriod);
              const disabled = behavior === "flow"
                ? !flowAvailable
                : ["ratio", "distribution"].includes(behavior) && !nativePeriodAvailable;
              let description = option.description;
              if (disabled && behavior === "flow") {
                description = "This chart cannot safely add its values";
              } else if (disabled) {
                description = `Needs one complete ${periodCopy.singular} value from the chart`;
              }
              return (
                <ListBox.Item
                  id={behavior}
                  isDisabled={disabled}
                  key={behavior}
                  textValue={option.label}
                >
                  <OptionContent
                    {...option}
                    description={description}
                    recommended={!disabled && behavior === recommendedBehavior}
                  />
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>

      <div className="flex flex-col gap-3">
        <Label>Show a change when it moves by at least</Label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          <Input
            label="Amount"
            min="0"
            onChange={(event) => setValue("thresholdValue", event.target.value)}
            step="any"
            type="number"
            value={value.thresholdValue}
          />
          <Select
            fullWidth
            onChange={(type) => setValue("thresholdType", type)}
            value={value.thresholdType}
          >
            <Label>Unit</Label>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="relative" textValue="% of the previous value">
                  <div>
                    <p className="font-medium">% of the previous value</p>
                    <p className="text-xs text-foreground-500">100 to 110 is a 10% change</p>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="absolute" textValue="Chart units">
                  <div>
                    <p className="font-medium">Chart units</p>
                    <p className="text-xs text-foreground-500">100 to 110 is a change of 10</p>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {valueMeaning === "percentage" ? (
                  <ListBox.Item id="percentage_points" textValue="Percentage points">
                    <div>
                      <p className="font-medium">Percentage points</p>
                      <p className="text-xs text-foreground-500">10% to 12% is a 2-point change</p>
                    </div>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ) : null}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </div>

      {scheduleWarning ? (
        <p className="text-sm text-warning-600 dark:text-warning-400" role="status">
          {scheduleWarning}
        </p>
      ) : null}
    </div>
  );
}

function PeriodCalendarFields({ onChange, value }) {
  const { contains } = useFilter({ sensitivity: "base" });
  const setValue = (field, nextValue) => onChange({ ...value, [field]: nextValue });

  return (
    <div className="flex flex-col gap-4">
      {value.comparisonPeriod === "week" ? (
        <Select
          fullWidth
          onChange={(day) => setValue("weekStartsOn", day)}
          value={value.weekStartsOn}
        >
          <Label>Week starts on</Label>
          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover>
            <ListBox>
              {WEEK_DAYS.map(([id, name]) => (
                <ListBox.Item id={`${id}`} key={id} textValue={name}>
                  {name}<ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      ) : null}

      <Autocomplete
        aria-label="Timezone"
        fullWidth
        onChange={(timezone) => setValue("calendarTimezone", timezone || "")}
        value={value.calendarTimezone}
      >
        <Label>Timezone</Label>
        <Autocomplete.Trigger>
          <Autocomplete.Value />
          <Autocomplete.ClearButton />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={contains}>
            <SearchField autoFocus name="metric-timezone-search" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search timezones..." />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
              {timezones.map((timezone) => (
                <ListBox.Item id={timezone} key={timezone} textValue={timezone}>
                  {timezone}<ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
    </div>
  );
}

const periodSettingsShape = PropTypes.shape({
  calendarTimezone: PropTypes.string.isRequired,
  comparisonPeriod: PropTypes.string.isRequired,
  metricBehavior: PropTypes.string.isRequired,
  thresholdType: PropTypes.string.isRequired,
  thresholdValue: PropTypes.string.isRequired,
  weekStartsOn: PropTypes.string.isRequired,
});

PeriodComparisonFields.propTypes = {
  aggregate: PropTypes.string,
  kind: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  periodAvailability: PropTypes.objectOf(PropTypes.shape({
    available: PropTypes.bool.isRequired,
    known: PropTypes.bool,
    reason: PropTypes.string,
  })),
  recommendedMetricBehavior: PropTypes.string,
  refreshSchedule: PropTypes.shape({
    automatic: PropTypes.bool,
    intervalSeconds: PropTypes.number,
  }),
  timeUnit: PropTypes.string,
  value: periodSettingsShape.isRequired,
  valueMeaning: PropTypes.string,
};

PeriodComparisonFields.defaultProps = {
  aggregate: "none",
  kind: null,
  periodAvailability: null,
  recommendedMetricBehavior: null,
  refreshSchedule: null,
  timeUnit: null,
  valueMeaning: "number",
};

PeriodCalendarFields.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: periodSettingsShape.isRequired,
};

export {
  getBehaviorCopy,
  getDefaultPeriodSettings,
  getPeriodComparisonPayload,
  getPeriodCopy,
  getThresholdCopy,
  getThresholdEffectCopy,
  isPeriodSettingsValid,
  PeriodCalendarFields,
};
export default PeriodComparisonFields;
