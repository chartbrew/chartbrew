import React from "react";
import PropTypes from "prop-types";
import { Button, Card } from "@heroui/react";
import {
  LuActivity,
  LuArrowRight,
  LuCircleCheck,
  LuDatabase,
  LuRefreshCw,
  LuX,
} from "react-icons/lu";
import { useNavigate } from "react-router";

import { formatTimeAgo } from "../../../modules/observationFormat";

function getSetupAction(home) {
  const firstDashboard = home.dashboards?.[0];
  return {
    collecting_baseline: {
      action: "View progress",
      description: "Chartbrew needs two complete periods or values near two period boundaries.",
      icon: LuRefreshCw,
      iconClassName: "text-foreground-400",
      path: "/activity?tab=monitors",
      title: "Waiting for a complete comparison",
    },
    connect_data: {
      action: "Connect data",
      description: "Connect a source before creating dashboards and watching metrics.",
      icon: LuDatabase,
      iconClassName: "text-foreground-400",
      path: "/connections/new",
      title: "Connect your first source",
    },
    metrics_need_review: {
      action: "Review watched metrics",
      description: "A watched chart changed and its metric can no longer be evaluated.",
      icon: LuActivity,
      iconClassName: "text-warning",
      path: "/activity?tab=monitors",
      title: "A watched metric needs review",
    },
    no_important_changes: {
      action: "View activity",
      description: "There are no open changes in your watched metrics that need attention.",
      icon: LuCircleCheck,
      iconClassName: "text-success",
      path: "/activity",
      title: "No changes need attention",
    },
    watch_metric: {
      action: firstDashboard ? "Open a dashboard" : "Create a dashboard",
      description: "Choose a chart metric and how Chartbrew should compare it.",
      icon: LuActivity,
      iconClassName: "text-foreground-400",
      path: firstDashboard ? `/dashboard/${firstDashboard.id}` : "/dashboards?create=dashboard",
      title: "Watch a metric",
    },
    waiting_for_metrics: {
      action: "View dashboards",
      description: "A workspace editor can choose a metric for Chartbrew to monitor.",
      icon: LuActivity,
      iconClassName: "text-foreground-400",
      path: "/dashboards",
      title: "No watched metrics yet",
    },
    waiting_for_data: {
      action: "View watched metrics",
      description: "The latest refresh did not return enough data to evaluate your watched metrics.",
      icon: LuRefreshCw,
      iconClassName: "text-warning",
      path: "/activity?tab=monitors",
      title: "Waiting for data",
    },
  }[home.setupState] || null;
}

function PanelItem({ action, description, icon, iconClassName, meta, onPress, title }) {
  const Icon = icon;
  return (
    <div className="flex flex-row items-start gap-3 px-4 py-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-divider bg-surface-secondary/40">
        <Icon className={iconClassName || "text-foreground-400"} size={18} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
        {meta ? (
          <p className="mt-2 text-xs text-muted">{meta}</p>
        ) : null}
        <Button className="mt-2" onPress={onPress} size="sm" variant="tertiary">
          {action}
          <LuArrowRight size={16} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

PanelItem.propTypes = {
  action: PropTypes.string.isRequired,
  description: PropTypes.string,
  icon: PropTypes.func.isRequired,
  iconClassName: PropTypes.string,
  meta: PropTypes.string,
  onPress: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
};

PanelItem.defaultProps = {
  description: undefined,
  iconClassName: undefined,
  meta: undefined,
};

function WorkspaceAttentionPanel({ home, onCollapse }) {
  const navigate = useNavigate();
  const observation = home.observations?.[0];
  const healthIssue = home.dataHealth?.items?.[0];
  const setup = getSetupAction(home);
  const hasContent = Boolean(observation || healthIssue || setup);

  return (
    <Card className="gap-0 rounded-3xl border border-divider p-0 shadow-none">
      <Card.Header className="flex flex-row items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <Card.Title className="text-base font-semibold">
            What to look at next
          </Card.Title>
          <Card.Description>From dashboards you can access.</Card.Description>
        </div>
        <Button
          aria-label="Hide attention panel"
          isIconOnly
          onPress={onCollapse}
          size="sm"
          variant="ghost"
        >
          <LuX size={16} aria-hidden />
        </Button>
      </Card.Header>
      {hasContent ? (
        <Card.Content className="mt-3 divide-y divide-divider border-t border-divider">
          {observation ? (
            <PanelItem
              action="View change"
              description={observation.project?.name || "Workspace"}
              icon={LuActivity}
              iconClassName="text-warning"
              meta={`Detected ${formatTimeAgo(observation.lastDetectedAt)}`}
              onPress={() => navigate(`/activity/${observation.id}`)}
              title={observation.title}
            />
          ) : null}

          {setup ? (
            <PanelItem
              action={setup.action}
              description={setup.description}
              icon={setup.icon}
              iconClassName={setup.iconClassName}
              onPress={() => navigate(setup.path)}
              title={setup.title}
            />
          ) : null}

          {healthIssue ? (
            <PanelItem
              action="Review data health"
              description={healthIssue.title && healthIssue.title !== healthIssue.message
                ? healthIssue.message
                : undefined}
              icon={LuRefreshCw}
              iconClassName="text-warning"
              meta={`Detected ${formatTimeAgo(healthIssue.detectedAt)}`}
              onPress={() => navigate("/activity?tab=health")}
              title={healthIssue.title || healthIssue.message}
            />
          ) : null}
        </Card.Content>
      ) : (
        <Card.Content className="mt-3 border-t border-divider px-4 py-10">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-11 items-center justify-center rounded-lg border border-divider bg-surface-secondary/40">
              <LuCircleCheck className="text-success" size={22} aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">Nothing needs attention</p>
              <p className="text-sm text-muted">
                Changes and data issues will show up here when they appear.
              </p>
            </div>
          </div>
        </Card.Content>
      )}
    </Card>
  );
}

WorkspaceAttentionPanel.propTypes = {
  home: PropTypes.object.isRequired,
  onCollapse: PropTypes.func.isRequired,
};

export default WorkspaceAttentionPanel;
