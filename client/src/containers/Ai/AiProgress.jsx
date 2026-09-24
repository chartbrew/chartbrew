import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { LuCheck } from "react-icons/lu";

import PixelLoader from "../../components/PixelLoader";
import { getProgressEventMessage } from "./aiMessageUtils";
import { AiLoadingActivity } from "./AiTranscript";

const PROGRESS_LOADERS = {
  connection: "twin",
  analysis: "heat",
  query_generation: "diagonal",
  execution: "columns",
  visualization: "bars",
  tool_started: "columns",
};

function AiProgress({
  className,
  isLoading = false,
  progressEvents,
  toolDisplayNames,
}) {
  const activities = useMemo(() => {
    const entries = progressEvents.map((event) => ({
      label: getProgressEventMessage(event, toolDisplayNames),
      loader: PROGRESS_LOADERS[event.type] || "orbit",
    })).filter(({ label }) => label);
    return entries.filter(({ label }, index) => entries.findIndex((entry) => entry.label === label) === index);
  }, [progressEvents, toolDisplayNames]);

  if (activities.length === 0) {
    if (!isLoading) return null;
    return (
      <div
        aria-atomic="true"
        aria-live="polite"
        className={className ? `min-w-0 ${className}` : "min-w-0"}
        role="status"
      >
        <AiLoadingActivity />
      </div>
    );
  }

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={className ? `min-w-0 ${className}` : "min-w-0"}
      role="status"
    >
      <ol className="flex min-w-0 flex-col">
        {activities.map(({ label, loader }, index) => {
          const isCurrent = isLoading && index === activities.length - 1;
          const isLast = index === activities.length - 1;
          return (
            <li className="flex min-w-0 items-start gap-2.5" key={label}>
              <span className="flex w-4 shrink-0 flex-col items-center self-stretch">
                <span className="mt-0.5 flex size-4 items-center justify-center rounded-full bg-surface text-foreground">
                  {isCurrent
                    ? <PixelLoader variant={loader} />
                    : <LuCheck size={10} aria-hidden />}
                </span>
                {isLast ? null : <span aria-hidden className="mt-1 w-px flex-1 bg-divider" />}
              </span>
              <span className="min-w-0 break-words pb-2 text-sm text-muted">{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

AiProgress.propTypes = {
  className: PropTypes.string,
  isLoading: PropTypes.bool,
  progressEvents: PropTypes.arrayOf(PropTypes.object).isRequired,
  toolDisplayNames: PropTypes.object.isRequired,
};

export default AiProgress;
