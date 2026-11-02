import React from "react";
import PropTypes from "prop-types";
import {
  Button, Card, ProgressBar, Tooltip,
} from "@heroui/react";
import {
  LuArrowRight,
  LuCalendarClock,
  LuCircleCheck,
  LuEye,
  LuLockKeyhole,
  LuShare2,
  LuUserPlus,
  LuX,
} from "react-icons/lu";
import { useNavigate } from "react-router";

import { getOnboardingPlan } from "./homeOnboardingState";

const MILESTONES = [{
  action: "Connect data",
  description: "Connect a database, API, or service so Chartbrew can use your data in dashboards.",
  key: "connection",
  label: "Connect a data source",
  path: "/connections/new",
}, {
  action: "Create dataset",
  description: "Shape connected data into a reusable dataset that can power charts across your dashboards.",
  key: "dataset",
  label: "Create a dataset",
  path: "/datasets/new",
}, {
  action: "Create chart",
  description: "Turn your dataset into a clear visualization that helps your team understand what is changing.",
  key: "chart",
  label: "Create your first chart",
}, {
  action: "Invite teammate",
  description: "Invite a teammate to help connect data, build dashboards, or review results.",
  icon: LuUserPlus,
  key: "teammate",
  label: "Invite a teammate",
  path: "/settings/team/members",
}, {
  action: "Set up updates",
  description: "Choose an update schedule so your charts stay current without manual refreshes.",
  icon: LuCalendarClock,
  key: "automaticUpdates",
  label: "Set up automatic updates",
}, {
  action: "Watch metric",
  description: "Choose an important metric and let Chartbrew track changes that may need your attention.",
  icon: LuEye,
  key: "watchedMetric",
  label: "Watch a metric",
  path: "/activity?tab=monitors",
}, {
  action: "Share dashboard",
  description: "Publish or share a dashboard so the right people can see the latest results.",
  icon: LuShare2,
  key: "sharedDashboard",
  label: "Share a dashboard",
}];

const FOUNDATION_KEYS = ["connection", "dataset", "chart"];
const SECONDARY_KEYS = ["teammate", "automaticUpdates", "watchedMetric", "sharedDashboard"];
const SECONDARY_DESCRIPTIONS = {
  teammate: "Build and review together.",
  automaticUpdates: "Keep your charts up to date.",
  watchedMetric: "Track changes that matter.",
  sharedDashboard: "Put your results in the right hands.",
};

function getMilestonePath(milestone, dashboardId) {
  if (milestone.path) return milestone.path;
  if (!dashboardId) return "/dashboards";
  if (milestone.key === "chart") return `/dashboard/${dashboardId}/chart`;
  const setup = milestone.key === "automaticUpdates" ? "updates" : "sharing";
  return `/dashboard/${dashboardId}?setup=${setup}`;
}

function HomeOnboarding({ onboarding, onDismiss }) {
  const navigate = useNavigate();
  const completed = MILESTONES.filter((item) => onboarding.milestones[item.key]);
  const plan = getOnboardingPlan(onboarding.milestones);
  const primary = MILESTONES.find((item) => item.key === plan.primaryKey);
  if (!primary) return null;
  const foundationInProgress = FOUNDATION_KEYS.includes(primary.key);
  const foundationStep = FOUNDATION_KEYS.indexOf(primary.key) + 1;

  return (
    <Card className="gap-5 rounded-3xl border border-divider p-4 shadow-none sm:p-6">
      <Card.Header className="flex flex-row items-center justify-between gap-3 p-0">
        <Card.Title className="text-lg font-semibold">Get started</Card.Title>
        <div className="flex items-center gap-3">
          <ProgressBar
            aria-label="Onboarding progress"
            className="w-16 sm:w-28"
            value={completed.length}
            maxValue={MILESTONES.length}
            size="sm"
          >
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <span className="text-sm tabular-nums text-muted">{completed.length}/{MILESTONES.length}</span>
          <Tooltip>
            <Tooltip.Trigger>
              <Button aria-label="Dismiss Get started" isIconOnly onPress={onDismiss} size="sm" variant="tertiary">
                <LuX size={16} aria-hidden />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Dismiss</Tooltip.Content>
          </Tooltip>
        </div>
      </Card.Header>
      <Card.Content className="gap-4 p-0">
        <div className="flex flex-col justify-between gap-5 rounded-2xl bg-accent p-5 text-accent-foreground sm:p-6 md:flex-row md:items-end">
          <div className="min-w-0 max-w-2xl">
            {foundationInProgress ? (
              <div className="mb-4 flex gap-1.5" aria-hidden>
                {FOUNDATION_KEYS.map((key) => (
                  <span key={key} className={`h-1.5 w-8 rounded-full ${key === primary.key || onboarding.milestones[key] ? "bg-accent-foreground" : "bg-accent-foreground/30"}`} />
                ))}
              </div>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground/80">
              {foundationInProgress ? `Step ${foundationStep} of 3` : "Next step"}
            </p>
            <h3 className="mt-2 text-xl font-semibold sm:text-2xl">{primary.label}</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-accent-foreground/90">{primary.description}</p>
          </div>
          <Button
            className="w-full shrink-0 bg-surface text-foreground md:w-auto"
            onPress={() => navigate(getMilestonePath(primary, onboarding.dashboardId))}
            variant="secondary"
          >
            {primary.action}
            <LuArrowRight size={16} aria-hidden />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SECONDARY_KEYS.map((key) => {
            const item = MILESTONES.find((milestone) => milestone.key === key);
            const complete = Boolean(onboarding.milestones[key]);
            const locked = key !== "teammate" && !onboarding.milestones.chart && !complete;
            const Icon = item.icon;
            return (
              <Button
                key={key}
                className={`h-auto w-full min-w-0 flex-col items-start justify-start gap-3 whitespace-normal rounded-2xl border p-4 text-left disabled:opacity-100 ${complete ? "border-success/40 bg-success-soft disabled:bg-success-soft" : "border-divider disabled:bg-surface-secondary"}`}
                variant="outline"
                isDisabled={locked || complete}
                onPress={() => navigate(getMilestonePath(item, onboarding.dashboardId))}
              >
                <span className="flex w-full items-center justify-between">
                  <Icon size={20} className={complete ? "text-success-soft-foreground" : locked ? "text-muted" : "text-accent"} aria-hidden />
                  {complete ? <LuCircleCheck size={20} className="text-success-soft-foreground" aria-label="Complete" /> : locked ? <LuLockKeyhole size={14} className="text-muted" aria-hidden /> : <LuArrowRight size={16} className="text-muted" aria-hidden />}
                </span>
                <span className="flex flex-col gap-1">
                  <span className={`text-sm font-semibold ${locked ? "text-muted" : "text-foreground"}`}>{item.label}</span>
                  <span className={`text-xs font-normal leading-5 ${complete ? "text-success-soft-foreground" : "text-muted"}`}>
                    {complete ? "Complete" : locked ? "Available after your first chart" : SECONDARY_DESCRIPTIONS[key]}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </Card.Content>
    </Card>
  );
}

HomeOnboarding.propTypes = {
  onboarding: PropTypes.shape({
    dashboardId: PropTypes.number,
    milestones: PropTypes.objectOf(PropTypes.bool).isRequired,
  }).isRequired,
  onDismiss: PropTypes.func.isRequired,
};

export default HomeOnboarding;
