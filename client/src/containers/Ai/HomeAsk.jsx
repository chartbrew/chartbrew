import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@heroui/react";
import { LuChevronUp } from "react-icons/lu";
import { useSelector } from "react-redux";

import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import AiAccessNotice from "./AiAccessNotice";
import AiAvailabilityStatus from "./AiAvailabilityStatus";
import AiChat from "./AiChat";
import { canSubmitAiMessage } from "./aiAvailability";
import useAiChat from "./hooks/useAiChat";
import useAiAvailability from "./hooks/useAiAvailability";

function HomeAsk({ teamId }) {
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [saved, setSaved] = useState(false);
  const [showAccessNotice, setShowAccessNotice] = useState(false);
  const chat = useAiChat({ teamId });
  const conversationStarted = chat.messages.length > 0;
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const isTeamAdmin = ["teamAdmin", "teamOwner"].includes(teamRole);
  const {
    availability,
    error: availabilityError,
    isLoading: isAvailabilityLoading,
    reload: reloadAvailability,
  } = useAiAvailability({ teamId });
  const isAccessNoticeVisible = showAccessNotice && availability?.enabled !== true;
  const questionPlaceholder = teamRole === "projectViewer"
    ? "Ask about existing reports and metrics"
    : "Ask anything about your data";

  const onSave = async () => {
    const result = await chat.save();
    setSaved(Boolean(result));
  };

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
    <div className={conversationStarted
      ? "flex min-w-0 flex-col gap-3"
      : `flex min-w-0 flex-col gap-3${isAccessNoticeVisible ? "" : " lg:h-[18rem]"}`}
    >
      <AiChat
        fill={!conversationStarted}
        framed
        id="home-ask"
        isLoading={chat.isLoading}
        messages={chat.messages}
        onChangeAction={onChangeAction}
        onConfirmAction={onConfirmAction}
        onSave={onSave}
        onSubmit={onSubmit}
        placeholder={questionPlaceholder}
        progressEvents={chat.progressEvents}
        showSave={Boolean(chat.sessionId)}
        status={(
          <AiAvailabilityStatus
            availability={availability}
            canManagePlatform={user.admin === true}
            canManageTeam={isTeamAdmin}
          />
        )}
        suggestions={conversationStarted ? [] : [
          "Summarize recent changes",
          "Which metrics need attention?",
          "Check data freshness",
        ]}
        toolDisplayNames={chat.toolDisplayNames}
      />
      <AiAccessNotice
        availability={availability}
        canManagePlatform={user.admin === true}
        canManageTeam={isTeamAdmin}
        error={availabilityError}
        isLoading={isAvailabilityLoading}
        isRequested={showAccessNotice}
        onRetry={reloadAvailability}
      />
      {saved ? (
        <p className="text-sm text-success">Conversation saved.</p>
      ) : null}
      {conversationStarted ? (
        <div className="flex flex-row justify-end">
          <Button onPress={chat.clear} size="sm" variant="tertiary">
            <LuChevronUp aria-hidden />
            Close answer
          </Button>
        </div>
      ) : null}
    </div>
  );
}

HomeAsk.propTypes = {
  teamId: PropTypes.number.isRequired,
};

export default HomeAsk;
