import React from "react";
import PropTypes from "prop-types";
import { Avatar } from "@heroui/react";
import { LuBrainCircuit, LuLoader } from "react-icons/lu";

import { getProgressEventMessage } from "./aiMessageUtils";

function getProgressDotClass(type) {
  switch (type) {
    case "processing":
      return "bg-blue-500";
    case "connection":
      return "bg-green-500";
    case "analysis":
      return "bg-yellow-500";
    case "query_generation":
      return "bg-purple-500";
    case "execution":
    case "tool_started":
      return "bg-orange-500";
    case "visualization":
      return "bg-pink-500";
    default:
      return "bg-gray-500";
  }
}

function AiProgress({ progressEvents, toolDisplayNames }) {
  if (progressEvents.length === 0) return null;

  return (
    <div className="flex justify-center mb-4 px-4">
      <div className="w-full max-w-[90%]">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Avatar
              size="sm"
              color="accent"
              variant="soft"
            >
              <Avatar.Fallback>
                <LuBrainCircuit size={16} className="text-foreground" />
              </Avatar.Fallback>
            </Avatar>
            <LuLoader size={16} className="animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
          <div className="space-y-1">
            {progressEvents.map((event) => (
              <div key={event.id} className="text-xs text-accent-700 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getProgressDotClass(event.type)}`} />
                {getProgressEventMessage(event, toolDisplayNames)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

AiProgress.propTypes = {
  progressEvents: PropTypes.arrayOf(PropTypes.object).isRequired,
  toolDisplayNames: PropTypes.object.isRequired,
};

export default AiProgress;
