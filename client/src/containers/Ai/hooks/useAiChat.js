import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  getAiTools, placeAiChartPreview, promoteAiSession, respondAi,
} from "../../../api/ai";
import socketClient from "../../../modules/socketClient";
import { selectUser } from "../../../slices/user";
import {
  clearInlineAiConversationKey, dismissAiConversation, setActiveAiConversation, setInlineAiConversationKey,
  updateActiveAiConversation,
} from "../../../slices/ui";
import { isProgressForConversation, normalizeProgressEvent } from "../aiMessageUtils";

function useAiChat({
  context = [],
  persistence = "persistent",
  teamId,
}) {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const requestIdRef = useRef(0);
  const sessionIdRef = useRef(null);
  const chatKeyRef = useRef(crypto.randomUUID());
  const savePromiseRef = useRef(null);
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
    const handleCreated = (data) => {
      if (!data?.sessionId || data.sessionId !== sessionIdRef.current || String(data.teamId) !== String(teamId)) return;
      socketClient.leaveConversation(sessionIdRef.current);
      sessionIdRef.current = data.conversationId;
      setAiConversationId(data.conversationId);
      socketClient.joinConversation(data.conversationId);
      dispatch(updateActiveAiConversation({ key: chatKeyRef.current, id: data.conversationId }));
    };
    socketClient.on("conversation-created", handleCreated);

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
      requestIdRef.current += 1;
      socketClient.off("ai-progress", handleProgress);
      socketClient.off("conversation-created", handleCreated);
      dispatch(clearInlineAiConversationKey(chatKeyRef.current));
      if (sessionIdRef.current) {
        socketClient.leaveConversation(sessionIdRef.current);
      }
    };
  }, [handleProgress, teamId, user?.id]);

  const sendMessage = useCallback(async (message) => {
    const question = `${message || ""}`.trim();
    if (!question || isLoading || !teamId) return null;
    const requestId = ++requestIdRef.current;
    const activeSessionId = ensureSessionId();
    const chatKey = chatKeyRef.current;
    dispatch(setActiveAiConversation({
      key: chatKey, id: aiConversationId, userId: user.id, teamId,
      title: question.slice(0, 100), busy: true,
    }));
    dispatch(setInlineAiConversationKey(chatKey));
    setError(null);
    setIsLoading(true);
    setProgressEvents([]);
    setMessages((current) => [...current, { content: question, role: "user" }]);
    await joinProgressRoom(activeSessionId);
    if (requestId !== requestIdRef.current) {
      dispatch(dismissAiConversation(chatKey));
      return null;
    }
    try {
      const response = await respondAi({
        aiConversationId,
        context,
        message: question,
        persistence: aiConversationId ? "persistent" : persistence,
        sessionId: activeSessionId,
        teamId,
      });
      const orchestration = response.orchestration;
      dispatch(updateActiveAiConversation({
        key: chatKey, id: orchestration.aiConversationId || aiConversationId, busy: false,
      }));
      if (requestId !== requestIdRef.current) return null;
      setAiConversationId(orchestration.aiConversationId || aiConversationId);
      if (orchestration.aiConversationId || orchestration.sessionId) {
        sessionIdRef.current = orchestration.aiConversationId || orchestration.sessionId;
        setSessionId(orchestration.sessionId);
      }
      setMessages((current) => [
        ...current,
        {
          chartPreviews: orchestration.chartPreviews || [],
          connectionOptions: orchestration.connectionOptions || [],
          content: orchestration.message,
          pendingAction: orchestration.pendingAction,
          role: "assistant",
          workSummary: orchestration.workSummary || [],
        },
      ]);
      return orchestration;
    } catch (requestError) {
      dispatch(updateActiveAiConversation({ key: chatKey, busy: false }));
      if (requestId !== requestIdRef.current) return null;
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
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setProgressEvents([]);
      }
    }
  }, [
    aiConversationId,
    context,
    ensureSessionId,
    isLoading,
    joinProgressRoom,
    persistence,
    teamId,
    dispatch,
    user.id,
  ]);

  const clear = useCallback(() => {
    savePromiseRef.current = null;
    requestIdRef.current += 1;
    dispatch(clearInlineAiConversationKey(chatKeyRef.current));
    chatKeyRef.current = crypto.randomUUID();
    if (sessionIdRef.current) {
      socketClient.leaveConversation(sessionIdRef.current);
    }
    sessionIdRef.current = null;
    setAiConversationId(null);
    setError(null);
    setIsLoading(false);
    setMessages([]);
    setProgressEvents([]);
    setSessionId(null);
  }, []);

  const confirmAction = useCallback(async (pendingAction) => {
    if (!pendingAction?.actionId || isLoading || !teamId) return null;
    const requestId = ++requestIdRef.current;
    const activeSessionId = ensureSessionId();
    const chatKey = chatKeyRef.current;
    dispatch(updateActiveAiConversation({ key: chatKey, busy: true }));
    setError(null);
    setIsLoading(true);
    setProgressEvents([]);
    setMessages((current) => [...current, { content: "Confirm this change", role: "user" }]);
    await joinProgressRoom(activeSessionId);
    if (requestId !== requestIdRef.current) {
      dispatch(updateActiveAiConversation({ key: chatKey, busy: false }));
      return null;
    }
    try {
      const response = await respondAi({
        action: {
          actionId: pendingAction.actionId,
          type: "confirm_pending_action",
        },
        aiConversationId,
        persistence: aiConversationId ? "persistent" : persistence,
        sessionId: activeSessionId,
        teamId,
      });
      if (requestId !== requestIdRef.current) return null;
      const orchestration = response.orchestration;
      setMessages((current) => [
        ...current,
        {
          actionResult: orchestration.actionResult,
          content: orchestration.message,
          role: "assistant",
          workSummary: orchestration.workSummary || [],
        },
      ]);
      return orchestration;
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return null;
      setError(requestError.message);
      setMessages((current) => [
        ...current,
        { content: requestError.message, isError: true, role: "assistant" },
      ]);
      return null;
    } finally {
      dispatch(updateActiveAiConversation({ key: chatKey, busy: false }));
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setProgressEvents([]);
      }
    }
  }, [aiConversationId, ensureSessionId, isLoading, joinProgressRoom, persistence, teamId]);

  const runChartAction = useCallback(async ({ action }) => {
    const chartPreview = await placeAiChartPreview({
      action,
      aiConversationId,
      persistence: aiConversationId ? "persistent" : persistence,
      sessionId: sessionIdRef.current,
      teamId,
    });
    setMessages((current) => current.map((message) => ({
      ...message,
      chartPreviews: message.chartPreviews?.map((preview) => (
        `${preview.chartId}` === `${chartPreview.chartId}` ? chartPreview : preview
      )),
    })));
    return chartPreview;
  }, [aiConversationId, persistence, teamId]);

  const changeAction = useCallback((pendingAction) => {
    setMessages((current) => current.map((message) => {
      if (message.pendingAction?.actionId !== pendingAction?.actionId) return message;
      return { ...message, pendingAction: null };
    }));
    return sendMessage("I want to change the proposed settings.");
  }, [sendMessage]);

  const save = useCallback(async () => {
    if (aiConversationId) return { aiConversationId };
    if (savePromiseRef.current) return savePromiseRef.current;
    if (!sessionId || !teamId) return null;
    try {
      savePromiseRef.current = promoteAiSession(teamId, sessionId);
      const result = await savePromiseRef.current;
      setAiConversationId(result.aiConversationId);
      setSessionId(null);
      sessionIdRef.current = result.aiConversationId;
      return result;
    } catch (saveError) {
      savePromiseRef.current = null;
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
  }, [aiConversationId, sessionId, teamId]);

  return {
    aiConversationId,
    changeAction,
    clear,
    confirmAction,
    error,
    isLoading,
    messages,
    progressEvents,
    runChartAction,
    save,
    sendMessage,
    sessionId,
    toolDisplayNames,
  };
}

export default useAiChat;
