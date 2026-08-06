import React, {
  useEffect, useMemo, useRef, useState,
} from "react";
import PropTypes from "prop-types";
import {
  Accordion, Button, Chip, Dropdown, InputGroup, Modal, Spinner, Table, Tabs, Tooltip,
} from "@heroui/react";
import {
  LuBell,
  LuChartNoAxesColumn,
  LuChevronRight,
  LuCircleCheck,
  LuClock,
  LuDatabase,
  LuEllipsis,
  LuEyeOff,
  LuMail,
  LuPause,
  LuPencil,
  LuPlay,
  LuPlug,
  LuPlus,
  LuRefreshCw,
  LuSearch,
  LuSparkles,
  LuTrash2,
} from "react-icons/lu";
import { useNavigate, useSearchParams } from "react-router";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  acceptMonitorRecommendation,
  deleteMonitor,
  deleteObservationDigest,
  dismissMonitorRecommendation,
  getActivity,
  getAlerts,
  getDataHealth,
  getMonitors,
  getMonitorRecommendations,
  getObservationDigests,
  refreshMonitor,
  sendTestObservationDigest,
  updateMonitor,
  updateObservationDigest,
} from "../../api/observations";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import HeroPaginationNav from "../../components/HeroPaginationNav";
import ObservationCard from "./ObservationCard";
import MonitorSettingsModal from "./MonitorSettingsModal";
import SummaryScheduleModal from "./SummaryScheduleModal";
import WatchMetricModal from "../Chart/components/WatchMetricModal";
import { formatTimeAgo } from "../../modules/observationFormat";

const EDIT_ROLES = new Set(["projectAdmin", "projectEditor", "teamAdmin", "teamOwner"]);
const MONITOR_STATUS_LABELS = {
  collecting: "Building baseline",
  ineligible: "Needs review",
  ready: "Ready",
  waiting_for_data: "Waiting for data",
};
const DIRECTION_LABELS = {
  higher: "Higher is better",
  lower: "Lower is better",
  neutral: "Either direction",
};
const DELIVERY_DAY_LABELS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HEALTH_TYPE_LABELS = {
  chart: "Chart",
  connection: "Connection",
  dashboard: "Dashboard",
  dataset: "Dataset",
  monitor: "Watched metric",
};
const PAST_CHANGES_PER_PAGE = 10;

