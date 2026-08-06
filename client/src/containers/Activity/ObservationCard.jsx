import React from "react";
import PropTypes from "prop-types";
import { Button, Card, Chip } from "@heroui/react";
import {
  LuArrowRight, LuCircleCheck, LuTrendingDown, LuTrendingUp,
} from "react-icons/lu";
import { useNavigate } from "react-router";

import { formatTimeAgo } from "../../modules/observationFormat";

function formatPeriod(period) {
  if (!period?.start || !period?.end) return null;
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  });
  return `${formatter.format(new Date(period.start))} – ${formatter.format(new Date(period.end))}`;
}

function ObservationCard({ observation }) {
  const navigate = useNavigate();
  const isIncrease = observation.direction === "increase";
  const isResolved = observation.status === "resolved";
  const impactClass = isResolved
    ? "text-foreground-400"
    : observation.impact === "negative"
    ? "text-danger"
    : observation.impact === "positive"
      ? "text-success"
      : "text-foreground-500";
  const activityTime = isResolved
    ? observation.resolvedAt
      ? `Resolved ${formatTimeAgo(observation.resolvedAt)}`
      : "Resolved"
    : formatTimeAgo(observation.lastDetectedAt);
  const isSnoozed = observation.preference?.snoozedUntil
    && new Date(observation.preference.snoozedUntil) > new Date();
  return (
    <Card className={`h-full gap-0 rounded-3xl border border-divider shadow-none ${
      isResolved ? "bg-content2/40" : ""
    }`}>
      <Card.Header className="flex flex-row flex-wrap items-center gap-2 pb-2">
        {isResolved ? (
          <LuCircleCheck className="shrink-0 text-foreground-400" size={16} aria-hidden />
        ) : isIncrease ? (
          <LuTrendingUp className={`shrink-0 ${impactClass}`} size={16} aria-hidden />
        ) : (
          <LuTrendingDown className={`shrink-0 ${impactClass}`} size={16} aria-hidden />
        )}
        <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted">
          {[
            observation.project?.name || "Workspace",
            isResolved ? null : activityTime,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {isResolved ? (
          <Chip className="shrink-0" size="sm" variant="soft">
            <Chip.Label>{activityTime}</Chip.Label>
          </Chip>
        ) : null}
        {observation.preference?.dismissedAt ? (
          <Chip className="shrink-0" size="sm" variant="soft">
            <Chip.Label>Hidden from Home</Chip.Label>
          </Chip>
        ) : null}
        {isSnoozed ? (
          <Chip className="shrink-0" size="sm" variant="soft">
            <Chip.Label>Snoozed on Home</Chip.Label>
          </Chip>
        ) : null}
      </Card.Header>
      <Card.Content className="flex-1 gap-1">
        <Card.Title className="text-base font-semibold">{observation.title}</Card.Title>
        <p className="text-sm text-muted">{observation.summary}</p>
        <p className="mt-1 text-xs text-muted">
          {[observation.chart?.name, formatPeriod(observation.currentPeriod)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </Card.Content>
      <Card.Footer className="justify-between gap-3 pt-3">
        <Button
          onPress={() => navigate(`/activity/${observation.id}`)}
          size="sm"
          variant="tertiary"
        >
          View change
          <LuArrowRight aria-hidden />
        </Button>
      </Card.Footer>
    </Card>
  );
}

ObservationCard.propTypes = {
  observation: PropTypes.object.isRequired,
};

export default ObservationCard;
