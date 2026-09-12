import React from "react";
import PropTypes from "prop-types";
import {
  Button, Card, Tooltip,
} from "@heroui/react";
import {
  LuArrowRight,
  LuCalendarClock,
  LuChartColumn,
  LuCircleCheck,
  LuEye,
  LuLayers3,
  LuPlug,
  LuShare2,
  LuUserPlus,
  LuX,
} from "react-icons/lu";
import { useNavigate } from "react-router";

import { getOnboardingPlan } from "./homeOnboardingState";

const MILESTONES = [{
  action: "Connect data",
  description: "Connect a database, API, or service so Chartbrew can use your data in dashboards.",
  icon: LuPlug,
  key: "connection",
  label: "Connect a data source",
  path: "/connections/new",
}, {
  action: "Create dataset",
  description: "Shape connected data into a reusable dataset that can power charts across your dashboards.",
  icon: LuLayers3,
  key: "dataset",
  label: "Create a dataset",
  path: "/datasets/new",
}, {
  action: "Create chart",
  description: "Turn your dataset into a clear visualization that helps your team understand what is changing.",
  icon: LuChartColumn,
  key: "chart",
  label: "Create your first chart",
}, {
  action: "Invite teammate",
  description: "Invite a teammate to help connect data, build dashboards, or review results.",
  icon: LuUserPlus,
  key: "teammate",
  label: "Invite a teammate",
  path: "/settings/team/members",
  secondaryAction: "Invite",
}, {
  action: "Set up updates",
  description: "Choose an update schedule so your charts stay current without manual refreshes.",
  icon: LuCalendarClock,
  key: "automaticUpdates",
  label: "Set up automatic updates",
  secondaryAction: "Set up",
}, {
  action: "Watch metric",
  description: "Choose an important metric and let Chartbrew track changes that may need your attention.",
  icon: LuEye,
  key: "watchedMetric",
  label: "Watch a metric",
  path: "/activity?tab=monitors",
  secondaryAction: "Watch",
}, {
  action: "Share dashboard",
  description: "Publish or share a dashboard so the right people can see the latest results.",
  icon: LuShare2,
  key: "sharedDashboard",
  label: "Share a dashboard",
  secondaryAction: "Share",
}];

const FOUNDATION_KEYS = ["connection", "dataset", "chart"];
const SECONDARY_KEYS = ["automaticUpdates", "watchedMetric", "teammate", "sharedDashboard"];

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
  const availableSecondaryKeys = new Set(plan.secondaryKeys);
  const secondary = MILESTONES.filter((item) => (
    SECONDARY_KEYS.includes(item.key)
    && availableSecondaryKeys.has(item.key)
    && !onboarding.milestones[item.key]
    && item.key !== primary?.key
  ));
  const comingUp = plan.comingUpKeys.map((key) => (
    MILESTONES.find((item) => item.key === key)
  ));
  if (!primary) return null;
  const PrimaryIcon = primary.icon;
  const foundationInProgress = FOUNDATION_KEYS.includes(primary.key);

  return (
    <Card className="gap-0 overflow-hidden rounded-3xl border border-divider shadow-none">
      <Card.Header className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2 px-2 py-2">
        <div className="min-w-24 flex-1">
          <Card.Title className="text-lg font-semibold">Get started</Card.Title>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-medium text-muted">
            {`${completed.length} of ${MILESTONES.length} complete`}
          </span>
          <Tooltip>
            <Tooltip.Trigger>
              <Button
                aria-label="Dismiss Get started"
                isIconOnly
                onPress={onDismiss}
                size="sm"
                variant="tertiary"
              >
                <LuX size={16} aria-hidden />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Dismiss</Tooltip.Content>
          </Tooltip>
        </div>
      </Card.Header>
      <Card.Content className="gap-4 px-2 pb-2">
        <div
          aria-label={`${completed.length} of ${MILESTONES.length} onboarding steps complete. Current step: ${primary.label}.`}
          aria-valuemax={MILESTONES.length}
          aria-valuemin={0}
          aria-valuenow={completed.length}
          className="flex gap-1.5"
          role="progressbar"
        >
          {MILESTONES.map((item) => {
            const complete = onboarding.milestones[item.key];
            const current = item.key === primary.key;
            return (
              <span
                aria-hidden
                className={`h-1.5 basis-0 rounded-full ${FOUNDATION_KEYS.includes(item.key) ? "flex-[2]" : "flex-1"} ${complete ? "bg-success" : current ? "bg-warning" : "bg-surface-tertiary"}`}
                key={item.key}
              />
            );
          })}
        </div>

        {completed.length > 0 ? (
          <div className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Completed steps">
            {completed.map((item) => (
              <div className="flex items-center gap-1.5 text-sm text-muted" key={item.key}>
                <LuCircleCheck className="text-success" size={16} aria-hidden />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.9fr)] xl:gap-6">
          <div className="flex flex-col gap-4 rounded-2xl bg-accent/6 p-4 h-full justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <PrimaryIcon size={18} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">
                  {foundationInProgress ? "Next step" : "Recommended"}
                </p>
                <p className="font-semibold">{primary.label}</p>
                <p className="mt-0.5 text-sm text-muted">{primary.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {comingUp.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                  <span className="font-medium text-foreground-500">Coming up:</span>
                  {comingUp.map((item, index) => (
                    <React.Fragment key={item.key}>
                      {index > 0 ? <span aria-hidden>·</span> : null}
                      <span className="underline decoration-dashed">{item.label}</span>
                    </React.Fragment>
                  ))}
                </div>
              ) : null}
              <Button
                className="ml-auto w-full md:w-auto"
                onPress={() => navigate(getMilestonePath(primary, onboarding.dashboardId))}
                size="sm"
                variant="primary"
              >
                {primary.action}
                <LuArrowRight size={16} aria-hidden />
              </Button>
            </div>
          </div>

          {secondary.length > 0 ? (
            <div className="border-t border-divider pt-4 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <div className="divide-y divide-divider">
                {secondary.map((item) => {
                  const SecondaryIcon = item.icon;
                  return (
                    <div
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      key={item.key}
                    >
                      <SecondaryIcon className="shrink-0 text-muted" size={17} aria-hidden />
                      <span className="min-w-0 flex-1 text-sm font-medium">{item.label}</span>
                      <Button
                        className="shrink-0"
                        onPress={() => navigate(getMilestonePath(item, onboarding.dashboardId))}
                        size="sm"
                        variant="secondary"
                      >
                        {item.secondaryAction || item.action}
                        <LuArrowRight size={15} aria-hidden />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
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
