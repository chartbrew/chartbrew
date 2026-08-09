import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { LuCheck, LuLoader, LuSparkles } from "react-icons/lu";

import { getProgressEventMessage } from "./aiMessageUtils";

function AiProgress({ progressEvents, toolDisplayNames }) {
  const activities = useMemo(() => {
    const labels = progressEvents
      .map((event) => getProgressEventMessage(event, toolDisplayNames))
      .filter(Boolean);
    return labels.filter((label, index) => labels.indexOf(label) === index);
  }, [progressEvents, toolDisplayNames]);

  if (activities.length === 0) return null;

  return (
    <div className="mx-auto mb-5 w-full max-w-3xl px-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <LuSparkles className="text-accent" size={15} aria-hidden />
        Investigating
      </div>
      <ol className="mt-3 flex flex-col gap-2 border-l border-divider pl-4">
        {activities.map((activity, index) => {
          const isCurrent = index === activities.length - 1;
          return (
            <li className="relative flex items-center gap-2 text-sm text-muted" key={activity}>
              <span className="absolute -left-[21px] flex size-3 items-center justify-center rounded-full bg-content1 text-accent">
                {isCurrent
                  ? <LuLoader className="animate-spin" size={11} aria-hidden />
                  : <LuCheck size={10} aria-hidden />}
              </span>
              {activity}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

AiProgress.propTypes = {
  progressEvents: PropTypes.arrayOf(PropTypes.object).isRequired,
  toolDisplayNames: PropTypes.object.isRequired,
};

export default AiProgress;
