import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Chip, Spinner, Table,
} from "@heroui/react";
import {
  LuArrowRight,
  LuChartNoAxesColumn,
  LuChartNoAxesColumnIncreasing,
  LuChevronRight,
  LuDatabase,
  LuPlug,
  LuRefreshCw,
  LuTrendingDown,
  LuTrendingUp,
} from "react-icons/lu";
import { useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  getHome,
  getMonitorRecommendations,
  getObservationDigests,
  resolveObservation,
} from "../../api/observations";
import { selectTeam } from "../../slices/team";
import { completeTutorial, selectUser } from "../../slices/user";
import HomeAsk from "../Ai/HomeAsk";
import SummaryScheduleModal from "../Activity/SummaryScheduleModal";
import {
  formatCompactComparison,
  formatObservationChangeMagnitude,
  formatTimeAgo,
} from "../../modules/observationFormat";
import canAccess from "../../config/canAccess";
import HomeDiscover from "./HomeDiscover";
import HomeOnboarding from "./HomeOnboarding";
import {
  buildHomeActivityRows,
  removeHomeActivityItem,
  shouldShowNeedsAttention,
} from "./homeAttentionState";
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

function getActivityIcon(row) {
  const iconProps = { size: 18, "aria-hidden": true };
  if (row.category !== "health") {
    return row.item.direction === "increase"
      ? <LuTrendingUp {...iconProps} />
      : <LuTrendingDown {...iconProps} />;
  }
  if (row.item.type === "connection") return <LuPlug {...iconProps} />;
  if (row.item.type === "dataset") return <LuDatabase {...iconProps} />;
  if (row.item.type === "chart") return <LuChartNoAxesColumn {...iconProps} />;
  return <LuRefreshCw {...iconProps} />;
}

