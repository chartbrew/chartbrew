import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Accordion,
  Autocomplete,
  Avatar,
  Button,
  Chip,
  Dropdown,
  ListBox,
  Modal,
  SearchField,
  Spinner,
  Tooltip,
  useFilter,
} from "@heroui/react";
import {
  LuActivity,
  LuClock,
  LuEllipsis,
  LuEyeOff,
  LuEye,
  LuLayoutDashboard,
  LuPause,
  LuPencil,
  LuPlay,
  LuRefreshCw,
  LuTrash2,
  LuUser,
} from "react-icons/lu";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  acceptMonitorRecommendation,
  deleteMonitor,
  dismissMonitorRecommendation,
  getMonitors,
  getMonitorRecommendationDismissals,
  getMonitorRecommendations,
  refreshMonitor,
  restoreMonitorRecommendation,
  updateMonitor,
} from "../../api/observations";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import WatchMetricModal from "../Chart/components/WatchMetricModal";
import {
  ActivityEmptyState,
  ActivityList,
  ActivityListRow,
} from "./ActivityList";
import { formatTimeAgo } from "../../modules/observationFormat";

const EDIT_ROLES = new Set(["projectAdmin", "projectEditor", "teamAdmin", "teamOwner"]);
const MONITOR_STATUS_LABELS = {
  collecting: "Waiting",
  ineligible: "Needs review",
  ready: "Ready",
  review_required: "Needs review",
  waiting_for_data: "Waiting for data",
};
const DIRECTION_LABELS = {
  higher: "Higher is better",
  lower: "Lower is better",
  neutral: "Either direction",
};

function getMonitorMeta(monitor) {
  const nextEvaluation = monitor.nextEvaluationAt
    ? `Next evaluation ${formatTimeAgo(monitor.nextEvaluationAt)}`
    : null;
  const withNextEvaluation = (message) => [message, nextEvaluation].filter(Boolean).join(" · ");
  if (!monitor.active) return "Evaluation is paused";
  if (monitor.status === "review_required") return "Choose how this metric should be compared";
  if (monitor.statusReason === "initial_evaluation_failed") {
    return "Current chart data could not be captured. Refresh to try again";
  }
  if (monitor.statusReason === "definition_changed") {
    return "The comparison changed. Waiting for matching period data";
  }
  if (monitor.statusReason === "settling") {
    return withNextEvaluation("The latest completed period is settling");
  }
  if (monitor.status === "collecting") {
    return withNextEvaluation(monitor.statusReason === "waiting_for_fresh_data"
      ? "Waiting for fresh data after the period closed"
      : "Waiting for a complete comparison period");
  }
  if (monitor.status === "waiting_for_data") {
    return ["checkpoint_missing", "incomplete_coverage", "missing_window"].includes(
      monitor.statusReason
    )
      ? "The completed period does not have enough data"
      : "No values were returned by the latest refresh";
  }
  if (monitor.status === "ineligible") return "This metric can no longer be evaluated";
  if (monitor.lastEvaluatedPeriodEnd) {
    return withNextEvaluation(
      `Last completed period evaluated ${formatTimeAgo(monitor.lastEvaluatedPeriodEnd)}`
    );
  }
  if (!monitor.lastSampledAt) return "Waiting for its first data capture";
  return withNextEvaluation(`Last data captured ${formatTimeAgo(monitor.lastSampledAt)}`);
}

function getComparisonLabel(monitor) {
  if (!monitor.comparison?.period) return null;
  const periodLabels = {
    day: "Daily",
    month: "Monthly",
    quarter: "Quarterly",
    week: "Weekly",
    year: "Yearly",
  };
  const period = periodLabels[monitor.comparison.period] || "Completed period";
  const behavior = monitor.metricBehavior === "flow"
    ? "Total"
    : monitor.metricBehavior === "state" ? "Period end" : "Native period";
  return `${period} · ${behavior}`;
}

function getMonitorStatusColor(monitor) {
  if (!monitor.active) return "warning";
  if (["ineligible", "review_required", "waiting_for_data"].includes(monitor.status)) {
    return "warning";
  }
  return "accent";
}

