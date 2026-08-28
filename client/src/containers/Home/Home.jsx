import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Card, Chip, Dropdown, Spinner,
} from "@heroui/react";
import {
  LuActivity,
  LuArrowRight,
  LuChartNoAxesColumnIncreasing,
  LuChevronRight,
  LuCircleCheck,
  LuClock,
  LuDatabase,
  LuEllipsis,
  LuEyeOff,
  LuRefreshCw,
  LuSparkles,
} from "react-icons/lu";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  acceptMonitorRecommendation,
  dismissMonitorRecommendation,
  getHome,
  getMonitorRecommendations,
  getObservationDigests,
} from "../../api/observations";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import HomeAsk from "../Ai/HomeAsk";
import ObservationCard from "../Activity/ObservationCard";
import SummaryScheduleModal from "../Activity/SummaryScheduleModal";
import { formatTimeAgo } from "../../modules/observationFormat";
import HomeDiscover from "./HomeDiscover";
import WatchMetricModal from "../Chart/components/WatchMetricModal";
import { getLinePause, getTypeDelay } from "./typewriter";

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function Caret({ blink = true }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!blink) return undefined;
    const id = setInterval(() => setOn((visible) => !visible), 530);
    return () => clearInterval(id);
  }, [blink]);
  return (
    <span
      aria-hidden
      className={`ml-px inline-block h-[0.85em] w-[0.55ch] translate-y-[0.08em] bg-secondary-400 ${on ? "opacity-100" : "opacity-0"}`}
    />
  );
}

Caret.propTypes = {
  blink: PropTypes.bool,
};

function HomeGreeting({ subtitle, title }) {
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const [titleLength, setTitleLength] = useState(reducedMotion ? title.length : 0);
  const [subtitleLength, setSubtitleLength] = useState(reducedMotion ? subtitle.length : 0);
  const [phase, setPhase] = useState(reducedMotion ? "done" : "title");

  useEffect(() => {
    if (reducedMotion) return undefined;
    if (phase === "title") {
      if (titleLength >= title.length) {
        const id = setTimeout(() => setPhase("subtitle"), getLinePause());
        return () => clearTimeout(id);
      }
      const id = setTimeout(
        () => setTitleLength((count) => count + 1),
        getTypeDelay(title[titleLength] || "")
      );
      return () => clearTimeout(id);
    }
    if (phase === "subtitle") {
      if (subtitleLength >= subtitle.length) {
        setPhase("done");
        return undefined;
      }
      const id = setTimeout(
        () => setSubtitleLength((count) => count + 1),
        getTypeDelay(subtitle[subtitleLength] || "")
      );
      return () => clearTimeout(id);
    }
    return undefined;
  }, [phase, reducedMotion, subtitle, subtitleLength, title, titleLength]);

  return (
    <header aria-label={`${title} ${subtitle}`} className="flex flex-col gap-1">
      <h1 className="font-tw text-2xl font-semibold">
        <span aria-hidden>
          {title.slice(0, titleLength)}
          {phase === "title" ? <Caret /> : null}
        </span>
        <span className="sr-only">{title}</span>
      </h1>
      <p className="min-h-5 text-sm text-foreground-500">
        <span aria-hidden>
          {subtitle.slice(0, subtitleLength)}
          {phase !== "title" ? <Caret blink={!reducedMotion} /> : null}
        </span>
        <span className="sr-only">{subtitle}</span>
      </p>
    </header>
  );
}

HomeGreeting.propTypes = {
  subtitle: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

function SectionHeading({ action, eyebrow, id, title }) {
  return (
    <div className="mb-3 flex flex-row items-end justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">
            {eyebrow}
          </p>
        )}
        <h2 className="text-lg font-semibold" id={id}>{title}</h2>
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
      description: "Chartbrew needs two complete periods or values near two period boundaries.",
      icon: <LuRefreshCw aria-hidden />,
      onPress: () => navigate("/activity?tab=monitors"),
      title: "Waiting for a complete comparison",
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
      description: "Choose a chart metric and how Chartbrew should compare it.",
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
    <div className="flex flex-row items-start gap-3 rounded-3xl border border-divider bg-content1 px-4 py-5">
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
  state: PropTypes.string.isRequired,
};

