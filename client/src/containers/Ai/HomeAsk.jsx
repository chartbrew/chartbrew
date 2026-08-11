import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button, Card } from "@heroui/react";
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
    <Card className="gap-0 rounded-3xl border border-divider shadow-none">
      <Card.Content className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <AiChat
            id="home-ask"
            isLoading={chat.isLoading}
            messages={chat.messages}
            onChangeAction={chat.changeAction}
            onConfirmAction={chat.confirmAction}
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
            <div className="flex flex-col gap-1">
              {conversations.length > 0 ? (
                <>
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Continue where you left off
                  </p>
                  <ul className="flex flex-col">
                    {conversations.map((conversation) => (
                      <li key={conversation.id}>
                        <button
                          className="flex w-full flex-row items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-content2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          onClick={() => openConversation(conversation.id)}
                          type="button"
                        >
                          <LuMessageSquare
                            className="shrink-0 text-foreground-400"
                            size={14}
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
                <p className="px-1 py-1 text-sm text-muted">
                  No recent questions yet
                </p>
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