function formatPeriod(period) {
  if (!period?.start || !period?.end) return "—";
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(new Date(period.start))} – ${formatter.format(new Date(period.end))}`;
}

function getHealthIcon(type, resolved = false) {
  if (resolved) return <LuCircleCheck className="text-success" size={18} aria-hidden />;
  const iconProps = { className: "text-warning", size: 18, "aria-hidden": true };
  if (type === "connection") return <LuPlug {...iconProps} />;
  if (type === "dataset") return <LuDatabase {...iconProps} />;
  if (type === "chart") return <LuChartNoAxesColumn {...iconProps} />;
  return <LuRefreshCw {...iconProps} />;
}

function getDigestMeta(subscription) {
  let schedule = `Daily at ${subscription.localDeliveryTime}`;
  if (subscription.cadence === "weekly") {
    schedule = `${DELIVERY_DAY_LABELS[subscription.dayOfWeek] || "Monday"} at ${subscription.localDeliveryTime}`;
  } else if (subscription.deliveryDays?.length) {
    const selectedDays = subscription.deliveryDays
      .map((day) => `${day}`.slice(0, 3))
      .map((day) => `${day[0].toUpperCase()}${day.slice(1)}`)
      .join(", ");
    schedule = `${selectedDays} at ${subscription.localDeliveryTime}`;
  }
  const next = subscription.nextDeliveryAt
    ? `Next ${formatTimeAgo(subscription.nextDeliveryAt)}`
    : "No upcoming delivery";
  const lastStatus = subscription.lastDelivery?.status === "delivered"
    ? `Last delivered ${formatTimeAgo(subscription.lastDelivery.attemptedAt)}`
    : subscription.lastDelivery?.status === "no_updates"
      ? `Last checked ${formatTimeAgo(subscription.lastDelivery.attemptedAt)} · No updates`
      : subscription.lastDelivery?.status === "failed"
        ? `Last delivery failed ${formatTimeAgo(subscription.lastDelivery.attemptedAt)}`
        : "Not delivered yet";
  return `${subscription.scope?.name || "All accessible dashboards"} · Email · ${schedule} · ${subscription.timezone} · ${next} · ${lastStatus}`;
}

function getMonitorMeta(monitor) {
  if (!monitor.active) return "Evaluation is paused";
  if (monitor.statusReason === "initial_evaluation_failed") {
    return "Current chart data could not be evaluated. Refresh to try again";
  }
  if (monitor.statusReason === "definition_changed") {
    return "The chart changed. Refresh to build a new baseline";
  }
  if (monitor.status === "collecting") {
    return `${monitor.sampleCount} of ${monitor.minimumSamples} baseline samples`;
  }
  if (monitor.status === "waiting_for_data") {
    return monitor.statusReason === "incomplete_data"
      ? "The latest data is incomplete. Refresh after the dataset is ready"
      : "No values were returned by the latest refresh";
  }
  if (monitor.status === "ineligible") {
    return "This metric can no longer be evaluated";
  }
  if (monitor.statusReason === "no_new_data") {
    return `No new periods in the latest refresh · Checked ${formatTimeAgo(monitor.lastSampledAt)}`;
  }
  if (!monitor.lastSampledAt) return "Ready for its first evaluation";
  return `Last sampled ${formatTimeAgo(monitor.lastSampledAt)}`;
}

function EmptyState({ description, title }) {
  return (
    <div className="rounded-3xl border border-divider bg-content1 px-4 py-5">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-foreground-500">{description}</p>
    </div>
  );
}

EmptyState.propTypes = {
  description: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

function ItemList({ children }) {
  return (
    <div className="divide-y divide-divider overflow-hidden rounded-3xl border border-divider bg-content1">
      {children}
    </div>
  );
}

ItemList.propTypes = {
  children: PropTypes.node.isRequired,
};

function ItemRow({ actions, icon, meta, title }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 flex-row items-start gap-3">
        {icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-divider bg-content2/40">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-row flex-wrap items-center gap-2">{title}</div>
          {meta ? <div className="mt-1 text-sm text-muted">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-row items-center gap-2 md:self-center">{actions}</div> : null}
    </div>
  );
}

ItemRow.propTypes = {
  actions: PropTypes.node,
  icon: PropTypes.node,
  meta: PropTypes.node,
  title: PropTypes.node.isRequired,
};

function Activity() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [activity, setActivity] = useState([]);
  const [pastActivity, setPastActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [digests, setDigests] = useState([]);
  const [health, setHealth] = useState({ count: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [monitors, setMonitors] = useState([]);
  const [monitorPending, setMonitorPending] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationPendingId, setRecommendationPendingId] = useState(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [selectedDigest, setSelectedDigest] = useState(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [testDigestPendingId, setTestDigestPendingId] = useState(null);
  const [digestRemovePending, setDigestRemovePending] = useState(false);
  const [digestToRemove, setDigestToRemove] = useState(null);
  const [monitorToRemove, setMonitorToRemove] = useState(null);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastPage, setPastPage] = useState(1);
  const [pastTotal, setPastTotal] = useState(0);
  const [query, setQuery] = useState("");
  const pastRequestId = useRef(0);
  const selectedTab = searchParams.get("tab") || "changes";
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const canEdit = EDIT_ROLES.has(teamRole);

  const load = async () => {
    if (!team?.id) return;
    setLoading(true);
    try {
      const [
        openChanges,
        workspaceAlerts,
        dataHealth,
        watchedMetrics,
        metricRecommendations,
        summaries,
      ]
        = await Promise.all([
          getActivity(team.id, { limit: 50, status: "open" }),
          getAlerts(team.id),
          getDataHealth(team.id),
          getMonitors(team.id),
          getMonitorRecommendations(team.id).catch(() => []),
          getObservationDigests(team.id),
        ]);
      setActivity(openChanges.items);
      setAlerts(workspaceAlerts);
      setHealth(dataHealth);
      setMonitors(watchedMetrics);
      setRecommendations(metricRecommendations);
      setDigests(summaries);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [team?.id]);

  const loadPastPage = async (page, search = query) => {
    if (!team?.id) return;
    const requestId = pastRequestId.current + 1;
    pastRequestId.current = requestId;
    setPastLoading(true);
    try {
      const response = await getActivity(team.id, {
        limit: PAST_CHANGES_PER_PAGE,
        page,
        search: search.trim(),
        status: "resolved",
      });
      if (requestId !== pastRequestId.current) return;
      setPastActivity(response.items);
      setPastPage(response.page || page);
      setPastTotal(response.total || response.items.length);
    } catch (error) {
      if (requestId === pastRequestId.current) toast.error(error.message);
    } finally {
      if (requestId === pastRequestId.current) setPastLoading(false);
    }
  };

  useEffect(() => {
    if (!team?.id) return undefined;
    const timeout = setTimeout(() => loadPastPage(1, query), query.trim() ? 250 : 0);
    return () => clearTimeout(timeout);
  }, [team?.id, query]);

  const filteredActivity = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return activity;
    return activity.filter((item) => [
      item.title,
      item.summary,
      item.project?.name,
      item.chart?.name,
    ].filter(Boolean).join(" ").toLowerCase().includes(normalized));
  }, [activity, query]);
  const openActivity = filteredActivity.filter((item) => item.status === "open");
  const needsAttentionActivity = openActivity.filter((item) => item.impact !== "positive");
  const notableActivity = openActivity.filter((item) => item.impact === "positive");
  const pastTotalPages = Math.max(1, Math.ceil(pastTotal / PAST_CHANGES_PER_PAGE));
  const pastPageStart = pastTotal === 0 ? 0 : ((pastPage - 1) * PAST_CHANGES_PER_PAGE) + 1;
  const pastPageEnd = Math.min(pastPage * PAST_CHANGES_PER_PAGE, pastTotal);

  const removeMonitor = async (monitorId) => {
    setMonitorPending(true);
    try {
      await deleteMonitor(team.id, monitorId);
      setMonitors((current) => current.filter((monitor) => monitor.id !== monitorId));
      toast.success("Metric is no longer watched");
      setMonitorToRemove(null);
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
      toast.success(type === "later"
        ? "Suggestion hidden for 30 days"
        : "This metric will not be suggested again unless the chart changes");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecommendationPendingId(null);
    }
  };

  const removeDigest = async (subscriptionId) => {
    setDigestRemovePending(true);
    try {
      await deleteObservationDigest(team.id, subscriptionId);
      setDigests((current) => current.filter((item) => item.id !== subscriptionId));
      setDigestToRemove(null);
      toast.success("Activity digest removed");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDigestRemovePending(false);
    }
  };

  const toggleDigest = async (subscription) => {
    try {
      const updated = await updateObservationDigest(team.id, subscription.id, {
        enabled: !subscription.enabled,
      });
      setDigests((current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )));
      toast.success(updated.enabled ? "Activity digest resumed" : "Activity digest paused");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const sendTestDigest = async (subscriptionId) => {
    setTestDigestPendingId(subscriptionId);
    try {
      await sendTestObservationDigest(team.id, subscriptionId);
      toast.success("Test Activity digest sent");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setTestDigestPendingId(null);
    }
  };

  const saveDigest = (subscription) => {
    setDigests((current) => {
      const exists = current.some((item) => item.id === subscription.id);
      return exists
        ? current.map((item) => item.id === subscription.id ? subscription : item)
        : [subscription, ...current];
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading activity" />
      </div>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-tw text-2xl font-semibold">Activity</h1>
          <p className="text-sm text-foreground-500">
            Review detected changes, refresh issues, and watched metrics.
          </p>
        </div>
        {selectedTab === "summaries" ? (
          <Button
            className="self-start sm:self-auto"
            onPress={() => {
              setSelectedDigest(null);
              setSummaryModalOpen(true);
            }}
            size="sm"
            variant="primary"
          >
            <LuPlus size={16} aria-hidden />
            Schedule digest
          </Button>
        ) : null}
      </header>

      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) => setSearchParams({ tab: key })}
      >
        <Tabs.ListContainer className="w-fit max-w-full">
          <Tabs.List
            aria-label="Activity sections"
            className="w-fit *:w-fit *:shrink-0 *:whitespace-nowrap"
          >
            <Tabs.Tab id="changes">
              Changes
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="alerts">
              Alerts
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="health">
              Data health
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab className="ml-2 border-l border-divider pl-3" id="monitors">
              Watched metrics
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="summaries">
              Activity digests
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="changes" className="p-0 pt-1">
          <div className="flex flex-col gap-4">
            <InputGroup fullWidth className="max-w-lg">
              <InputGroup.Input
                aria-label="Search changes"
                placeholder="Search changes"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <InputGroup.Suffix className="pr-2">
                <LuSearch className="size-4 text-muted" aria-hidden />
              </InputGroup.Suffix>
            </InputGroup>
            <section aria-labelledby="open-changes-heading" className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold" id="open-changes-heading">
                Needs attention
              </h2>
              {needsAttentionActivity.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {needsAttentionActivity.map((observation) => (
                    <ObservationCard key={observation.id} observation={observation} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="No current change needs your attention."
                  title="Nothing needs attention"
                />
              )}
            </section>

            {notableActivity.length > 0 ? (
              <section aria-labelledby="notable-changes-heading" className="mt-4 flex flex-col gap-3">
                <h2 className="text-lg font-semibold" id="notable-changes-heading">
                  Notable changes
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {notableActivity.map((observation) => (
                    <ObservationCard key={observation.id} observation={observation} />
                  ))}
                </div>
              </section>
            ) : null}

            {pastLoading || pastTotal > 0 ? (
              <section aria-labelledby="past-changes-heading" className="mt-4 flex flex-col gap-3">
                <h2 className="text-lg font-semibold" id="past-changes-heading">
                  Past changes
                </h2>
                <Table className={`overflow-hidden rounded-3xl border border-divider shadow-none ${pastLoading ? "opacity-60" : ""}`}>
                  <Table.ScrollContainer>
                    <Table.Content
                      aria-label="Past changes"
                      className="min-w-[760px]"
                      onRowAction={(key) => navigate(`/activity/${key}`)}
                    >
                      <Table.Header>
                        <Table.Column id="change" isRowHeader textValue="Change">
                          Change
                        </Table.Column>
                        <Table.Column id="source" textValue="Source">
                          Source
                        </Table.Column>
                        <Table.Column id="period" textValue="Period">
                          Period
                        </Table.Column>
                        <Table.Column id="resolved" textValue="Resolved">
                          Resolved
                        </Table.Column>
                        <Table.Column className="w-10" id="action" textValue="Open change" />
                      </Table.Header>
                      <Table.Body renderEmptyState={() => (
                        <span className="text-sm text-muted">No matching changes on this page</span>
                      )}>
                        {pastActivity.map((observation) => (
                          <Table.Row
                            className="cursor-pointer"
                            id={String(observation.id)}
                            key={observation.id}
                          >
                            <Table.Cell>
                              <div className="flex max-w-md flex-col gap-0.5 py-1">
                                <span className="font-medium text-foreground">{observation.title}</span>
                                <span className="truncate text-xs text-muted">{observation.summary}</span>
                              </div>
                            </Table.Cell>
                            <Table.Cell>
                              <div className="flex flex-col gap-0.5">
                                <span>{observation.project?.name || "Workspace"}</span>
                                <span className="text-xs text-muted">{observation.chart?.name || "—"}</span>
                              </div>
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap text-sm text-muted">
                              {formatPeriod(observation.currentPeriod)}
                            </Table.Cell>
                            <Table.Cell>
                              <Chip className="whitespace-nowrap" size="sm" variant="soft">
                                <Chip.Label>
                                  {observation.resolvedAt
                                    ? `Resolved ${formatTimeAgo(observation.resolvedAt)}`
                                    : "Resolved"}
                                </Chip.Label>
                              </Chip>
                            </Table.Cell>
                            <Table.Cell>
                              <LuChevronRight className="text-foreground-400" size={16} aria-hidden />
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                  <Table.Footer className="flex flex-col gap-3 border-t border-divider px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm text-muted" aria-live="polite">
                      {pastLoading
                        ? "Loading past changes…"
                        : `${pastPageStart}–${pastPageEnd} of ${pastTotal}`}
                    </span>
                    {pastTotalPages > 1 ? (
                      <HeroPaginationNav
                        ariaLabel="Past changes pagination"
                        onPageChange={loadPastPage}
                        page={pastPage}
                        totalPages={pastTotalPages}
                      />
                    ) : null}
                  </Table.Footer>
                </Table>
              </section>
            ) : null}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="alerts" className="p-0 pt-1">
          {alerts.length > 0 ? (
            <ItemList>
              {alerts.map((alert) => (
                <ItemRow
                  actions={(
                    <Button
                      onPress={() => navigate(`/dashboard/${alert.project.id}`)}
                      size="sm"
                      variant="secondary"
                    >
                      Open dashboard
                    </Button>
                  )}
                  icon={(
                    <LuBell
                      className={alert.lastTriggeredAt ? "text-warning" : "text-foreground-400"}
                      size={18}
                      aria-hidden
                    />
                  )}
                  key={alert.id}
                  meta={(
                    <>
                      <span className="text-muted">{alert.project.name}</span>
                      <span className="mt-2 block text-xs text-muted">
                        {alert.lastTriggeredAt
                          ? `Last triggered ${formatTimeAgo(alert.lastTriggeredAt)}`
                          : "Not triggered yet"}
                      </span>
                    </>
                  )}
                  title={(
                    <>
                      <span className="font-medium text-foreground">{alert.chart.name}</span>
                      <Chip color={alert.active ? "success" : "default"} size="sm" variant="soft">
                        <Chip.Label>{alert.active ? "Active" : "Paused"}</Chip.Label>
                      </Chip>
                    </>
                  )}
                />
              ))}
            </ItemList>
          ) : (
            <EmptyState
              description="Configure a threshold or anomaly alert from an editable chart."
              title="No alerts yet"
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel id="health" className="p-0 pt-1">
          <div className="flex flex-col gap-6">
            <section aria-labelledby="active-health-heading" className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold" id="active-health-heading">
                Needs attention
              </h2>
              {(health.active || health.items).length > 0 ? (
                <ItemList>
                  {(health.active || health.items).map((item) => (
                    <ItemRow
                      actions={item.action ? (
                        <Button onPress={() => navigate(item.action.path)} size="sm" variant="secondary">
                          {item.action.label}
                        </Button>
                      ) : null}
                      icon={getHealthIcon(item.type)}
                      key={item.id}
                      meta={(
                        <>
                          <span className="text-muted">{item.message}</span>
                          <span className="mt-2 block text-xs text-muted">
                            Detected {formatTimeAgo(item.detectedAt)}
                          </span>
                        </>
                      )}
                      title={(
                        <>
                          <span className="font-medium text-foreground">{item.title || item.message}</span>
                          <Chip color="warning" size="sm" variant="soft">
                            <Chip.Label>{HEALTH_TYPE_LABELS[item.type] || "Data issue"}</Chip.Label>
                          </Chip>
                        </>
                      )}
                    />
                  ))}
                </ItemList>
              ) : (
                <ItemList>
                  <ItemRow
                    icon={<LuCircleCheck className="text-success" size={18} aria-hidden />}
                    meta="No current connection, dataset, chart, or watched metric failures were found."
                    title={<span className="font-medium text-foreground">Data is refreshing normally</span>}
                  />
                </ItemList>
              )}
            </section>

            {health.resolved?.length > 0 ? (
              <section aria-labelledby="resolved-health-heading" className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold" id="resolved-health-heading">
                  Resolved recently
                </h2>
                <ItemList>
                  {health.resolved.map((item) => (
                    <ItemRow
                      icon={getHealthIcon(item.type, true)}
                      key={item.id}
                      meta={(
                        <>
                          <span className="text-muted">{item.message}</span>
                          <span className="mt-2 block text-xs text-muted">
                            Recovered {formatTimeAgo(item.resolvedAt)}
                          </span>
                        </>
                      )}
                      title={(
                        <>
                          <span className="font-medium text-foreground">{item.title}</span>
                          <Chip color="success" size="sm" variant="soft">
                            <Chip.Label>Resolved</Chip.Label>
                          </Chip>
                        </>
                      )}
                    />
                  ))}
                </ItemList>
              </section>
            ) : null}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="monitors" className="p-0 pt-1">
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
                          <span className="text-lg font-semibold text-foreground">
                            Suggested metrics
                          </span>
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
                      <ItemList>
                        {recommendations.map((recommendation) => (
                          <ItemRow
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
                                    className="flex size-8 items-center justify-center rounded-3xl text-foreground transition-colors hover:bg-content2 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
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
                            icon={<LuSparkles className="text-accent" size={18} aria-hidden />}
                            key={recommendation.id}
                            meta={(
                              <>
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
                      </ItemList>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            ) : null}

            <section aria-labelledby="watched-metrics-heading" className="flex flex-col gap-3">
              {recommendations.length > 0 ? (
                <h2 className="text-lg font-semibold" id="watched-metrics-heading">
                  Watched metrics
                </h2>
              ) : null}
              {monitors.length > 0 ? (
                <ItemList>
                  {monitors.map((monitor) => (
                    <ItemRow
                  actions={canEdit ? (
                    <>
                      <Button
                        isDisabled={monitorPending}
                        onPress={() => toggleMonitor(monitor)}
                        size="sm"
                        variant="secondary"
                      >
                        {monitor.active ? <LuPause size={16} aria-hidden /> : <LuPlay size={16} aria-hidden />}
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
                          className="flex size-8 items-center justify-center rounded-3xl text-foreground transition-colors hover:bg-content2 focus-visible:outline-2 focus-visible:outline-primary"
                          onClick={() => setSelectedMonitor(monitor)}
                        >
                          <LuPencil size={16} aria-hidden />
                        </Tooltip.Trigger>
                        <Tooltip.Content>Edit metric</Tooltip.Content>
                      </Tooltip>
                      <Tooltip>
                        <Tooltip.Trigger
                          aria-label={`Stop watching ${monitor.name}`}
                          className="flex size-8 items-center justify-center rounded-3xl text-foreground transition-colors hover:bg-content2 focus-visible:outline-2 focus-visible:outline-primary"
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
                      <span className="block text-muted text-xs mt-2">{getMonitorMeta(monitor)}</span>
                    </>
                  )}
                  title={(
                    <>
                      <span className="font-medium">{monitor.name}</span>
                      <Chip color={monitor.active ? "accent" : "warning"} size="sm" variant="soft">
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
                    </>
                  )}
                    />
                  ))}
                </ItemList>
              ) : (
                <EmptyState
                  description={recommendations.length > 0
                    ? "Review a suggestion above or watch an eligible metric from a chart menu."
                    : "Editors can watch an eligible metric from a chart menu."}
                  title="No watched metrics yet"
                />
              )}
            </section>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="summaries" className="p-0 pt-1">
          {digests.length > 0 ? (
            <ItemList>
              {digests.map((subscription) => (
                <ItemRow
                  actions={(
                    <>
                      <Button
                        onPress={() => toggleDigest(subscription)}
                        size="sm"
                        variant="secondary"
                      >
                        {subscription.enabled ? "Pause" : "Resume"}
                      </Button>
                      <Dropdown aria-label="Activity digest options">
                        <Dropdown.Trigger
                          aria-label={testDigestPendingId === subscription.id
                            ? "Sending test Activity digest"
                            : "Open Activity digest options"}
                          className="flex size-8 items-center justify-center rounded-3xl text-foreground transition-colors hover:bg-content2 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                          isDisabled={Boolean(testDigestPendingId)}
                        >
                          {testDigestPendingId === subscription.id
                            ? <Spinner aria-hidden size="sm" />
                            : <LuEllipsis size={18} aria-hidden />}
                        </Dropdown.Trigger>
                        <Dropdown.Popover>
                          <Dropdown.Menu>
                            <Dropdown.Item
                              id="edit"
                              onPress={() => {
                                setSelectedDigest(subscription);
                                setSummaryModalOpen(true);
                              }}
                              textValue="Edit schedule"
                            >
                              <LuPencil size={16} aria-hidden />
                              Edit schedule
                            </Dropdown.Item>
                            <Dropdown.Item
                              id="send-test"
                              onPress={() => sendTestDigest(subscription.id)}
                              textValue="Send test email"
                            >
                              <LuMail size={16} aria-hidden />
                              Send test email
                            </Dropdown.Item>
                            <Dropdown.Item
                              id="delete"
                              onPress={() => setDigestToRemove(subscription)}
                              textValue="Delete schedule"
                              variant="danger"
                            >
                              <LuTrash2 size={16} aria-hidden />
                              Delete schedule
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                    </>
                  )}
                  icon={<LuBell className="text-foreground-400" size={18} aria-hidden />}
                  key={subscription.id}
                  meta={getDigestMeta(subscription)}
                  title={(
                    <>
                      <span className="font-medium text-foreground">
                        {subscription.cadence === "weekly" ? "Weekly" : "Daily"} Activity digest
                      </span>
                      {!subscription.enabled ? (
                        <Chip size="sm" variant="soft">
                          <Chip.Label>Paused</Chip.Label>
                        </Chip>
                      ) : null}
                    </>
                  )}
                />
              ))}
            </ItemList>
          ) : (
            <EmptyState
              description="Choose when Chartbrew should email changes and data-health issues."
              title="No Activity digests scheduled"
            />
          )}
        </Tabs.Panel>
      </Tabs>

      <MonitorSettingsModal
        isPending={monitorPending}
        monitor={selectedMonitor}
        onClose={() => setSelectedMonitor(null)}
        onSave={saveMonitor}
      />

      <WatchMetricModal
        chartName={selectedRecommendation?.chart?.name}
        description="Confirm how this metric should be interpreted before Chartbrew starts watching it."
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
          id: selectedRecommendation.layerId,
          kind: selectedRecommendation.kind,
          name: selectedRecommendation.name,
          valueFormat: selectedRecommendation.valueFormat,
        }] : []}
        submitLabel="Start watching"
      />

      <SummaryScheduleModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        onSaved={saveDigest}
        subscription={selectedDigest}
        teamId={team.id}
      />

      <Modal.Backdrop
        isOpen={Boolean(digestToRemove)}
        onOpenChange={(open) => {
          if (!open && !digestRemovePending) setDigestToRemove(null);
        }}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.Header>
              <Modal.Heading>Delete this Activity digest?</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-foreground-500">
                Chartbrew will stop sending this digest. Activity and emails already sent
                will not be removed.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={digestRemovePending}
                onPress={() => setDigestToRemove(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                isPending={digestRemovePending}
                onPress={() => removeDigest(digestToRemove.id)}
                variant="danger"
              >
                Delete schedule
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

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
    </main>
  );
}

export default Activity;
