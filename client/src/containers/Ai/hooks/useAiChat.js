import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { getAiTools, promoteAiSession, respondAi } from "../../../api/ai";
import socketClient from "../../../modules/socketClient";
import { selectUser } from "../../../slices/user";
import { isProgressForConversation, normalizeProgressEvent } from "../aiMessageUtils";

function useAiChat({
  context = [],
  persistence = "ephemeral",
  teamId,
}) {
  const user = useSelector(selectUser);
  const sessionIdRef = useRef(null);
  const [aiConversationId, setAiConversationId] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [progressEvents, setProgressEvents] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [toolDisplayNames, setToolDisplayNames] = useState({});

  const ensureSessionId = useCallback(() => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const nextId = crypto.randomUUID();
    sessionIdRef.current = nextId;
    setSessionId(nextId);
    return nextId;
  }, []);

  const handleProgress = useCallback((data) => {
    if (!isProgressForConversation(data, sessionIdRef.current)) return;
    setProgressEvents((current) => [...current, normalizeProgressEvent(data)]);
  }, []);

  const joinProgressRoom = useCallback(async (roomId) => {
    if (!roomId || !user?.id || !teamId) return;
    try {
      await socketClient.connect(user.id, teamId);
      socketClient.off("ai-progress", handleProgress);
      socketClient.on("ai-progress", handleProgress);
      socketClient.joinConversation(roomId);
    } catch (_error) {
      // Live steps are optional; the spinner still shows if the socket is down.
    }
  }, [handleProgress, teamId, user?.id]);

  useEffect(() => {
    if (!user?.id || !teamId) return undefined;
    let mounted = true;

    (async () => {
      try {
        await socketClient.connect(user.id, teamId);
        if (!mounted) return;
        socketClient.off("ai-progress", handleProgress);
        socketClient.on("ai-progress", handleProgress);
        if (sessionIdRef.current) {
          socketClient.joinConversation(sessionIdRef.current);
        }
      } catch (_error) {
        // Keep answering without live step updates.
      }
    })();

    getAiTools(teamId)
      .then((data) => {
        if (!mounted) return;
        const displayNames = {};
        (data.tools || []).forEach((tool) => {
          if (!tool?.name) return;
          const displayName = tool.displayName || tool.display_name;
          if (displayName) displayNames[tool.name] = displayName;
        });
        setToolDisplayNames(displayNames);
      })
      .catch(() => {});

    return () => {
      mounted = false;
      socketClient.off("ai-progress", handleProgress);
      if (sessionIdRef.current) {
        socketClient.leaveConversation(sessionIdRef.current);
      }
    };
  }, [handleProgress, teamId, user?.id]);

  const sendMessage = useCallback(async (message) => {
    const question = `${message || ""}`.trim();
    if (!question || isLoading || !teamId) return null;
    const activeSessionId = ensureSessionId();
    setError(null);
    setIsLoading(true);
    setProgressEvents([]);
    setMessages((current) => [...current, { content: question, role: "user" }]);
    await joinProgressRoom(activeSessionId);
    try {
      const response = await respondAi({
        aiConversationId,
        context,
        message: question,
        persistence,
        sessionId: activeSessionId,
        teamId,
      });
      const orchestration = response.orchestration;
      setAiConversationId(orchestration.aiConversationId || aiConversationId);
      if (orchestration.sessionId) {
        sessionIdRef.current = orchestration.sessionId;
        setSessionId(orchestration.sessionId);
      }
      setMessages((current) => [
        ...current,
        {
          chartPreviews: orchestration.chartPreviews || [],
          content: orchestration.message,
          pendingAction: orchestration.pendingAction,
          role: "assistant",
        },
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
      setProgressEvents([]);
    }
  }, [
    aiConversationId,
    context,
    ensureSessionId,
    isLoading,
    joinProgressRoom,
    persistence,
    teamId,
  ]);

  const clear = useCallback(() => {
    if (sessionIdRef.current) {
      socketClient.leaveConversation(sessionIdRef.current);
    }
    sessionIdRef.current = null;
    setAiConversationId(null);
    setError(null);
    setMessages([]);
    setProgressEvents([]);
    setSessionId(null);
  }, []);

  const confirmAction = useCallback(async (pendingAction) => {
    if (!pendingAction?.actionId || isLoading || !teamId) return null;
    const activeSessionId = ensureSessionId();
    setError(null);
    setIsLoading(true);
    setProgressEvents([]);
    setMessages((current) => [...current, { content: "Confirm this change", role: "user" }]);
    await joinProgressRoom(activeSessionId);
    try {
      const response = await respondAi({
        action: {
          actionId: pendingAction.actionId,
          type: "confirm_pending_action",
        },
        aiConversationId,
        persistence,
        sessionId: activeSessionId,
        teamId,
      });
      const orchestration = response.orchestration;
      setMessages((current) => [
        ...current,
        {
          actionResult: orchestration.actionResult,
          content: orchestration.message,
          role: "assistant",
        },
      ]);
      return orchestration;
    } catch (requestError) {
      setError(requestError.message);
      setMessages((current) => [
        ...current,
        { content: requestError.message, isError: true, role: "assistant" },
      ]);
      return null;
    } finally {
      setIsLoading(false);
      setProgressEvents([]);
    }
  }, [aiConversationId, ensureSessionId, isLoading, joinProgressRoom, persistence, teamId]);

  const changeAction = useCallback((pendingAction) => {
    setMessages((current) => current.map((message) => {
      if (message.pendingAction?.actionId !== pendingAction?.actionId) return message;
      return { ...message, pendingAction: null };
    }));
    return sendMessage("I want to change the proposed settings.");
  }, [sendMessage]);

  const save = useCallback(async () => {
    if (!sessionId || !teamId) return null;
    try {
      const result = await promoteAiSession(teamId, sessionId);
      setAiConversationId(result.aiConversationId);
      setSessionId(null);
      sessionIdRef.current = null;
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
    changeAction,
    clear,
    confirmAction,
    error,
    isLoading,
    messages,
    progressEvents,
    save,
    sendMessage,
    sessionId,
    toolDisplayNames,
  };
}

export default useAiChat;