function DataHealthAttention({ count, onPress }) {
  return (
    <Card className="h-full gap-0 rounded-3xl border border-divider shadow-none">
      <Card.Header className="flex flex-row items-center gap-2 pb-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-divider bg-warning/10">
          <LuRefreshCw className="text-warning" size={16} aria-hidden />
        </div>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted">
          Data health
        </p>
      </Card.Header>
      <Card.Content className="flex-1 gap-1">
        <Card.Title className="text-base font-semibold">
          {count} data {count === 1 ? "issue needs" : "issues need"} attention
        </Card.Title>
        <p className="text-sm text-muted">
          Review this before relying on the affected metrics.
        </p>
      </Card.Content>
      <Card.Footer className="justify-between gap-3 pt-3">
        <Button onPress={onPress} size="sm" variant="tertiary">
          Review data health
          <LuArrowRight aria-hidden />
        </Button>
      </Card.Footer>
    </Card>
  );
}

DataHealthAttention.propTypes = {
  count: PropTypes.number.isRequired,
  onPress: PropTypes.func.isRequired,
};

function MetricRecommendation({ isPending, onDismiss, onReview, recommendation }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-divider bg-content1 px-4 py-4 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 flex-row items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-divider bg-accent/10 text-accent">
          <LuSparkles size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Suggested metric
          </p>
          <p className="mt-0.5 font-medium text-foreground">{recommendation.name}</p>
          <p className="mt-1 text-sm text-muted">
            {recommendation.learningReason ? `${recommendation.learningReason} ` : ""}
            {recommendation.reasons[0]}
            {" · "}{recommendation.project.name} · {recommendation.chart.name}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-row items-center gap-2 self-end md:self-auto">
        <Button isDisabled={isPending} onPress={onReview} size="sm" variant="secondary">
          Review
        </Button>
        <Dropdown aria-label={`Options for ${recommendation.name}`}>
          <Dropdown.Trigger
            aria-label={`Dismiss ${recommendation.name}`}
            className="flex size-8 items-center justify-center rounded-3xl text-foreground transition-colors hover:bg-content2 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
            isDisabled={isPending}
          >
            {isPending ? <Spinner aria-hidden size="sm" /> : <LuEllipsis size={18} aria-hidden />}
          </Dropdown.Trigger>
          <Dropdown.Popover>
            <Dropdown.Menu>
              <Dropdown.Item id="later" onPress={() => onDismiss("later")} textValue="Not now">
                <LuClock size={16} aria-hidden />
                Not now
              </Dropdown.Item>
              <Dropdown.Item
                id="definition"
                onPress={() => onDismiss("definition")}
                textValue="Do not suggest this metric"
              >
                <LuEyeOff size={16} aria-hidden />
                Don&apos;t suggest this metric
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </div>
  );
}

MetricRecommendation.propTypes = {
  isPending: PropTypes.bool.isRequired,
  onDismiss: PropTypes.func.isRequired,
  onReview: PropTypes.func.isRequired,
  recommendation: PropTypes.shape({
    chart: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired,
    name: PropTypes.string.isRequired,
    project: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired,
    reasons: PropTypes.arrayOf(PropTypes.string).isRequired,
    learningReason: PropTypes.string,
  }).isRequired,
};

