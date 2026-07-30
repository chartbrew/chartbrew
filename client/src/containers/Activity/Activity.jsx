import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button, Chip, InputGroup, Spinner, Tabs, Tooltip } from "@heroui/react";
import {
  LuBell,
  LuCircleCheck,
  LuRefreshCw,
  LuSearch,
  LuTrash2,
} from "react-icons/lu";
import { useNavigate, useSearchParams } from "react-router";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  deleteMonitor,
  deleteObservationDigest,
  getActivity,
  getAlerts,
  getDataHealth,
  getMonitors,
  getObservationDigests,
  refreshMonitor,
  sendTestObservationDigest,
  updateObservationDigest,
} from "../../api/observations";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import ObservationCard from "./ObservationCard";
import { formatTimeAgo } from "../../modules/observationFormat";

const EDIT_ROLES = new Set(["projectAdmin", "projectEditor", "teamAdmin", "teamOwner"]);
const MONITOR_STATUS_LABELS = {
  collecting: "Building baseline",
  ineligible: "Needs review",
  ready: "Ready",
  waiting_for_data: "Waiting for data",
};

function getMonitorMeta(monitor) {
  if (monitor.status === "collecting") {
    return `${monitor.sampleCount} of ${monitor.minimumSamples} baseline samples`;
  }
  if (monitor.status === "waiting_for_data") {
    return "No values were returned by the latest refresh";
  }
  if (monitor.status === "ineligible") {
    return "This metric can no longer be evaluated";
  }
  return `Last sampled ${formatTimeAgo(monitor.lastSampledAt)}`;
}

