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
      description: "Chartbrew is collecting enough history to compare your watched metrics.",
      icon: LuRefreshCw,
      path: "/activity?tab=monitors",
      title: "Building a baseline",
    },
    connect_data: {
      action: "Connect data",
      description: "Connect a source before creating dashboards and watching metrics.",
      icon: LuDatabase,
      path: "/connections/new",
      title: "Connect your first source",
    },
    metrics_need_review: {
      action: "Review watched metrics",
      description: "A watched chart changed and its metric can no longer be evaluated.",
      icon: LuActivity,
      path: "/activity?tab=monitors",
      title: "A watched metric needs review",
    },
    no_important_changes: {
      action: "View activity",
      description: "There are no open changes in your watched metrics that need attention.",
      icon: LuCircleCheck,
      path: "/activity",
      title: "No changes need attention",
    },
    watch_metric: {
      action: firstDashboard ? "Open a dashboard" : "Create a dashboard",
      description: "Choose an eligible chart metric to start detecting material changes.",
      icon: LuActivity,
      path: firstDashboard ? `/dashboard/${firstDashboard.id}` : "/dashboards?create=dashboard",
      title: "Watch a metric",
    },
    waiting_for_metrics: {
      action: "View dashboards",
      description: "A workspace editor can choose a metric for Chartbrew to monitor.",
      icon: LuActivity,
      path: "/dashboards",
      title: "No watched metrics yet",
    },
    waiting_for_data: {
      action: "View watched metrics",
      description: "The latest refresh did not return enough data to evaluate your watched metrics.",
      icon: LuRefreshCw,
      path: "/activity?tab=monitors",
      title: "Waiting for data",
    },
  }[home.setupState] || null;
}

function PanelItem({ action, description, eyebrow, icon, onPress, title }) {
  const Icon = icon;
  return (
    <div className="flex flex-row items-start gap-3 px-4 py-4">
      <Icon className="mt-0.5 shrink-0 text-foreground-400" size={16} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">
          {eyebrow}
        </p>
        <p className="mt-1 font-medium">{title}</p>
        <p className="mt-1 text-sm text-foreground-500">{description}</p>
        <Button className="mt-2" onPress={onPress} size="sm" variant="ghost">
          {action}
          <LuArrowRight size={16} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

PanelItem.propTypes = {
  action: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  eyebrow: PropTypes.string.isRequired,
  icon: PropTypes.func.isRequired,
  onPress: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
};

function WorkspaceAttentionPanel({ home, onCollapse }) {
  const navigate = useNavigate();
  const observation = home.observations?.[0];
  const healthIssue = home.dataHealth?.items?.[0];
  const setup = getSetupAction(home);

  if (!observation && !healthIssue && !setup) {
    return null;
  }

  return (
    <Card className="gap-0 border border-divider p-0 shadow-none">
      <Card.Header className="flex flex-row items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <Card.Title className="font-tw text-base font-semibold">
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
      <Card.Content className="mt-3 divide-y divide-divider border-t border-divider">
        {observation ? (
          <PanelItem
            action="View change"
            description={observation.project?.name || "Workspace"}
            eyebrow={`Change · ${formatTimeAgo(observation.lastDetectedAt)}`}
            icon={LuActivity}
            onPress={() => navigate(`/activity/${observation.id}`)}
            title={observation.title}
          />
        ) : null}

        {setup ? (
          <PanelItem
            action={setup.action}
            description={setup.description}
            eyebrow="Suggested next step"
            icon={setup.icon}
            onPress={() => navigate(setup.path)}
            title={setup.title}
          />
        ) : null}

        {healthIssue ? (
          <PanelItem
            action="Review data health"
            description={`Detected ${formatTimeAgo(healthIssue.detectedAt)}`}
            eyebrow="Data health"
            icon={LuRefreshCw}
            onPress={() => navigate("/activity?tab=health")}
            title={healthIssue.message}
          />
        ) : null}
      </Card.Content>
    </Card>
  );
}

WorkspaceAttentionPanel.propTypes = {
  home: PropTypes.object.isRequired,
  onCollapse: PropTypes.func.isRequired,
};

export default WorkspaceAttentionPanel;
