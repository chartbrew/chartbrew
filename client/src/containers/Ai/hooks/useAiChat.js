import { useCallback, useState } from "react";

import { promoteAiSession, respondAi } from "../../../api/ai";

function useAiChat({
  context = [],
  persistence = "ephemeral",
  teamId,
}) {
  const [aiConversationId, setAiConversationId] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);

  const sendMessage = useCallback(async (message) => {
    const question = `${message || ""}`.trim();
    if (!question || isLoading || !teamId) return null;
    setError(null);
    setIsLoading(true);
    setMessages((current) => [...current, { content: question, role: "user" }]);
    try {
      const response = await respondAi({
        aiConversationId,
        context,
        message: question,
        persistence,
        sessionId,
        teamId,
      });
      const orchestration = response.orchestration;
      setAiConversationId(orchestration.aiConversationId || aiConversationId);
      setSessionId(orchestration.sessionId || sessionId);
      setMessages((current) => [
        ...current,
        { content: orchestration.message, role: "assistant" },
      ]);
      return orchestration;
    } catch (requestError) {
      setError(requestError.message);
      setMessages((current) => [
        ...current,
        {
          content: requestError.message,
          isError: true,
          role: "assistant",
        },
      ]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [
    aiConversationId,
    context,
    isLoading,
    persistence,
    sessionId,
    teamId,
  ]);

  const clear = useCallback(() => {
    setAiConversationId(null);
    setError(null);
    setMessages([]);
    setSessionId(null);
  }, []);

  const save = useCallback(async () => {
    if (!sessionId || !teamId) return null;
    try {
      const result = await promoteAiSession(teamId, sessionId);
      setAiConversationId(result.aiConversationId);
      setSessionId(null);
      return result;
    } catch (saveError) {
      setError(saveError.message);
      setMessages((current) => [
        ...current,
        {
          content: saveError.message,
          isError: true,
          role: "assistant",
        },
      ]);
      return null;
    }
  }, [sessionId, teamId]);

  return {
    aiConversationId,
    clear,
    error,
    isLoading,
    messages,
    save,
    sendMessage,
    sessionId,
  };
}

export default useAiChat;
