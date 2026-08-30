import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@heroui/react";
import { LuChevronUp } from "react-icons/lu";
import { useSelector } from "react-redux";

import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import AiChat from "./AiChat";
import useAiChat from "./hooks/useAiChat";

function HomeAsk({ teamId }) {
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [saved, setSaved] = useState(false);
  const chat = useAiChat({ teamId });
  const conversationStarted = chat.messages.length > 0;
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const questionPlaceholder = teamRole === "projectViewer"
    ? "Ask about existing reports and metrics"
    : "Ask anything about your data";

  const onSave = async () => {
    const result = await chat.save();
    setSaved(Boolean(result));
  };

  return (
    <div className={conversationStarted
      ? "flex min-w-0 flex-col gap-3"
      : "flex min-w-0 flex-col lg:h-[18rem]"}
    >
      <AiChat
        fill={!conversationStarted}
        framed
        id="home-ask"
        isLoading={chat.isLoading}
        messages={chat.messages}
        onChangeAction={chat.changeAction}
        onConfirmAction={chat.confirmAction}
        onSave={onSave}
        onSubmit={chat.sendMessage}
        placeholder={questionPlaceholder}
        progressEvents={chat.progressEvents}
        showSave={Boolean(chat.sessionId)}
        suggestions={conversationStarted ? [] : [
          "Summarize recent changes",
          "Which metrics need attention?",
          "Check data freshness",
        ]}
        toolDisplayNames={chat.toolDisplayNames}
      />
      {saved ? (
        <p className="text-sm text-success">Conversation saved.</p>
      ) : null}
      {conversationStarted ? (
        <div className="flex flex-row justify-end">
          <Button onPress={chat.clear} size="sm" variant="ghost">
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
