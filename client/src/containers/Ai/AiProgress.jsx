import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { LuCheck, LuLoader } from "react-icons/lu";

import { getProgressEventMessage } from "./aiMessageUtils";
import { AiLoadingActivity } from "./AiTranscript";

function AiProgress({
  className,
  isLoading = false,
  progressEvents,
  toolDisplayNames,
}) {
  const activities = useMemo(() => {
    const labels = progressEvents
      .map((event) => getProgressEventMessage(event, toolDisplayNames))
      .filter(Boolean);
    return labels.filter((label, index) => labels.indexOf(label) === index);
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
        {activities.map((activity, index) => {
          const isCurrent = isLoading && index === activities.length - 1;
          const isLast = index === activities.length - 1;
          return (
            <li className="flex min-w-0 items-start gap-2.5" key={activity}>
              <span className="flex w-3 shrink-0 flex-col items-center self-stretch">
                <span className="mt-0.5 flex size-3 items-center justify-center rounded-full bg-surface text-foreground">
                  {isCurrent
                    ? <LuLoader className="animate-spin" size={11} aria-hidden />
                    : <LuCheck size={10} aria-hidden />}
                </span>
                {isLast ? null : <span aria-hidden className="mt-1 w-px flex-1 bg-divider" />}
              </span>
              <span className="min-w-0 break-words pb-2 text-sm text-muted">{activity}</span>
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
