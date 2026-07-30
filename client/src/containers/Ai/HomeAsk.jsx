import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@heroui/react";
import { LuChevronUp } from "react-icons/lu";

import AiChat from "./AiChat";
import useAiChat from "./hooks/useAiChat";

function HomeAsk({ teamId }) {
  const [saved, setSaved] = useState(false);
  const chat = useAiChat({ teamId });

  const onSave = async () => {
    const result = await chat.save();
    setSaved(Boolean(result));
  };

  return (
    <div className="flex flex-col gap-2">
      <AiChat
        id="home-ask"
        isLoading={chat.isLoading}
        messages={chat.messages}
        onSave={onSave}
        onSubmit={chat.sendMessage}
        placeholder="Ask anything about your data"
        showSave={Boolean(chat.sessionId)}
        suggestions={[
          "Summarize recent changes",
          "Which metrics need attention?",
          "Check data freshness",
        ]}
      />
      {saved ? (
        <p className="text-sm text-success">Conversation saved.</p>
      ) : null}
      {chat.messages.length > 0 ? (
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
