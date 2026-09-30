import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  getAiConversation, getAiTools, placeAiChartPreview, promoteAiSession, respondAi,
} from "../../../api/ai";
import socketClient from "../../../modules/socketClient";
import { selectUser } from "../../../slices/user";
import {
  clearInlineAiConversationKey, dismissAiConversation, setActiveAiConversation, setInlineAiConversationKey,
  updateActiveAiConversation,
} from "../../../slices/ui";
import { isProgressForConversation, normalizeProgressEvent } from "../aiMessageUtils";

function useAiChat({
  activeChartId,
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
  const [history, setHistory] = useState([]);
  const [title, setTitle] = useState(null);
  const [savedContext, setSavedContext] = useState(null);
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
      title: question.slice(0, 100), busy: true, studio_chart_id: activeChartId || null,
    }));
    dispatch(setInlineAiConversationKey(chatKey));
    setTitle((current) => current || question.slice(0, 100));
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
        activeChartId,
        aiConversationId,
        context: savedContext || context,
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
          dataRecoveries: orchestration.dataRecoveries || [],
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
    activeChartId,
    aiConversationId,
    context,
    savedContext,
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
    setHistory([]);
    setTitle(null);
    setSavedContext(null);
    setProgressEvents([]);
    setSessionId(null);
  }, []);

  const load = useCallback(async (conversationId) => {
    const requestId = ++requestIdRef.current;
    if (sessionIdRef.current) socketClient.leaveConversation(sessionIdRef.current);
    sessionIdRef.current = null;
    setSessionId(null);
    setSavedContext(null);
    setIsLoading(true);
    setError(null);
    setMessages([]);
    setHistory([]);
    setTitle(null);
    setProgressEvents([]);
    setAiConversationId(null);
    try {
      const { conversation } = await getAiConversation(conversationId, teamId);
      if (requestId !== requestIdRef.current) return null;
      if (activeChartId && String(conversation.studio_chart_id) !== String(activeChartId)) {
        throw new Error("This conversation belongs to another chart. Select a conversation or start a new one.");
      }
      if (activeChartId && !conversation.studioChart) throw new Error("This chart is no longer available.");
      sessionIdRef.current = conversation.id;
      setAiConversationId(conversation.id);
      setHistory(conversation.full_history || []);
      setTitle(conversation.title);
      setSavedContext(conversation.context || []);
      dispatch(setInlineAiConversationKey(chatKeyRef.current));
      await joinProgressRoom(conversation.id);
      if (requestId !== requestIdRef.current) {
        socketClient.leaveConversation(conversation.id);
        return null;
      }
      return conversation;
    } catch (loadError) {
      if (requestId === requestIdRef.current) setError(loadError.message);
      return null;
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [activeChartId, dispatch, joinProgressRoom, teamId]);

  const confirmAction = useCallback(async (pendingAction) => {
    if (!pendingAction?.actionId || isLoading || !teamId) return null;
    const requestId = ++requestIdRef.current;
    const activeSessionId = ensureSessionId();
    const chatKey = chatKeyRef.current;
    dispatch(setActiveAiConversation({
      key: chatKey, id: aiConversationId, userId: user.id, teamId,
      title: "Continue conversation", busy: true, studio_chart_id: activeChartId || null,
    }));
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
        activeChartId,
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
  }, [activeChartId, aiConversationId, ensureSessionId, isLoading, joinProgressRoom, persistence, teamId]);

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
    history,
    load,
    selectedContext: savedContext || context,
    isLoading,
    messages,
    progressEvents,
    runChartAction,
    save,
    sendMessage,
    sessionId,
    toolDisplayNames,
    title,
  };
}

export default useAiChat;