function EmptyState({ description, title }) {
  return (
    <div className="rounded-xl border border-divider bg-content1 px-4 py-5">
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
    <div className="divide-y divide-divider rounded-xl border border-divider bg-content1">
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
        {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
        <div className="min-w-0">
          <div className="flex flex-row flex-wrap items-center gap-2">{title}</div>
          <p className="mt-0.5 text-sm text-foreground-500">{meta}</p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-row items-center gap-2">{actions}</div> : null}
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
  const [alerts, setAlerts] = useState([]);
  const [digests, setDigests] = useState([]);
  const [health, setHealth] = useState({ count: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [monitors, setMonitors] = useState([]);
  const [query, setQuery] = useState("");
  const selectedTab = searchParams.get("tab") || "changes";
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const canEdit = EDIT_ROLES.has(teamRole);

  const load = async () => {
    if (!team?.id) return;
    setLoading(true);
    try {
      const [changes, workspaceAlerts, dataHealth, watchedMetrics, summaries] = await Promise.all([
        getActivity(team.id, { limit: 50 }),
        getAlerts(team.id),
        getDataHealth(team.id),
        getMonitors(team.id),
        getObservationDigests(team.id),
      ]);
      setActivity(changes.items);
      setAlerts(workspaceAlerts);
      setHealth(dataHealth);
      setMonitors(watchedMetrics);
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

  const removeMonitor = async (monitorId) => {
    try {
      await deleteMonitor(team.id, monitorId);
      setMonitors((current) => current.filter((monitor) => monitor.id !== monitorId));
      toast.success("Metric is no longer watched");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const runMonitor = async (monitorId) => {
    try {
      const monitor = await refreshMonitor(team.id, monitorId);
      setMonitors((current) => current.map((item) => (
        item.id === monitor.id ? monitor : item
      )));
      toast.success("Metric refreshed");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const removeDigest = async (subscriptionId) => {
    try {
      await deleteObservationDigest(team.id, subscriptionId);
      setDigests((current) => current.filter((item) => item.id !== subscriptionId));
      toast.success("Summary schedule removed");
    } catch (error) {
      toast.error(error.message);
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
    } catch (error) {
      toast.error(error.message);
    }
  };

  const sendTestDigest = async (subscriptionId) => {
    try {
      await sendTestObservationDigest(team.id, subscriptionId);
      toast.success("Test summary sent");
    } catch (error) {
      toast.error(error.message);
    }
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
      <header className="flex flex-col gap-1">
        <h1 className="font-tw text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-foreground-500">
          Review detected changes, refresh issues, and watched metrics.
        </p>
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
            <Tabs.Tab id="monitors">
              Watched metrics
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="summaries">
              Summaries
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="changes" className="p-0">
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
            {filteredActivity.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredActivity.map((observation) => (
                  <ObservationCard key={observation.id} observation={observation} />
                ))}
              </div>
            ) : (
              <EmptyState
                description="Material changes in watched metrics will appear here."
                title="No changes found"
              />
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="alerts" className="p-0">
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
                      size={16}
                      aria-hidden
                    />
                  )}
                  key={alert.id}
                  meta={`${alert.project.name}${alert.lastTriggeredAt
                    ? ` · Last triggered ${formatTimeAgo(alert.lastTriggeredAt)}`
                    : " · Not triggered yet"}`}
                  title={(
                    <>
                      <span className="font-medium">{alert.chart.name}</span>
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

        <Tabs.Panel id="health" className="p-0">
          {health.items.length > 0 ? (
            <ItemList>
              {health.items.map((item) => (
                <ItemRow
                  actions={(
                    <Chip color="warning" size="sm" variant="soft">
                      <Chip.Label>Needs attention</Chip.Label>
                    </Chip>
                  )}
                  icon={<LuRefreshCw className="text-warning" size={16} aria-hidden />}
                  key={item.id}
                  meta={`Detected ${formatTimeAgo(item.detectedAt)}`}
                  title={<span className="font-medium">{item.message}</span>}
                />
              ))}
            </ItemList>
          ) : (
            <ItemList>
              <ItemRow
                icon={<LuCircleCheck className="text-success" size={16} aria-hidden />}
                meta="No unresolved refresh failures were found."
                title={<span className="font-medium">Data is refreshing normally</span>}
              />
            </ItemList>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="monitors" className="p-0">
          {monitors.length > 0 ? (
            <ItemList>
              {monitors.map((monitor) => (
                <ItemRow
                  actions={canEdit ? (
                    <>
                      <Button onPress={() => runMonitor(monitor.id)} size="sm" variant="secondary">
                        <LuRefreshCw size={16} aria-hidden />
                        Refresh
                      </Button>
                      <Tooltip>
                        <Tooltip.Trigger>
                          <Button
                            aria-label={`Stop watching ${monitor.name}`}
                            isIconOnly
                            onPress={() => removeMonitor(monitor.id)}
                            size="sm"
                            variant="ghost"
                          >
                            <LuTrash2 size={16} aria-hidden />
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Stop watching</Tooltip.Content>
                      </Tooltip>
                    </>
                  ) : null}
                  key={monitor.id}
                  meta={getMonitorMeta(monitor)}
                  title={(
                    <>
                      <span className="font-medium">{monitor.name}</span>
                      <Chip size="sm" variant="soft">
                        <Chip.Label>
                          {MONITOR_STATUS_LABELS[monitor.status] || "Unavailable"}
                        </Chip.Label>
                      </Chip>
                    </>
                  )}
                />
              ))}
            </ItemList>
          ) : (
            <EmptyState
              description="Editors can watch an eligible metric from a chart menu."
              title="No watched metrics yet"
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel id="summaries" className="p-0">
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
                      <Button
                        onPress={() => sendTestDigest(subscription.id)}
                        size="sm"
                        variant="ghost"
                      >
                        Send test
                      </Button>
                      <Tooltip>
                        <Tooltip.Trigger>
                          <Button
                            aria-label="Delete summary schedule"
                            isIconOnly
                            onPress={() => removeDigest(subscription.id)}
                            size="sm"
                            variant="ghost"
                          >
                            <LuTrash2 size={16} aria-hidden />
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Delete schedule</Tooltip.Content>
                      </Tooltip>
                    </>
                  )}
                  icon={<LuBell className="text-foreground-400" size={16} aria-hidden />}
                  key={subscription.id}
                  meta={`${subscription.localDeliveryTime} · ${subscription.timezone}`}
                  title={(
                    <>
                      <span className="font-medium">
                        {subscription.cadence === "weekly" ? "Weekly" : "Daily"} summary
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
              description="Schedule one from Home after your first watched metric has a baseline."
              title="No scheduled summaries"
            />
          )}
        </Tabs.Panel>
      </Tabs>
    </main>
  );
}

export default Activity;
