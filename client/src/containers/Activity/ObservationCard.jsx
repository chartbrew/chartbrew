import React from "react";
import PropTypes from "prop-types";
import { Button, Card } from "@heroui/react";
import { LuArrowRight, LuTrendingDown, LuTrendingUp } from "react-icons/lu";
import { useNavigate } from "react-router";

import { formatRelativeChange, formatTimeAgo } from "../../modules/observationFormat";

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
  return (
    <Card className="h-full gap-0 border border-divider shadow-none">
      <Card.Header className="flex flex-row items-center gap-2 pb-2">
        {isIncrease ? (
          <LuTrendingUp className="shrink-0 text-success" size={16} aria-hidden />
        ) : (
          <LuTrendingDown className="shrink-0 text-danger" size={16} aria-hidden />
        )}
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">
          {[observation.project?.name || "Workspace", formatTimeAgo(observation.lastDetectedAt)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </Card.Header>
      <Card.Content className="flex-1 gap-1">
        <Card.Title className="font-tw text-base font-semibold">{observation.title}</Card.Title>
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
