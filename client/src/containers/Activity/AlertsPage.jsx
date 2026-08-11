import React, { useEffect, useState } from "react";
import { Button, Chip, Spinner } from "@heroui/react";
import { LuBell } from "react-icons/lu";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import { getAlerts } from "../../api/observations";
import { selectTeam } from "../../slices/team";
import {
  ActivityEmptyState,
  ActivityList,
  ActivityListRow,
} from "./ActivityList";
import { formatTimeAgo } from "../../modules/observationFormat";

const ALERT_TYPE_LABELS = {
  anomaly: "Anomaly detection",
  milestone: "Milestone",
  threshold_above: "Above threshold",
  threshold_below: "Below threshold",
  threshold_between: "Between thresholds",
  threshold_outside: "Outside thresholds",
};

function getAlertSummary(alert) {
  const rules = alert.rules || {};
  const typeLabel = ALERT_TYPE_LABELS[alert.type] || "Chart alert";
  const hasValue = (value) => value !== null && value !== undefined && value !== "";

  if (["milestone", "threshold_above", "threshold_below"].includes(alert.type)
    && hasValue(rules.value)) {
    return `${typeLabel}: ${rules.value}`;
  }
  if (["threshold_between", "threshold_outside"].includes(alert.type)
    && hasValue(rules.lower) && hasValue(rules.upper)) {
    return `${typeLabel}: ${rules.lower}–${rules.upper}`;
  }
  return typeLabel;
}

function getAlertTriggeredValueLabel(alert) {
  const values = alert.lastTriggeredValues || [];
  if (values.length < 1) return null;
  return values
    .map((item) => (item.label ? `${item.label} ${item.value}` : `${item.value}`))
    .join(", ");
}

function AlertsPage() {
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!team?.id) return;
    setLoading(true);
    getAlerts(team.id)
      .then(setAlerts)
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [team?.id]);

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading alerts" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <ActivityEmptyState
        description="Configure a threshold or anomaly alert from an editable chart."
        title="No alerts yet"
      />
    );
  }

  return (
    <ActivityList>
      {alerts.map((alert) => (
        <ActivityListRow
          actions={(
            <Button
              onPress={() => navigate(
                `/dashboard/${alert.project.id}/chart/${alert.chart.id}/edit`
              )}
              size="sm"
              variant="secondary"
            >
              Open chart
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
              <span className="text-muted">{getAlertSummary(alert)}</span>
              <span className="mt-2 block text-xs text-muted">
                {[
                  alert.project.name,
                  alert.oneTime ? "One-time" : null,
                  alert.lastTriggeredAt
                    ? `Last triggered ${formatTimeAgo(alert.lastTriggeredAt)}`
                    : "Not triggered yet",
                  getAlertTriggeredValueLabel(alert),
                ].filter(Boolean).join(" · ")}
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
    </ActivityList>
  );
}

export default AlertsPage;
