import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";

import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import AiAccessNotice from "./AiAccessNotice";
import AiAvailabilityStatus from "./AiAvailabilityStatus";
import AiChat from "./AiChat";
import { canSubmitAiMessage } from "./aiAvailability";
import useAiChat from "./hooks/useAiChat";
import useAiAvailability from "./hooks/useAiAvailability";

function ObservationInvestigation({ observationId, teamId }) {
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [showAccessNotice, setShowAccessNotice] = useState(false);
  const context = useMemo(() => [{
    entityId: observationId,
    entityType: "observation",
  }], [observationId]);
  const chat = useAiChat({ context, teamId });
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const {
    availability,
    error: availabilityError,
    isLoading: isAvailabilityLoading,
    reload: reloadAvailability,
  } = useAiAvailability({ teamId });

  const onSubmit = (message) => {
    if (!canSubmitAiMessage(availability)) {
      setShowAccessNotice(true);
      return false;
    }
    setShowAccessNotice(false);
    chat.sendMessage(message);
    return true;
  };

  const onChangeAction = (action) => {
    if (!canSubmitAiMessage(availability)) {
      setShowAccessNotice(true);
      return null;
    }
    setShowAccessNotice(false);
    return chat.changeAction(action);
  };

  const onConfirmAction = (action) => {
    if (!canSubmitAiMessage(availability)) {
      setShowAccessNotice(true);
      return null;
    }
    setShowAccessNotice(false);
    return chat.confirmAction(action);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <AiChat
        id={`observation-${observationId}-ask`}
        isLoading={chat.isLoading}
        messages={chat.messages}
        onChangeAction={onChangeAction}
        onConfirmAction={onConfirmAction}
        onSave={chat.save}
        onSubmit={onSubmit}
        placeholder="Ask a follow-up about this change"
        progressEvents={chat.progressEvents}
        showSave={Boolean(chat.sessionId)}
        status={(
          <AiAvailabilityStatus
            availability={availability}
            canManagePlatform={user.admin === true}
            canManageTeam={["teamAdmin", "teamOwner"].includes(teamRole)}
          />
        )}
        suggestions={[
          "What should I investigate first?",
          "Which accessible dataset can explain this?",
        ]}
        toolDisplayNames={chat.toolDisplayNames}
      />
      <AiAccessNotice
        availability={availability}
        canManagePlatform={user.admin === true}
        canManageTeam={["teamAdmin", "teamOwner"].includes(teamRole)}
        error={availabilityError}
        isLoading={isAvailabilityLoading}
        isRequested={showAccessNotice}
        onRetry={reloadAvailability}
      />
    </div>
  );
}

ObservationInvestigation.propTypes = {
  observationId: PropTypes.string.isRequired,
  teamId: PropTypes.number.isRequired,
};

export default ObservationInvestigation;