function getInitials(name) {
  return `${name || ""}`
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function MonitorAutocompleteFilter({
  emptyLabel,
  icon: Icon,
  label,
  name,
  onChange,
  options,
  placeholder,
  showAvatars = false,
  value,
}) {
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <Autocomplete
      allowsEmptyCollection
      aria-label={`Filter watched metrics by ${label.toLowerCase()}`}
      className="w-full"
      fullWidth
      name={name}
      onChange={(keys) => onChange(Array.isArray(keys) ? keys.map((key) => `${key}`) : [])}
      placeholder={placeholder}
      selectionMode="multiple"
      value={value}
    >
      <Autocomplete.Trigger>
        <Autocomplete.Value className="min-w-0">
          {({ defaultChildren, isPlaceholder, state }) => {
            if (isPlaceholder || state.selectedItems.length === 0) {
              return (
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate">{defaultChildren}</span>
                </span>
              );
            }

            const selectedItems = state.selectedItems;
            const firstOption = options.find(
              (option) => option.id === `${selectedItems[0].key}`
            );
            const selectedLabel = selectedItems.length === 1
              ? firstOption?.name || selectedItems[0].textValue
              : `${selectedItems.length} ${label.toLowerCase()}s`;

            return (
              <span className="flex min-w-0 items-center gap-2">
                {showAvatars ? (
                  <Avatar className="size-4 shrink-0" color="accent" variant="soft">
                    {firstOption?.avatar ? (
                      <Avatar.Image alt="" src={firstOption.avatar} />
                    ) : null}
                    <Avatar.Fallback>
                      <span className="text-[8px] leading-none">
                        {getInitials(firstOption?.name) || <LuUser size={12} aria-hidden />}
                      </span>
                    </Avatar.Fallback>
                  </Avatar>
                ) : (
                  <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                )}
                <span className="truncate">{selectedLabel}</span>
              </span>
            );
          }}
        </Autocomplete.Value>
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus name={`${name}-search`} variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={`Search ${label.toLowerCase()}s`} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => (
            <div className="px-3 py-6 text-center text-sm text-muted">{emptyLabel}</div>
          )}>
            {options.map((option) => (
              <ListBox.Item id={option.id} key={option.id} textValue={option.name}>
                <div className="flex min-w-0 items-center gap-2">
                  {showAvatars ? (
                    <Avatar className="size-7 shrink-0" color="accent" variant="soft">
                      {option.avatar ? <Avatar.Image alt="" src={option.avatar} /> : null}
                      <Avatar.Fallback>
                        {getInitials(option.name) || <LuUser size={14} aria-hidden />}
                      </Avatar.Fallback>
                    </Avatar>
                  ) : null}
                  <span className="truncate">{option.name}</span>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

MonitorAutocompleteFilter.propTypes = {
  emptyLabel: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    avatar: PropTypes.string,
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
  placeholder: PropTypes.string.isRequired,
  showAvatars: PropTypes.bool,
  value: PropTypes.arrayOf(PropTypes.string).isRequired,
};

function WatchedMetricsPage() {
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(true);
  const [monitors, setMonitors] = useState([]);
  const [monitorPending, setMonitorPending] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationDismissals, setRecommendationDismissals] = useState([]);
  const [recommendationPendingId, setRecommendationPendingId] = useState(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [monitorToRemove, setMonitorToRemove] = useState(null);
  const [nameQuery, setNameQuery] = useState("");
  const [dashboardIds, setDashboardIds] = useState([]);
  const [ownerIds, setOwnerIds] = useState([]);
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user?.id)?.role;
  const canEdit = EDIT_ROLES.has(teamRole);

  useEffect(() => {
    if (!team?.id) return;
    setNameQuery("");
    setDashboardIds([]);
    setOwnerIds([]);
    setLoading(true);
    Promise.all([
      getMonitors(team.id),
      getMonitorRecommendations(team.id).catch(() => []),
      getMonitorRecommendationDismissals(team.id).catch(() => []),
    ])
      .then(([watchedMetrics, metricRecommendations, hiddenRecommendations]) => {
        setMonitors(watchedMetrics);
        setRecommendations(metricRecommendations);
        setRecommendationDismissals(hiddenRecommendations);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [team?.id]);

  const dashboardOptions = useMemo(() => Array.from(
    new Map(monitors.filter((monitor) => monitor.projectId && monitor.projectName)
      .map((monitor) => [`${monitor.projectId}`, {
        id: `${monitor.projectId}`,
        name: monitor.projectName,
      }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name)), [monitors]);
  const ownerOptions = useMemo(() => Array.from(
    new Map(monitors.filter((monitor) => monitor.createdBy?.id && monitor.createdBy?.name)
      .map((monitor) => [`${monitor.createdBy.id}`, {
        avatar: monitor.createdBy.icon || null,
        id: `${monitor.createdBy.id}`,
        name: monitor.createdBy.name,
      }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name)), [monitors]);
  const filteredMonitors = useMemo(() => {
    const normalizedName = nameQuery.trim().toLowerCase();
    return monitors.filter((monitor) => {
      if (normalizedName && !monitor.name.toLowerCase().includes(normalizedName)) return false;
      if (dashboardIds.length > 0 && !dashboardIds.includes(`${monitor.projectId}`)) return false;
      if (ownerIds.length > 0 && !ownerIds.includes(`${monitor.createdBy?.id}`)) return false;
      return true;
    });
  }, [dashboardIds, monitors, nameQuery, ownerIds]);
  const hasFilters = Boolean(nameQuery.trim() || dashboardIds.length || ownerIds.length);
  const clearFilters = () => {
    setNameQuery("");
    setDashboardIds([]);
    setOwnerIds([]);
  };

  const removeMonitor = async (monitorId) => {
    setMonitorPending(true);
    try {
      await deleteMonitor(team.id, monitorId);
      setMonitors((current) => current.filter((monitor) => monitor.id !== monitorId));
      setMonitorToRemove(null);
      toast.success("Metric is no longer watched");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setMonitorPending(false);
    }
  };

  const saveMonitor = async (changes) => {
    setMonitorPending(true);
    try {
      const updated = await updateMonitor(team.id, selectedMonitor.id, changes);
      setMonitors((current) => current.map((item) => (
        item.id === updated.id ? { ...item, ...updated } : item
      )));
      setSelectedMonitor(null);
      toast.success("Watched metric updated");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setMonitorPending(false);
    }
  };

  const toggleMonitor = async (monitor) => {
    setMonitorPending(true);
    try {
      const updated = await updateMonitor(team.id, monitor.id, { active: !monitor.active });
      setMonitors((current) => current.map((item) => (
        item.id === updated.id ? { ...item, ...updated } : item
      )));
      toast.success(updated.active ? "Metric resumed" : "Metric paused");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setMonitorPending(false);
    }
  };

  const runMonitor = async (monitorId) => {
    try {
      const monitor = await refreshMonitor(team.id, monitorId);
      setMonitors((current) => current.map((item) => (
        item.id === monitor.id ? { ...item, ...monitor } : item
      )));
      toast.success("Metric refreshed");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const acceptRecommendation = async (settings) => {
    if (!selectedRecommendation) return;
    setRecommendationPendingId(selectedRecommendation.id);
    try {
      const monitor = await acceptMonitorRecommendation(
        team.id,
        selectedRecommendation.id,
        settings
      );
      setMonitors((current) => [monitor, ...current]);
      setRecommendations((current) => current.filter((item) => (
        item.id !== selectedRecommendation.id
      )));
      setSelectedRecommendation(null);
      toast.success(`Watching ${monitor.name}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecommendationPendingId(null);
    }
  };

  const dismissRecommendation = async (recommendation, type) => {
    setRecommendationPendingId(recommendation.id);
    try {
      await dismissMonitorRecommendation(team.id, recommendation.id, type);
      setRecommendations((current) => current.filter((item) => item.id !== recommendation.id));
      setRecommendationDismissals(await getMonitorRecommendationDismissals(team.id));
      toast.success(type === "later"
        ? "Suggestion hidden for 30 days"
        : "This metric will not be suggested again unless the chart changes");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecommendationPendingId(null);
    }
  };

  const restoreRecommendation = async (dismissal) => {
    setRecommendationPendingId(dismissal.id);
    try {
      await restoreMonitorRecommendation(team.id, dismissal.id);
      const [metricRecommendations, hiddenRecommendations] = await Promise.all([
        getMonitorRecommendations(team.id),
        getMonitorRecommendationDismissals(team.id),
      ]);
      setRecommendations(metricRecommendations);
      setRecommendationDismissals(hiddenRecommendations);
      toast.success("Metric suggestion restored");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecommendationPendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading watched metrics" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {canEdit && recommendations.length > 0 ? (
          <Accordion
            className="w-full overflow-hidden rounded-3xl"
            defaultExpandedKeys={["suggested-metrics"]}
            hideSeparator
            variant="surface"
          >
            <Accordion.Item id="suggested-metrics" textValue="Suggested metrics">
              <Accordion.Heading>
                <Accordion.Trigger className="items-start gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1 text-start">
                    <div className="flex flex-row flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-foreground">Suggested metrics</span>
                      <Chip size="sm" variant="soft" color="accent">
                        <Chip.Label>{recommendations.length}</Chip.Label>
                      </Chip>
                    </div>
                    <span className="text-sm font-normal text-muted">
                      Based on charts your team already relies on. Nothing is watched until you approve it.
                    </span>
                  </div>
                  <Accordion.Indicator className="mt-1 shrink-0 text-muted" />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body className="pt-0 pb-4">
                  <ActivityList>
                    {recommendations.map((recommendation) => (
                      <ActivityListRow
                        actions={(
                          <>
                            <Button
                              isDisabled={Boolean(recommendationPendingId)}
                              onPress={() => setSelectedRecommendation(recommendation)}
                              size="sm"
                              variant="secondary"
                            >
                              Review
                            </Button>
                            <Dropdown aria-label={`Options for ${recommendation.name}`}>
                              <Dropdown.Trigger
                                aria-label={`Dismiss ${recommendation.name}`}
                                className="flex size-8 items-center justify-center rounded-3xl text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                                isDisabled={Boolean(recommendationPendingId)}
                              >
                                {recommendationPendingId === recommendation.id
                                  ? <Spinner aria-hidden size="sm" />
                                  : <LuEllipsis size={18} aria-hidden />}
                              </Dropdown.Trigger>
                              <Dropdown.Popover>
                                <Dropdown.Menu>
                                  <Dropdown.Item
                                    id="later"
                                    onPress={() => dismissRecommendation(recommendation, "later")}
                                    textValue="Not now"
                                  >
                                    <LuClock size={16} aria-hidden />
                                    Not now
                                  </Dropdown.Item>
                                  <Dropdown.Item
                                    id="definition"
                                    onPress={() => dismissRecommendation(recommendation, "definition")}
                                    textValue="Do not suggest this metric"
                                  >
                                    <LuEyeOff size={16} aria-hidden />
                                    Don&apos;t suggest this metric
                                  </Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown.Popover>
                            </Dropdown>
                          </>
                        )}
                        icon={<LuActivity className="text-accent" size={18} aria-hidden />}
                        key={recommendation.id}
                        meta={(
                          <>
                            {recommendation.learningReason ? (
                              <span className="block text-muted">{recommendation.learningReason}</span>
                            ) : null}
                            <span className="text-muted">{recommendation.reasons.join(" ")}</span>
                            <span className="mt-2 block text-xs text-muted">
                              {recommendation.project.name} · {recommendation.chart.name}
                              {" · "}{recommendation.calculation} · {recommendation.comparison}
                            </span>
                          </>
                        )}
                        title={<span className="font-medium text-foreground">{recommendation.name}</span>}
                      />
                    ))}
                  </ActivityList>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        ) : null}

        {canEdit && recommendationDismissals.length > 0 ? (
          <section className="rounded-3xl border border-divider bg-surface p-4" aria-labelledby="hidden-suggestions-heading">
            <h2 className="text-lg font-semibold" id="hidden-suggestions-heading">
              Hidden suggestions
            </h2>
            <div className="mt-3">
              <ActivityList>
                {recommendationDismissals.map((dismissal) => (
                  <ActivityListRow
                    actions={(
                      <Button
                        isDisabled={Boolean(recommendationPendingId)}
                        isPending={recommendationPendingId === dismissal.id}
                        onPress={() => restoreRecommendation(dismissal)}
                        size="sm"
                        variant="secondary"
                      >
                        <LuEye size={16} aria-hidden />
                        Restore
                      </Button>
                    )}
                    key={dismissal.id}
                    meta={`${dismissal.dashboardName} · ${dismissal.chartName}`}
                    title={<span className="font-medium text-foreground">{dismissal.name}</span>}
                  />
                ))}
              </ActivityList>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="watched-metrics-heading" className="flex flex-col gap-3">
          {recommendations.length > 0 ? (
            <h2 className="text-lg font-semibold" id="watched-metrics-heading">
              Watched metrics
            </h2>
          ) : null}
          {monitors.length > 0 ? (
            <>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <SearchField
                  className="w-full"
                  name="watched-metric-name-filter"
                  onChange={setNameQuery}
                  value={nameQuery}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Search metrics" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <MonitorAutocompleteFilter
                  emptyLabel="No dashboards found"
                  icon={LuLayoutDashboard}
                  label="Dashboard"
                  name="watched-metric-dashboard-filter"
                  onChange={setDashboardIds}
                  options={dashboardOptions}
                  placeholder="All dashboards"
                  value={dashboardIds}
                />
                <MonitorAutocompleteFilter
                  emptyLabel="No owners found"
                  icon={LuUser}
                  label="Owner"
                  name="watched-metric-owner-filter"
                  onChange={setOwnerIds}
                  options={ownerOptions}
                  placeholder="All owners"
                  showAvatars
                  value={ownerIds}
                />
                {hasFilters ? (
                  <Button onPress={clearFilters} size="sm" variant="tertiary">Clear filters</Button>
                ) : null}
              </div>
              {filteredMonitors.length > 0 ? (
                <ActivityList>
                  {filteredMonitors.map((monitor) => (
                    <ActivityListRow
                      actions={canEdit ? (
                        <>
                          <Button
                            isDisabled={monitorPending}
                            onPress={() => toggleMonitor(monitor)}
                            size="sm"
                            variant="secondary"
                          >
                            {monitor.active
                              ? <LuPause size={16} aria-hidden />
                              : <LuPlay size={16} aria-hidden />}
                            {monitor.active ? "Pause" : "Resume"}
                          </Button>
                          <Button
                            isDisabled={!monitor.active || monitorPending}
                            onPress={() => runMonitor(monitor.id)}
                            size="sm"
                            variant="secondary"
                          >
                            <LuRefreshCw size={16} aria-hidden />
                            Refresh
                          </Button>
                          <Tooltip>
                            <Tooltip.Trigger
                              aria-label={`Edit ${monitor.name}`}
                              className="flex size-8 items-center justify-center rounded-3xl text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-primary"
                              onClick={() => setSelectedMonitor(monitor)}
                            >
                              <LuPencil size={16} aria-hidden />
                            </Tooltip.Trigger>
                            <Tooltip.Content>Edit metric</Tooltip.Content>
                          </Tooltip>
                          <Tooltip>
                            <Tooltip.Trigger
                              aria-label={`Stop watching ${monitor.name}`}
                              className="flex size-8 items-center justify-center rounded-3xl text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-primary"
                              onClick={() => setMonitorToRemove(monitor)}
                            >
                              <LuTrash2 size={16} aria-hidden />
                            </Tooltip.Trigger>
                            <Tooltip.Content>Stop watching</Tooltip.Content>
                          </Tooltip>
                        </>
                      ) : null}
                      key={monitor.id}
                      meta={(
                        <>
                          <span className="text-muted">{[
                            monitor.projectName,
                            monitor.chartName || monitor.datasetName,
                            monitor.createdBy?.name ? `Added by ${monitor.createdBy.name}` : null,
                          ].filter(Boolean).join(" · ")}</span>
                          <span className="mt-2 block text-xs text-muted">
                            {getMonitorMeta(monitor)}
                          </span>
                        </>
                      )}
                      title={(
                        <>
                          <span className="font-medium">{monitor.name}</span>
                          <Chip color={getMonitorStatusColor(monitor)} size="sm" variant="soft">
                            <Chip.Label>
                              {monitor.active
                                ? MONITOR_STATUS_LABELS[monitor.status] || "Unavailable"
                                : "Paused"}
                            </Chip.Label>
                          </Chip>
                          <Chip size="sm" variant="soft">
                            <Chip.Label>
                              {DIRECTION_LABELS[monitor.desiredDirection] || DIRECTION_LABELS.neutral}
                            </Chip.Label>
                          </Chip>
                          {getComparisonLabel(monitor) ? (
                            <Chip size="sm" variant="soft">
                              <Chip.Label>{getComparisonLabel(monitor)}</Chip.Label>
                            </Chip>
                          ) : null}
                        </>
                      )}
                    />
                  ))}
                </ActivityList>
              ) : (
                <div className="rounded-3xl border border-divider bg-surface px-4 py-5">
                  <p className="font-medium">No watched metrics match these filters</p>
                  <Button className="mt-3" onPress={clearFilters} size="sm" variant="secondary">
                    Clear filters
                  </Button>
                </div>
              )}
            </>
          ) : (
            <ActivityEmptyState
              description={recommendations.length > 0
                ? "Review a suggestion above or watch an eligible metric from a chart menu."
                : "Editors can watch an eligible metric from a chart menu."}
              title="No watched metrics yet"
            />
          )}
        </section>
      </div>

      <WatchMetricModal
        chartName={selectedMonitor?.chartName || selectedMonitor?.datasetName}
        description="Choose what Chartbrew compares and when a change matters."
        heading="Edit watched metric"
        initialImportance={selectedMonitor?.importance || 1}
        initialLayerId={selectedMonitor?.id || null}
        initialName={selectedMonitor?.name || null}
        initialSettings={selectedMonitor}
        isOpen={Boolean(selectedMonitor)}
        isPending={monitorPending}
        lockMetric
        onClose={() => setSelectedMonitor(null)}
        onSubmit={saveMonitor}
        options={selectedMonitor ? [{
          aggregate: selectedMonitor.aggregate,
          calendarTimezone: selectedMonitor.comparison?.timezone,
          id: selectedMonitor.id,
          kind: selectedMonitor.kind,
          name: selectedMonitor.sourceName || selectedMonitor.name,
          periodAvailability: selectedMonitor.periodAvailability,
          recommendedMetricBehavior: selectedMonitor.metricBehavior,
          timeUnit: selectedMonitor.timeUnit,
          valueFormat: selectedMonitor.valueFormat,
        }] : []}
        submitLabel="Save changes"
      />

      <WatchMetricModal
        chartName={selectedRecommendation?.chart?.name}
        description="Choose how Chartbrew should watch this chart."
        heading="Review suggested metric"
        initialImportance={selectedRecommendation?.defaultImportance || 1}
        initialLayerId={selectedRecommendation?.layerId || null}
        isOpen={Boolean(selectedRecommendation)}
        isPending={recommendationPendingId === selectedRecommendation?.id}
        lockMetric
        onClose={() => {
          if (!recommendationPendingId) setSelectedRecommendation(null);
        }}
        onSubmit={acceptRecommendation}
        options={selectedRecommendation ? [{
          aggregate: selectedRecommendation.aggregate,
          calendarTimezone: selectedRecommendation.calendarTimezone,
          id: selectedRecommendation.layerId,
          kind: selectedRecommendation.kind,
          name: selectedRecommendation.name,
          periodAvailability: selectedRecommendation.periodAvailability,
          recommendedMetricBehavior: selectedRecommendation.recommendedMetricBehavior,
          timeUnit: selectedRecommendation.timeUnit,
          valueFormat: selectedRecommendation.valueFormat,
        }] : []}
        submitLabel="Start watching"
      />

      <Modal.Backdrop
        isOpen={Boolean(monitorToRemove)}
        onOpenChange={(open) => !open && setMonitorToRemove(null)}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.Header>
              <Modal.Heading>Stop watching this metric?</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-foreground-500">
                Existing changes remain in Activity, but Chartbrew will stop evaluating
                {monitorToRemove ? ` ${monitorToRemove.name}` : " this metric"}.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button onPress={() => setMonitorToRemove(null)} variant="secondary">Cancel</Button>
              <Button
                isPending={monitorPending}
                onPress={() => removeMonitor(monitorToRemove.id)}
                variant="danger"
              >
                Stop watching
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

export default WatchedMetricsPage;
