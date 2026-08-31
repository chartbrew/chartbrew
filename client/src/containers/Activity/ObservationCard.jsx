import React from "react";
import PropTypes from "prop-types";
import { Button, Card, Chip } from "@heroui/react";
import {
  LuArrowRight, LuCircleCheck, LuTrendingDown, LuTrendingUp,
} from "react-icons/lu";
import { useNavigate } from "react-router";

import {
  formatCompactComparison,
  formatObservationChangeMagnitude,
} from "../../modules/observationFormat";

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
  const metricName = observation.chart?.name || observation.monitor?.name || "Watched metric";
  const changeMagnitude = formatObservationChangeMagnitude(observation);
  const changeSign = isIncrease ? "+" : "−";
  const comparison = formatCompactComparison(observation);
  const isSnoozed = observation.preference?.snoozedUntil
    && new Date(observation.preference.snoozedUntil) > new Date();
  return (
    <Card className={`h-full gap-0 rounded-3xl border border-divider shadow-none ${
      isResolved ? "bg-surface-secondary/40" : ""
    }`}>
      <Card.Header className="flex flex-row flex-wrap items-center gap-2 pb-1">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted">
          {observation.project?.name || "Workspace"}
        </p>
        {isResolved ? (
          <Chip className="shrink-0" size="sm" variant="soft">
            <Chip.Label>Resolved</Chip.Label>
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
      <Card.Content className="flex-1 gap-2">
        <Card.Title className="text-base font-semibold">{metricName}</Card.Title>
        <div className={`flex items-center gap-2 ${impactClass}`}>
          {isResolved ? (
            <LuCircleCheck className="shrink-0" size={20} aria-hidden />
          ) : isIncrease ? (
            <LuTrendingUp className="shrink-0" size={20} aria-hidden />
          ) : (
            <LuTrendingDown className="shrink-0" size={20} aria-hidden />
          )}
          <p
            aria-label={`${isIncrease ? "Increased" : "Decreased"} by ${
              changeMagnitude.replace(" pp", " percentage points")
            }`}
            className="text-2xl font-semibold tracking-tight"
          >
            {changeSign}{changeMagnitude}
          </p>
        </div>
        {comparison ? <p className="text-sm text-muted">{comparison}</p> : null}
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
