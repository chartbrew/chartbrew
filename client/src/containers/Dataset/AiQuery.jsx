import React, { useState } from "react"
import PropTypes from "prop-types";
import { Spacer, Textarea, Button, Alert } from "@heroui/react";
import toast from "react-hot-toast";
import { useParams } from "react-router";
import { LuBrainCircuit, LuSend } from "react-icons/lu";

import { API_HOST } from "../../config/settings";
import { getAuthToken } from "../../modules/auth";

function AiQuery({ onChangeQuery, dataRequest, query = "" }) {
  const [askAiLoading, setAskAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [conversation, setConversation] = useState([]);

  const params = useParams();

  const _onAskAi = () => {
    if (!aiQuestion) return;

    setAskAiLoading(true);
    // Add user message to conversation
    setConversation([...conversation, { role: "user", content: aiQuestion }]);

    const url = `${API_HOST}/team/${params.teamId}/datasets/${params.datasetId}/dataRequests/${dataRequest.id}/askAi`;
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getAuthToken()}`,
    });
    fetch(url, {
      method: "POST",
      body: JSON.stringify({
        question: aiQuestion,
        conversationHistory: conversation,
        currentQuery: query,
      }),
      headers,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to ask the AI. Please try again.");
        }
        return response.json();
      })
      .then((data) => {
        setAskAiLoading(false);
        onChangeQuery(data.query);
        // Add AI response to conversation
        setConversation(data.conversationHistory);
        setAiQuestion("");
      })
      .catch(() => {
        setAskAiLoading(false); 
        toast.error("There was an error asking the AI. Please try again.");
      });
  };

  const _getLastUserMessage = () => {
    const userMessages = conversation.filter((message) => message.role === "user");
    if (userMessages.length === 0) return "";

    return userMessages[userMessages.length - 1]?.content;
  }

  return (
    <div>
      <Spacer y={4} />

      <div className="max-h-[300px] overflow-y-auto">
        {askAiLoading ? (
          <Alert 
            icon={<LuBrainCircuit />}
            color="primary"
            title={
              <div className="flex items-center gap-1">
              Thinking
              <span className="animate-pulse">.</span>
              <span className="animate-pulse delay-100">.</span>
                <span className="animate-pulse delay-200">.</span>
              </div>
            }
          />
        ) : conversation.length === 0 ? (
          <Alert
            icon={<LuBrainCircuit />}
            variant="flat"
            color="primary"
              description="Hi! I can help you write SQL queries. Ask me a question about your data and I'll generate a query for you."
          />
        ) : (
          <Alert
            icon={<LuBrainCircuit />}
            color="primary"
            size="sm"
            description="I tried to generate a query based on your question. If it's not what you want, you can ask for clarification or try a different question."
          />
        )}
      </div>

      <Spacer y={4} />

      <div className="flex flex-row items-center gap-2">
        <Textarea
          placeholder={
            _getLastUserMessage() || "What data do you want to see? (e.g. 'Top 10 users by number of orders')"
          }
          value={aiQuestion}
          onChange={(e) => setAiQuestion(e.target.value)}
          variant="bordered"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              _onAskAi();
            }
          }}
          minRows={1}
          endContent={
            <Button
              isIconOnly
              color="primary"
              onPress={_onAskAi}
              isLoading={askAiLoading}
            >
              <LuSend />
            </Button>
          }
        />
      </div>
    </div>
  )
}

AiQuery.propTypes = {
  onChangeQuery: PropTypes.func.isRequired,
  dataRequest: PropTypes.object.isRequired,
  query: PropTypes.string.isRequired,
};

export default AiQuery