function Home() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [data, setData] = useState(null);
  const [digests, setDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendationCount, setRecommendationCount] = useState(0);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
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
        setRecommendationCount(recommendationsResult.status === "fulfilled"
          ? recommendationsResult.value.length
          : 0);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [team?.id]);

  useEffect(() => {
    setOnboardingDismissed(false);
  }, [team?.id]);

  const saveSummary = (subscription) => {
    setDigests((current) => {
      const exists = current.some((item) => item.id === subscription.id);
      return exists
        ? current.map((item) => item.id === subscription.id ? subscription : item)
        : [subscription, ...current];
    });
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
  const onboardingDismissedKey = `homeOnboarding:${team.id}`;
  const showOnboarding = canAccess("teamAdmin", user?.id, team.TeamRoles)
    && data.onboarding
    && Object.values(data.onboarding.milestones).some((complete) => !complete)
    && !onboardingDismissed
    && !user.tutorials?.[onboardingDismissedKey];
  const showNeedsAttention = shouldShowNeedsAttention({
    hasWatchedMetric: data.hasWatchedMetric,
    recommendationCount,
  });
  const activityRows = buildHomeActivityRows({
    dataHealth: showNeedsAttention && data.dataHealth.showOnHome
      ? data.dataHealth.items
      : [],
    needsAttention: showNeedsAttention ? needsAttention : [],
    notableChanges,
  });
  const canResolveActivity = canAccess("projectEditor", user?.id, team.TeamRoles);

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    dispatch(completeTutorial({
      tutorial: { [onboardingDismissedKey]: true },
      user_id: user.id,
    })).unwrap().catch(() => {
      setOnboardingDismissed(false);
      toast.error("Could not dismiss Get started");
    });
  };

  const resolveActivity = async (row) => {
    setResolvingId(row.id);
    try {
      await resolveObservation(team.id, row.item.id);
      setData((current) => removeHomeActivityItem(current, row.item.id));
      window.dispatchEvent(new CustomEvent("cb:activity-updated"));
      toast.success("Change resolved");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setResolvingId(null);
    }
  };

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

      {showOnboarding ? (
        <section aria-label="Get started">
          <HomeOnboarding onboarding={data.onboarding} onDismiss={dismissOnboarding} />
        </section>
      ) : null}

      {showNeedsAttention || activityRows.length > 0 ? (
        <section aria-labelledby="attention-heading">
          <SectionHeading
            action={(
              <Button onPress={() => navigate("/activity")} size="sm" variant="tertiary">
                View all
                <LuArrowRight aria-hidden />
              </Button>
            )}
            id="attention-heading"
            title="Metric activity"
          />
          <Table className="overflow-hidden border border-divider shadow-none">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Metric activity"
                className="min-w-[760px]"
                onRowAction={(key) => {
                  const row = activityRows.find((item) => item.id === key);
                  if (row) navigate(row.path);
                }}
              >
                <Table.Header>
                  <Table.Column id="activity" isRowHeader textValue="Activity">Activity</Table.Column>
                  <Table.Column id="category" textValue="Category">Category</Table.Column>
                  <Table.Column id="workspace" textValue="Workspace">Workspace</Table.Column>
                  <Table.Column id="change" textValue="Change">Change</Table.Column>
                  <Table.Column id="detected" textValue="Detected">Detected</Table.Column>
              <Table.Column id="action" textValue="Row actions" />
                </Table.Header>
                <Table.Body renderEmptyState={() => (
                  <span className="text-sm text-muted">No metric activity needs review.</span>
                )}>
                  {activityRows.map((row) => {
                    const isHealth = row.category === "health";
                    const isAttention = row.category === "attention";
                    const metricName = row.item.chart?.name
                      || row.item.monitor?.name
                      || "Watched metric";
                    const changeMagnitude = isHealth
                      ? null
                      : formatObservationChangeMagnitude(row.item);
                    const changeClass = isHealth
                      ? "text-warning"
                      : isAttention
                        ? "text-danger"
                        : "text-success";
                    return (
                      <Table.Row className="cursor-pointer" id={row.id} key={row.id}>
                        <Table.Cell>
                          <div className="flex max-w-md items-center gap-3 py-1">
                            <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-current/10 ${changeClass}`}>
                              {getActivityIcon(row)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {isHealth ? row.item.title : metricName}
                              </p>
                              <p className="truncate text-xs text-muted">
                                {isHealth
                                  ? row.item.message
                                  : formatCompactComparison(row.item) || row.item.summary}
                              </p>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip
                            color={isHealth ? "warning" : isAttention ? "danger" : "success"}
                            size="sm"
                            variant="soft"
                          >
                            <Chip.Label className="truncate">
                              {isHealth
                                ? "Data health"
                                : isAttention ? "Needs attention" : "Notable change"}
                            </Chip.Label>
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>{row.item.project?.name || "Workspace"}</Table.Cell>
                        <Table.Cell className={`whitespace-nowrap font-medium ${changeClass}`}>
                          {changeMagnitude
                            ? `${row.item.direction === "increase" ? "+" : "−"}${changeMagnitude}`
                            : "—"}
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap text-sm text-muted">
                          {formatTimeAgo(row.item.detectedAt || row.item.lastDetectedAt)}
                        </Table.Cell>
                        <Table.Cell>
                    <div className="flex items-center justify-end gap-4">
                            {!isHealth && canResolveActivity ? (
                              <Button
                                aria-label={`Resolve ${metricName}`}
                                isPending={resolvingId === row.id}
                                onPress={() => resolveActivity(row)}
                                size="sm"
                                variant="tertiary"
                              >
                                {({ isPending }) => (
                                  <>
                                    {isPending ? <Spinner color="current" size="sm" /> : null}
                                    {isPending ? "Resolving..." : "Resolve"}
                                  </>
                                )}
                              </Button>
                            ) : null}
                            <LuChevronRight
                              className="text-foreground-400"
                              size={16}
                              aria-hidden
                            />
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </section>
      ) : null}

      <section aria-labelledby="dashboards-heading">
        <SectionHeading
          action={(
            <Button onPress={() => navigate("/dashboards")} size="sm" variant="tertiary">
              All dashboards
              <LuArrowRight aria-hidden />
            </Button>
          )}
          id="dashboards-heading"
          title="Continue working"
        />
        {data.dashboards.length > 0 ? (
          <div className="divide-y divide-divider overflow-hidden rounded-3xl border border-divider bg-surface">
            {data.dashboards.map((dashboard) => (
              <div
                className="flex cursor-pointer flex-row items-center gap-3 px-4 py-3.5 hover:bg-background-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-soft-hover"
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
          <div className="rounded-3xl border border-divider bg-surface px-4 py-5">
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
        <div className="flex flex-col items-start gap-3 rounded-3xl border border-divider bg-surface px-4 py-4 md:flex-row md:items-center">
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
    </main>
  );
}

export default Home;
