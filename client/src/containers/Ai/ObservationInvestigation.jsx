import React, { useMemo } from "react";
import PropTypes from "prop-types";

import AiChat from "./AiChat";
import useAiChat from "./hooks/useAiChat";

function ObservationInvestigation({ observationId, teamId }) {
  const context = useMemo(() => [{
    entityId: observationId,
    entityType: "observation",
  }], [observationId]);
  const chat = useAiChat({ context, teamId });

  return (
    <AiChat
      id={`observation-${observationId}-ask`}
      isLoading={chat.isLoading}
      messages={chat.messages}
      onSave={chat.save}
      onSubmit={chat.sendMessage}
      placeholder="Ask a follow-up about this change"
      showSave={Boolean(chat.sessionId)}
      suggestions={[
        "What should I investigate first?",
        "Which accessible dataset can explain this?",
      ]}
    />
  );
}

ObservationInvestigation.propTypes = {
  observationId: PropTypes.string.isRequired,
  teamId: PropTypes.number.isRequired,
};

export default ObservationInvestigation;