function Home() {
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [data, setData] = useState(null);
  const [digests, setDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState(null);
  const [recommendationPending, setRecommendationPending] = useState(false);
  const [recommendationReviewOpen, setRecommendationReviewOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  useEffect(() => {
    if (!team?.id) return;
    setLoading(true);
    Promise.allSettled([
      getHome(team.id),
      getObservationDigests(team.id),
      getMonitorRecommendations(team.id),
    ])
      .then(([homeResult, subscriptionsResult, recommendationsResult]) => {
        if (homeResult.status === "rejected") throw homeResult.reason;
        const home = homeResult.value;
        const subscriptions = subscriptionsResult.status === "fulfilled"
          ? subscriptionsResult.value
          : [];
        setData(home);
        setDigests(subscriptions);
        setRecommendation(recommendationsResult.status === "fulfilled"
          ? recommendationsResult.value[0] || null
          : null);
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

  const acceptRecommendation = async (settings) => {
    if (!recommendation) return;
    setRecommendationPending(true);
    try {
      const monitor = await acceptMonitorRecommendation(team.id, recommendation.id, settings);
      setRecommendation(null);
      setRecommendationReviewOpen(false);
      toast.success(`Watching ${monitor.name}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecommendationPending(false);
    }
  };

  const dismissRecommendation = async (type) => {
    if (!recommendation) return;
    setRecommendationPending(true);
    try {
      await dismissMonitorRecommendation(team.id, recommendation.id, type);
      setRecommendation(null);
      toast.success(type === "later"
        ? "Suggestion hidden for 30 days"
        : "This metric will not be suggested again unless the chart changes");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRecommendationPending(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading Home" />
      </div>
    );
  }

  const needsAttention = data.needsAttention
    || data.observations.filter((observation) => observation.impact !== "positive");
  const notableChanges = data.notableChanges
    || data.observations.filter((observation) => observation.impact === "positive");
  const showRecommendation = recommendation
    && data.setupState === "no_important_changes"
    && needsAttention.length === 0
    && !data.dataHealth.showOnHome;

  return (
    <main className="flex w-full flex-col gap-6">
      <HomeGreeting
        subtitle={`Here is what is moving across ${team.name}`}
        title={`Good to see you, ${user?.name?.split(" ")[0] || "there"}.`}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <HomeAsk teamId={team.id} />
        </div>

        <div className="hidden w-80 shrink-0 self-start lg:block xl:w-90">
          <HomeDiscover />
        </div>
      </div>

      <section aria-labelledby="attention-heading">
        <SectionHeading
          action={(
            <Button onPress={() => navigate("/activity")} size="sm" variant="ghost">
              View all
              <LuArrowRight aria-hidden />
            </Button>
          )}
          id="attention-heading"
          title="Needs attention"
        />
        {needsAttention.length > 0 || data.dataHealth.showOnHome ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.dataHealth.showOnHome ? (
              <DataHealthAttention
                count={data.dataHealth.count}
                onPress={() => navigate("/activity?tab=health")}
              />
            ) : null}
            {needsAttention.map((observation) => (
              <ObservationCard key={observation.id} observation={observation} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <SetupState state={data.setupState} />
            {showRecommendation ? (
              <MetricRecommendation
                isPending={recommendationPending}
                onDismiss={dismissRecommendation}
                onReview={() => setRecommendationReviewOpen(true)}
                recommendation={recommendation}
              />
            ) : null}
          </div>
        )}
      </section>

      {notableChanges.length > 0 ? (
        <section aria-labelledby="notable-heading">
          <SectionHeading
            id="notable-heading"
            title="Notable changes"
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {notableChanges.map((observation) => (
              <ObservationCard key={observation.id} observation={observation} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="dashboards-heading">
        <SectionHeading
          action={(
            <Button onPress={() => navigate("/dashboards")} size="sm" variant="ghost">
              All dashboards
              <LuArrowRight aria-hidden />
            </Button>
          )}
          id="dashboards-heading"
          title="Continue working"
        />
        {data.dashboards.length > 0 ? (
          <div className="divide-y divide-divider overflow-hidden rounded-3xl border border-divider bg-content1">
            {data.dashboards.map((dashboard) => (
              <div
                className="flex cursor-pointer flex-row items-center gap-3 px-4 py-3.5 hover:bg-content2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-soft-hover"
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
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-foreground-600">
                  <LuChartNoAxesColumnIncreasing size={18} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-row items-center gap-2">
                    <span className="truncate font-medium text-foreground">{dashboard.name}</span>
                    {dashboard.pinned ? (
                      <Chip size="sm" variant="soft">
                        <Chip.Label>Pinned</Chip.Label>
                      </Chip>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
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
          <div className="rounded-3xl border border-divider bg-content1 px-4 py-5">
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
        ].includes(data.setupState) ? (
        <div className="flex flex-col items-start gap-3 rounded-3xl border border-divider bg-content1 px-4 py-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-medium">Get a KPI review</p>
            <p className="text-sm text-foreground-500">
              Get the latest result for each watched metric in one email.
            </p>
          </div>
          <Button
            onPress={() => setSummaryModalOpen(true)}
            size="sm"
            variant="secondary"
          >
            Schedule review
          </Button>
        </div>
      ) : null}

      <SummaryScheduleModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        onSaved={saveSummary}
        teamId={team.id}
      />
      <WatchMetricModal
        chartName={recommendation?.chart?.name}
        description="Choose how Chartbrew should watch this chart."
        heading="Review suggested metric"
        initialImportance={recommendation?.defaultImportance || 1}
        initialLayerId={recommendation?.layerId || null}
        isOpen={recommendationReviewOpen && Boolean(recommendation)}
        isPending={recommendationPending}
        lockMetric
        onClose={() => {
          if (!recommendationPending) setRecommendationReviewOpen(false);
        }}
        onSubmit={acceptRecommendation}
        options={recommendation ? [{
          aggregate: recommendation.aggregate,
          calendarTimezone: recommendation.calendarTimezone,
          id: recommendation.layerId,
          kind: recommendation.kind,
          name: recommendation.name,
          periodAvailability: recommendation.periodAvailability,
          recommendedMetricBehavior: recommendation.recommendedMetricBehavior,
          timeUnit: recommendation.timeUnit,
          valueFormat: recommendation.valueFormat,
        }] : []}
        submitLabel="Start watching"
      />
    </main>
  );
}

export default Home;
