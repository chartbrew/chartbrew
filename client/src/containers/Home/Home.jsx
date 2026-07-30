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

import { createObservationDigest, getHome, getObservationDigests } from "../../api/observations";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import HomeAsk from "../Ai/HomeAsk";
import ObservationCard from "../Activity/ObservationCard";
import { formatTimeAgo } from "../../modules/observationFormat";

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

function SetupState({ state }) {
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
    data_needs_attention: {
      action: "Review data health",
      description: "A recent refresh failed. Business changes are paused until the data recovers.",
      icon: <LuRefreshCw aria-hidden />,
      onPress: () => navigate("/activity?tab=health"),
      title: "Some data needs attention",
    },
    metrics_need_review: {
      action: "Review watched metrics",
      description: "A watched chart changed and its metric can no longer be evaluated.",
      icon: <LuActivity aria-hidden />,
      onPress: () => navigate("/activity?tab=monitors"),
      title: "A watched metric needs review",
    },
    no_important_changes: {
      action: "View activity",
      description: "There are no open changes in your watched metrics that need attention.",
      icon: <LuCircleCheck aria-hidden />,
      onPress: () => navigate("/activity"),
      title: "No changes need attention",
    },
    watch_metric: {
      action: "Browse dashboards",
      description: "Choose an eligible chart metric to establish a baseline and detect changes.",
      icon: <LuActivity aria-hidden />,
      onPress: () => navigate("/dashboards"),
      title: "Watch a metric to get started",
    },
    waiting_for_metrics: {
      action: "Browse dashboards",
      description: "A workspace editor can choose a metric for Chartbrew to monitor.",
      icon: <LuActivity aria-hidden />,
      onPress: () => navigate("/dashboards"),
      title: "No watched metrics yet",
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
      <Button onPress={content.onPress} size="sm" variant="secondary">
        {content.action}
      </Button>
    </div>
  );
}

SetupState.propTypes = {
  state: PropTypes.string.isRequired,
};

function Home() {
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [data, setData] = useState(null);
  const [digests, setDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingDigest, setCreatingDigest] = useState(false);

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

  const createWeeklySummary = async () => {
    setCreatingDigest(true);
    try {
      const subscription = await createObservationDigest(team.id, {
        cadence: "weekly",
        localDeliveryTime: "09:00",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      setDigests((current) => [subscription, ...current]);
      toast.success("Weekly summary scheduled");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCreatingDigest(false);
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
    <main className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-tw text-2xl font-semibold">
          Good to see you, {user?.name?.split(" ")[0] || "there"}.
        </h1>
        <p className="text-sm text-foreground-500">
          Here is what is moving across {team.name}
        </p>
      </header>

      <HomeAsk teamId={team.id} />

      <section aria-labelledby="attention-heading">
        <SectionHeading
          action={(
            <Button onPress={() => navigate("/activity")} size="sm" variant="ghost">
              View all
              <LuArrowRight aria-hidden />
            </Button>
          )}
          eyebrow="Worth your attention"
          id="attention-heading"
          title="Recent changes"
        />
        {data.observations.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.observations.map((observation) => (
              <ObservationCard key={observation.id} observation={observation} />
            ))}
          </div>
        ) : (
          <SetupState state={data.setupState} />
        )}
      </section>

      {data.dataHealth.count > 0 ? (
        <div className="flex flex-row items-center gap-3 rounded-xl border border-divider bg-content1 px-4 py-3">
          <LuRefreshCw className="shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {data.dataHealth.count} refresh {data.dataHealth.count === 1 ? "issue" : "issues"}
            </p>
            <p className="text-sm text-foreground-500">
              Resolve these before relying on affected metrics.
            </p>
          </div>
          <Button onPress={() => navigate("/activity?tab=health")} size="sm" variant="secondary">
            Review
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="dashboards-heading">
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
          <SetupState state={data.setupState} />
        )}
      </section>

      {digests.length === 0
        && !["connect_data", "waiting_for_metrics", "watch_metric"].includes(data.setupState) ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-divider bg-content1 px-4 py-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-medium">Get a weekly summary</p>
            <p className="text-sm text-foreground-500">
              Receive changes and data issues you can access every Monday morning.
            </p>
          </div>
          <Button
            isPending={creatingDigest}
            onPress={createWeeklySummary}
            size="sm"
            variant="secondary"
          >
            Schedule weekly summary
          </Button>
        </div>
      ) : null}
    </main>
  );
}

export default Home;
