import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, Card, Separator } from "@heroui/react";
import {
  LuChevronUp,
  LuMessageSquare,
} from "react-icons/lu";
import { useDispatch } from "react-redux";

import { getAiConversations } from "../../api/ai";
import { showAiModal } from "../../slices/ui";
import AiChat from "./AiChat";
import useAiChat from "./hooks/useAiChat";

function HomeAsk({ teamId }) {
  const dispatch = useDispatch();
  const [saved, setSaved] = useState(false);
  const [conversations, setConversations] = useState([]);
  const chat = useAiChat({ teamId });
  const conversationStarted = chat.messages.length > 0;

  const loadRecentConversations = useCallback(() => {
    if (!teamId) return;
    getAiConversations(teamId, { limit: 3 })
      .then((data) => setConversations(data.conversations || []))
      .catch(() => setConversations([]));
  }, [teamId]);

  useEffect(() => {
    loadRecentConversations();
  }, [loadRecentConversations]);

  const onSave = async () => {
    const result = await chat.save();
    setSaved(Boolean(result));
    if (result) loadRecentConversations();
  };

  const openConversation = (conversationId) => {
    dispatch(showAiModal({ conversationId }));
  };

  return (
    <Card className="gap-0 border border-divider shadow-none">
      <Card.Content className="flex flex-col gap-5 p-5">
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
          {conversationStarted ? (
            <div className="flex flex-row justify-end">
              <Button onPress={chat.clear} size="sm" variant="ghost">
                <LuChevronUp aria-hidden />
                Close answer
              </Button>
            </div>
          ) : null}
        </div>

        {!conversationStarted ? (
          <>
            <Separator />
            <div className="flex flex-col gap-3">
              {conversations.length > 0 ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Pick up where you left off
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {conversations.map((conversation) => (
                      <li key={conversation.id}>
                        <button
                          className="flex w-full flex-row items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-content2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          onClick={() => openConversation(conversation.id)}
                          type="button"
                        >
                          <LuMessageSquare
                            className="shrink-0 text-foreground-400"
                            size={16}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {conversation.title || "Untitled conversation"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                  <div className="flex size-10 items-center justify-center rounded-lg border border-divider bg-content2/40">
                    <LuMessageSquare className="text-foreground-400" size={18} aria-hidden />
                  </div>
                  <p className="font-medium">No recent questions yet</p>
                  <p className="text-sm text-muted">
                    Try asking something above to get started.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}

HomeAsk.propTypes = {
  teamId: PropTypes.number.isRequired,
};

export default HomeAsk;
