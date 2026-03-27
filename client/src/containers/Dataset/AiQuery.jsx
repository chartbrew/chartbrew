import React, { useState, useEffect } from "react"
import PropTypes from "prop-types";
import { Button, Alert, TextField, InputGroup } from "@heroui/react";
import toast from "react-hot-toast";
import { useParams } from "react-router";
import { LuBrainCircuit, LuSend } from "react-icons/lu";
import { useSelector } from "react-redux";

import { API_HOST } from "../../config/settings";
import { ButtonSpinner } from "../../components/ButtonSpinner";
import { getAuthToken } from "../../modules/auth";
import { selectTeam } from "../../slices/team";

function AiQuery({ onChangeQuery, dataRequest, query = "", connectionType = "" }) {
  const [askAiLoading, setAskAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [conversation, setConversation] = useState([]);
  const [typedText, setTypedText] = useState("");
  const responseText = "I tried to generate a query based on your question. If it's not what you want, you can ask for clarification or try a different question.";
  
  const team = useSelector(selectTeam);
  const params = useParams();

  useEffect(() => {
    if (!askAiLoading && conversation.length > 0) {
      setTypedText("");
      let i = 0;
      const interval = setInterval(() => {
        setTypedText((prev) => {
          if (i >= responseText.length) {
            clearInterval(interval);
            return prev;
          }
          i++;
          return responseText.slice(0, i);
        });
      }, 20);

      return () => clearInterval(interval);
    }
  }, [askAiLoading, conversation]);

  const _onAskAi = () => {
    if (!aiQuestion) return;

    setAskAiLoading(true);
    // Add user message to conversation
    setConversation([...conversation, { role: "user", content: aiQuestion }]);

    const url = `${API_HOST}/team/${team?.id}/datasets/${params.datasetId}/dataRequests/${dataRequest.id}/askAi`;
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
      <div className="h-4" />

      <div className="max-h-[300px] overflow-y-auto">
        {askAiLoading ? (
          <Alert status="accent" className="shadow-none border border-divider">
            <Alert.Indicator>
              <LuBrainCircuit />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>
                <span className="flex items-center gap-1">
                  Thinking
                  <span className="animate-pulse">.</span>
                  <span className="animate-pulse delay-100">.</span>
                  <span className="animate-pulse delay-200">.</span>
                </span>
              </Alert.Title>
            </Alert.Content>
          </Alert>
        ) : conversation.length === 0 ? (
          <Alert status="accent" className="shadow-none border border-divider">
            <Alert.Indicator>
              <LuBrainCircuit />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Description>
                {`Hi! I can help you write ${connectionType === "mongodb" ? "MongoDB" : "SQL"} queries. Ask me a question about your data and I'll generate a query for you.`}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <Alert status="accent" className="text-sm shadow-none border border-divider">
            <Alert.Indicator>
              <LuBrainCircuit />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Description>{typedText}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </div>

      <div className="h-4" />

      <div className="flex flex-row items-center gap-2">
        <TextField
          fullWidth
          name="dataset-ai-query"
          aria-label="Ask the AI to generate a query"
        >
          <InputGroup fullWidth variant="secondary">
            <InputGroup.TextArea
              rows={2}
              className="resize-none"
              placeholder={
                _getLastUserMessage()
                || "What data do you want to see? (e.g. 'Top 10 users by number of orders')"
              }
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  _onAskAi();
                }
              }}
            />
            <InputGroup.Suffix className="pr-2 pb-1">
              <Button
                isIconOnly
                variant="primary"
                onPress={_onAskAi}
                isPending={askAiLoading}
              >
                {askAiLoading ? <ButtonSpinner /> : <LuSend />}
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
        </TextField>
      </div>
    </div>
  )
}

AiQuery.propTypes = {
  onChangeQuery: PropTypes.func.isRequired,
  dataRequest: PropTypes.object.isRequired,
  query: PropTypes.string.isRequired,
  connectionType: PropTypes.string,
};

export default AiQuery
