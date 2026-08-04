import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, Chip, Spinner } from "@heroui/react";
import {
  LuActivity,
  LuArrowRight,
  LuChevronRight,
  LuCircleCheck,
  LuDatabase,
  LuRefreshCw,
} from "react-icons/lu";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  createRecordCountMonitor,
  getHome,
  getObservationDigests,
} from "../../api/observations";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import HomeAsk from "../Ai/HomeAsk";
import ObservationCard from "../Activity/ObservationCard";
import SummaryScheduleModal from "../Activity/SummaryScheduleModal";
import { formatTimeAgo } from "../../modules/observationFormat";
import RecordCountMonitorModal from "./RecordCountMonitorModal";

function SectionHeading({ action, eyebrow, id, title }) {
  return (
    <div className="mb-3 flex flex-row items-end justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">
            {eyebrow}
          </p>
        )}
        <h2 className="font-tw text-lg font-semibold" id={id}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

SectionHeading.propTypes = {
  action: PropTypes.node,
  eyebrow: PropTypes.string,
  id: PropTypes.string,
  title: PropTypes.string.isRequired,
};

function SetupState({ onWatchRecords, state }) {
  const navigate = useNavigate();
  const content = {
    collecting_baseline: {
      action: "View watched metrics",
      description: "Chartbrew is collecting enough history to compare your metrics reliably.",
      icon: <LuRefreshCw aria-hidden />,
      onPress: () => navigate("/activity?tab=monitors"),
      title: "Building a baseline",
    },
    connect_data: {
      action: "Connect data",
      description: "Connect a data source to start building dashboards and watching metrics.",
      icon: <LuDatabase aria-hidden />,
      onPress: () => navigate("/connections/new"),
      title: "Connect your first data source",
    },
    create_dataset: {
      action: "Create dataset",
      description: "Create a dataset before choosing what Chartbrew should monitor.",
      icon: <LuDatabase aria-hidden />,
      onPress: () => navigate("/datasets/new"),
      title: "Create your first dataset",
    },
    metrics_need_review: {
      action: "Review watched metrics",
      description: "A watched chart changed and its metric can no longer be evaluated.",
      icon: <LuActivity aria-hidden />,
      onPress: () => navigate("/activity?tab=monitors"),
      title: "A watched metric needs review",
    },
    no_important_changes: {
      description: "There are no open changes in your watched metrics that need attention.",
      icon: <LuCircleCheck aria-hidden />,
      title: "No changes need attention",
    },
    watch_metric: {
      action: "Browse dashboards",
      description: "Choose an eligible chart metric to establish a baseline and detect changes.",
      icon: <LuActivity aria-hidden />,
      onPress: () => navigate("/dashboards"),
      title: "Watch a metric to get started",
    },
    watch_record_count: {
      action: "Watch records",
      description: "Track unexpected changes in how many records a dataset returns.",
      icon: <LuDatabase aria-hidden />,
      onPress: onWatchRecords,
      title: "Start by watching data volume",
    },
    waiting_for_metrics: {
      action: "Browse dashboards",
      description: "A workspace editor can choose a metric for Chartbrew to monitor.",
      icon: <LuActivity aria-hidden />,
      onPress: () => navigate("/dashboards"),
      title: "No watched metrics yet",
    },
    waiting_for_setup: {
      description: "A workspace owner needs to connect data before metrics can be watched.",
      icon: <LuDatabase aria-hidden />,
      title: "Waiting for workspace data",
    },
    waiting_for_data: {
      action: "View watched metrics",
      description: "The latest refresh did not return enough data to evaluate your watched metrics.",
      icon: <LuRefreshCw aria-hidden />,
      onPress: () => navigate("/activity?tab=monitors"),
      title: "Waiting for data",
    },
  }[state];
  if (!content) return null;
  return (
    <div className="flex flex-row items-start gap-3 rounded-xl border border-divider bg-content1 px-4 py-5">
      <div className="mt-0.5 text-primary">{content.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{content.title}</p>
        <p className="mt-1 text-sm text-foreground-500">{content.description}</p>
      </div>
      {content.action && (
        <Button onPress={content.onPress} size="sm" variant="secondary">
          {content.action}
        </Button>
      )}
    </div>
  );
}

SetupState.propTypes = {
  onWatchRecords: PropTypes.func,
  state: PropTypes.string.isRequired,
};

SetupState.defaultProps = {
  onWatchRecords: undefined,
};

function DataHealthAttention({ count, onPress }) {
  return (
    <div className="flex h-full flex-row items-start gap-3 rounded-xl border border-divider bg-content1 px-4 py-4">
      <LuRefreshCw className="mt-0.5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {count} data {count === 1 ? "issue needs" : "issues need"} attention
        </p>
        <p className="mt-1 text-sm text-foreground-500">
          Review this before relying on the affected metrics.
        </p>
        <Button className="mt-3" onPress={onPress} size="sm" variant="secondary">
          Review data health
        </Button>
      </div>
    </div>
  );
}

DataHealthAttention.propTypes = {
  count: PropTypes.number.isRequired,
  onPress: PropTypes.func.isRequired,
};

function Home() {
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [data, setData] = useState(null);
  const [digests, setDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordCountModalOpen, setRecordCountModalOpen] = useState(false);
  const [recordCountPending, setRecordCountPending] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  useEffect(() => {
    if (!team?.id) return;
    setLoading(true);
    Promise.allSettled([getHome(team.id), getObservationDigests(team.id)])
      .then(([homeResult, subscriptionsResult]) => {
        if (homeResult.status === "rejected") throw homeResult.reason;
        const home = homeResult.value;
        const subscriptions = subscriptionsResult.status === "fulfilled"
          ? subscriptionsResult.value
          : [];
        setData(home);
        setDigests(subscriptions);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [team?.id]);

  const saveSummary = (subscription) => {
    setDigests((current) => {
      const exists = current.some((item) => item.id === subscription.id);
      return exists
        ? current.map((item) => item.id === subscription.id ? subscription : item)
        : [subscription, ...current];
    });
  };

  const createRecordCount = async (monitor) => {
    setRecordCountPending(true);
    try {
      await createRecordCountMonitor(team.id, monitor);
      setData(await getHome(team.id));
      setRecordCountModalOpen(false);
      toast.success("Dataset records are now being watched");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecordCountPending(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading Home" />
      </div>
    );
  }

  return (
    <main className="flex w-full flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-tw text-2xl font-semibold">
          Good to see you, {user?.name?.split(" ")[0] || "there"}.
        </h1>
        <p className="text-sm text-foreground-500">
          Here is what is moving across {team.name}
        </p>
      </header>

      <HomeAsk teamId={team.id} />

      <section aria-labelledby="attention-heading" className="mt-8">
        <SectionHeading
          action={(
            <Button onPress={() => navigate("/activity")} size="sm" variant="ghost">
              View all
              <LuArrowRight aria-hidden />
            </Button>
          )}
          eyebrow="Worth your attention"
          id="attention-heading"
          title="Needs attention"
        />
        {data.observations.length > 0 || data.dataHealth.showOnHome ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.dataHealth.showOnHome ? (
              <DataHealthAttention
                count={data.dataHealth.count}
                onPress={() => navigate("/activity?tab=health")}
              />
            ) : null}
            {data.observations.map((observation) => (
              <ObservationCard key={observation.id} observation={observation} />
            ))}
          </div>
        ) : (
          <SetupState
            onWatchRecords={() => setRecordCountModalOpen(true)}
            state={data.setupState}
          />
        )}
      </section>

      <section aria-labelledby="dashboards-heading" className="mt-8">
        <SectionHeading
          action={(
            <Button onPress={() => navigate("/dashboards")} size="sm" variant="ghost">
              All dashboards
            </Button>
          )}
          eyebrow="Your workspace"
          id="dashboards-heading"
          title="Continue working"
        />
        {data.dashboards.length > 0 ? (
          <div className="divide-y divide-divider overflow-hidden rounded-xl border border-divider bg-content1">
            {data.dashboards.map((dashboard) => (
              <div
                className="flex cursor-pointer flex-row items-center gap-3 px-4 py-3 hover:bg-content2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-soft-hover"
                key={dashboard.id}
                onClick={() => navigate(`/dashboard/${dashboard.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/dashboard/${dashboard.id}`);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-row items-center gap-2">
                    <span className="truncate font-medium">{dashboard.name}</span>
                    {dashboard.pinned ? (
                      <Chip size="sm" variant="soft">
                        <Chip.Label>Pinned</Chip.Label>
                      </Chip>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-foreground-500">
                    {dashboard.chartCount} {dashboard.chartCount === 1 ? "chart" : "charts"}
                    {" · "}
                    {formatTimeAgo(dashboard.lastUpdatedAt)}
                  </p>
                </div>
                <LuChevronRight className="shrink-0 text-foreground-400" size={16} aria-hidden />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-divider bg-content1 px-4 py-5">
            <p className="font-medium">No dashboards available</p>
            <p className="mt-1 text-sm text-foreground-500">
              Dashboards you create or can access will appear here.
            </p>
            <Button className="mt-3" onPress={() => navigate("/dashboards")} size="sm" variant="secondary">
              Browse dashboards
            </Button>
          </div>
        )}
      </section>

      {digests.length === 0
        && ![
          "connect_data",
          "create_dataset",
          "waiting_for_metrics",
          "waiting_for_setup",
          "watch_metric",
          "watch_record_count",
        ].includes(data.setupState) ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-divider bg-content1 px-4 py-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-medium">Get a scheduled summary</p>
            <p className="text-sm text-foreground-500">
              Choose when Chartbrew emails changes and data-health issues you can access.
            </p>
          </div>
          <Button
            onPress={() => setSummaryModalOpen(true)}
            size="sm"
            variant="secondary"
          >
            Schedule summary
          </Button>
        </div>
      ) : null}

      <SummaryScheduleModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        onSaved={saveSummary}
        teamId={team.id}
      />
      <RecordCountMonitorModal
        isOpen={recordCountModalOpen}
        isPending={recordCountPending}
        onClose={() => setRecordCountModalOpen(false)}
        onSubmit={createRecordCount}
        options={data.recordCountOptions || []}
      />
    </main>
  );
}

export default Home;
