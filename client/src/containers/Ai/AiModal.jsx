import React, { useEffect, useMemo, useState, useRef } from "react"
import PropTypes from "prop-types"
import { Accordion, Button, Chip, Dropdown, Modal, Separator } from "@heroui/react"
import { LuClock, LuMessageSquare, LuPlus, LuLoader, LuTrash2, LuEllipsis, LuSlack, LuX } from "react-icons/lu"
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { useParams } from "react-router";

import { getAiConversation, getAiConversations, getAiTools, placeAiChartPreview, respondAi, deleteAiConversation, searchAiContext } from "../../api/ai";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import { getChart, selectCharts } from "../../slices/chart";
import { selectProjects } from "../../slices/project";
import { selectConnections } from "../../slices/connection";
import { selectDatasetsNoDrafts } from "../../slices/dataset";
import {
  clearAiModalConversationId, selectAiModalConversationId, selectActiveAiConversation,
  setActiveAiConversation, updateActiveAiConversation, dismissAiConversation,
} from "../../slices/ui";
import socketClient from "../../modules/socketClient";
import getDatasetDisplayName from "../../modules/getDatasetDisplayName";
import canAccess from "../../config/canAccess";
import AiAccessNotice from "./AiAccessNotice";
import AiAvailabilityStatus from "./AiAvailabilityStatus";
import AiComposer from "./AiComposer";
import AiActionPreviewCard from "./AiActionPreviewCard";
import AiContextPicker from "./AiContextPicker";
import AiMessageGroup from "./AiMessageGroup";
import AiProgress from "./AiProgress";
import { AiUserPrompt } from "./AiTranscript";
import useChatAutoScroll from "./hooks/useChatAutoScroll";
import useAiAvailability from "./hooks/useAiAvailability";
import { canSubmitAiMessage } from "./aiAvailability";
import {
  getChartToolMessageInfo,
  getCompletedActionIds,
  groupAiMessages,
  isProgressForConversation,
  normalizeProgressEvent,
} from "./aiMessageUtils";

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function AiModal({ isOpen, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [progressEvents, setProgressEvents] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [toolDisplayNames, setToolDisplayNames] = useState({});
  const [createdCharts, setCreatedCharts] = useState([]);
  const [chartLoadErrors, setChartLoadErrors] = useState({});
  const [selectedContext, setSelectedContext] = useState({
    multiSelect: [], // entities selected via "@" button (multiple allowed)
    singleSelect: null // entity selected via quick reply (only one at a time)
  });
  const [contextSearch, setContextSearch] = useState("");
  const [contextEntities, setContextEntities] = useState([]);
  const [contextLoadError, setContextLoadError] = useState("");
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [isContextPopoverOpen, setIsContextPopoverOpen] = useState(false);
  const [isSecondContextPopoverOpen, setIsSecondContextPopoverOpen] = useState(false);
  const [showAccessNotice, setShowAccessNotice] = useState(false);

  const params = useParams();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const pendingConversationId = useSelector(selectAiModalConversationId);
  const activeConversation = useSelector(selectActiveAiConversation);
  const activeKeyRef = useRef(crypto.randomUUID());
  const inputRef = useRef(null);
  const dispatch = useDispatch();
  const fetchedChartsRef = useRef(new Set());
  const routeContextSeedRef = useRef("");
  const projects = useSelector(selectProjects);
  const charts = useSelector(selectCharts);
  const connections = useSelector(selectConnections);
  const datasets = useSelector(selectDatasetsNoDrafts);
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const isTeamAdmin = canAccess("teamAdmin", user.id, team?.TeamRoles);
  const {
    availability,
    error: availabilityError,
    isLoading: isAvailabilityLoading,
    reload: reloadAvailability,
  } = useAiAvailability({ enabled: isOpen, teamId: team?.id });
  const aiEnabled = availability?.enabled === true;
  const isAccessNoticeVisible = showAccessNotice && !aiEnabled;
  const ensureAiAvailable = () => {
    if (canSubmitAiMessage(availability)) return true;
    setShowAccessNotice(true);
    return false;
  };
  const isReportingOnly = teamRole === "projectViewer";
  const questionPlaceholder = isReportingOnly
    ? "Ask about existing reports and metrics"
    : "Ask a question about your data";
  const isAnyContextPickerOpen = isContextPopoverOpen || isSecondContextPopoverOpen;
  const routeContextKey = [
    params?.projectId,
    params?.chartId,
    params?.connectionId,
    params?.datasetId,
  ].join(":");
  const conversationGroups = useMemo(() => (
    groupAiMessages(conversation?.full_history || [])
  ), [conversation?.full_history]);
  const completedActionIds = useMemo(() => (
    getCompletedActionIds(conversation?.full_history || [])
  ), [conversation?.full_history]);
  const scrollVersion = [
    conversation?.id || "new",
    conversation?.full_history?.length || 0,
    localMessages.length,
    progressEvents.length,
    pendingActions.length,
    createdCharts.length,
    isLoading,
  ].join(":");
  const {
    containerRef: chatScrollContainerRef,
    contentRef: chatScrollContentRef,
  } = useChatAutoScroll(scrollVersion, `${conversation?.id || "new"}:${isOpen}`);

  const rememberPendingAction = (pendingAction) => {
    if (!pendingAction?.actionId) return;
    setPendingActions((current) => [
      ...current.filter((item) => item.actionId !== pendingAction.actionId),
      pendingAction,
    ]);
  };

  // Helper to get display label for context entity
  const getContextLabel = (entity) => {
    if (entity.label) return entity.label;
    switch (entity.entity_type) {
      case "project":
        return `Dashboard: ${entity.name}`;
      case "chart":
        return `Chart: ${entity.name}`;
      case "connection":
        return `Connection: ${entity.name} (${entity.type})`;
      case "dataset":
        return `Dataset: ${getDatasetDisplayName(entity)}`;
      default:
        return entity.name;
    }
  };

  const applyLoadedConversation = (nextConversation, overrides = {}) => {
    setConversation({ ...nextConversation, ...overrides });
    dispatch(updateActiveAiConversation({
      key: activeKeyRef.current, id: nextConversation.id, title: nextConversation.title,
    }));
    setSelectedContext({
      multiSelect: nextConversation.context || [],
      singleSelect: null,
    });
    if (nextConversation.contextNotice) toast(nextConversation.contextNotice);
  };

  const beginActiveConversation = (title, id = conversation?.id) => {
    activeKeyRef.current = crypto.randomUUID();
    dispatch(setActiveAiConversation({
      key: activeKeyRef.current, id, userId: user.id, teamId: team.id,
      title: title || "Continue conversation", busy: true,
    }));
  };

  // Function to fetch chart data when a chart is created
  const fetchChartData = async (chartId, projectId) => {
    try {
      const result = await dispatch(getChart({
        project_id: projectId,
        chart_id: chartId
      }));

      if (result?.payload) {
        setChartLoadErrors((current) => {
          if (!current[chartId]) return current;
          const next = { ...current };
          delete next[chartId];
          return next;
        });
        setCreatedCharts(prevCharts => {
          // Check if chart already exists
          const existingIndex = prevCharts.findIndex(c => c.id === result.payload.id);
          if (existingIndex >= 0) {
            // Update existing chart
            const updatedCharts = [...prevCharts];
            updatedCharts[existingIndex] = result.payload;
            return updatedCharts;
          } else {
            // Add new chart
            return [...prevCharts, result.payload];
          }
        });
        return result.payload;
      }
      setChartLoadErrors((current) => ({
        ...current,
        [chartId]: result?.meta?.requestStatus === "fulfilled"
          || result?.error?.message === "Chart not found"
          ? "unavailable"
          : "failed",
      }));
    } catch (error) {
      console.error("Failed to fetch chart data:", error);
      toast.error("Failed to load chart data");
    }
    return null;
  };

  // Fetch chart data for newly created charts
  useEffect(() => {
    const fetchNewCharts = async () => {
      const allMessages = [
        ...(conversation?.full_history || []),
        ...localMessages
      ];

      const chartMessages = allMessages
        .map((msg) => {
          const chartInfo = getChartToolMessageInfo(msg);
          if (!chartInfo) return null;

          return {
            chartId: chartInfo.chartId,
            projectId: chartInfo.projectId,
            isUpdate: chartInfo.type === "chart_updated" ||
              ["update_chart", "update_dataset"].includes(chartInfo.toolName),
          };
        })
        .filter(Boolean);

      // Fetch charts that haven't been loaded yet (for both create and update, including temporary)
      for (const { chartId, projectId } of chartMessages) {
        if (!fetchedChartsRef.current.has(chartId)) {
          fetchedChartsRef.current.add(chartId);
          await fetchChartData(chartId, projectId);
        }
      }

      // Refresh charts that were updated
      for (const { chartId, projectId, isUpdate } of chartMessages) {
        if (isUpdate && fetchedChartsRef.current.has(chartId)) {
          await fetchChartData(chartId, projectId);
        }
      }
    };

    fetchNewCharts();
  }, [conversation?.full_history, localMessages]);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!isOpen || !aiEnabled || !user?.id || !team?.id) return;

    let isMounted = true;

    const initSocket = async () => {
      try {
        await socketClient.connect(user.id, team.id);
        if (isMounted) {
          setIsSocketReady(true);
        }
      } catch (error) {
        console.error("Socket connection failed:", error);
        if (isMounted) {
          toast.error("Failed to establish real-time connection");
        }
      }
    };

    // Set up conversation-created listener
    const handleConversationCreated = (data) => {
      if (data?.sessionId !== activeKeyRef.current || String(data?.teamId) !== String(team.id)) return;
      if (data?.conversationId) {
        socketClient.joinConversation(data.conversationId);
        setConversation(prev => prev ? { ...prev, id: data.conversationId, isTemporary: false } : null);
        dispatch(updateActiveAiConversation({ key: activeKeyRef.current, id: data.conversationId }));
      }
    };

    initSocket();
    socketClient.on("conversation-created", handleConversationCreated);

    return () => {
      isMounted = false;
      socketClient.off("conversation-created", handleConversationCreated);
      // Note: We don't disconnect the socket here - it's a singleton that stays connected
      // This allows seamless reconnection when modal reopens
    };
  }, [aiEnabled, isOpen, user?.id, team?.id]);

  // Load conversations when modal opens
  useEffect(() => {
    if (isOpen && aiEnabled && team?.id) {
      loadConversations();
      if (isTeamAdmin) loadAiToolDisplayNames();
    }
  }, [aiEnabled, isOpen, team?.id]);

  useEffect(() => {
    if (!isOpen || !aiEnabled || !team?.id || !isAnyContextPickerOpen) return undefined;
    let isActive = true;
    const timeout = setTimeout(async () => {
      setIsContextLoading(true);
      setContextLoadError("");
      try {
        const response = await searchAiContext(team.id, {
          limit: 30,
          query: contextSearch.trim(),
        });
        if (isActive) setContextEntities(response.context || []);
      } catch (error) {
        if (isActive) {
          setContextEntities([]);
          setContextLoadError(error.message);
        }
      } finally {
        if (isActive) setIsContextLoading(false);
      }
    }, 200);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [aiEnabled, contextSearch, isAnyContextPickerOpen, isOpen, team?.id]);

  // Route context starts a new conversation. Saved conversations restore their own context.
  useEffect(() => {
    if (!isOpen || !aiEnabled || conversation?.id || pendingConversationId) return;
    if (routeContextSeedRef.current === routeContextKey) return;
    const projectId = parseInt(params?.projectId, 10);
    const chartId = parseInt(params?.chartId, 10);
    const connectionId = parseInt(params?.connectionId, 10);
    const datasetId = parseInt(params?.datasetId, 10);
    const routeContext = [];

    if (projectId) {
      const project = projects.find((item) => item.id === projectId);
      routeContext.push({
        entity_type: "project",
        id: projectId,
        label: `Dashboard: ${project?.name || projectId}`,
        metadata: {
          canEdit: canAccess("projectEditor", user.id, team.TeamRoles),
        },
        name: project?.name || `${projectId}`,
        project_id: projectId,
      });
    }
    if (chartId) {
      const chart = charts.find((item) => item.id === chartId);
      const project = projects.find((item) => item.id === chart?.project_id);
      routeContext.push({
        entity_type: "chart",
        id: chartId,
        label: `Chart: ${chart?.name || chartId}`,
        metadata: {
          chartType: chart?.type,
          dashboardName: project?.name,
        },
        name: chart?.name || `${chartId}`,
        project_id: chart?.project_id || projectId || null,
      });
    }
    if (connectionId) {
      const connection = connections.find((item) => item.id === connectionId);
      routeContext.push({
        entity_type: "connection",
        id: connectionId,
        label: `Connection: ${connection?.name || connectionId}`,
        metadata: { sourceType: connection?.subType || connection?.type },
        name: connection?.name || `${connectionId}`,
        project_id: null,
      });
    }
    if (datasetId) {
      const dataset = datasets.find((item) => item.id === datasetId);
      routeContext.push({
        entity_type: "dataset",
        id: datasetId,
        label: `Dataset: ${getDatasetDisplayName(dataset) || datasetId}`,
        name: getDatasetDisplayName(dataset) || `${datasetId}`,
        project_id: projectId || null,
      });
    }
    if (routeContext.length === 0) return;
    routeContextSeedRef.current = routeContextKey;

    setSelectedContext((current) => {
      const items = new Map(current.multiSelect.map((item) => [
        `${item.entity_type}:${item.id}`,
        item,
      ]));
      routeContext.forEach((item) => items.set(`${item.entity_type}:${item.id}`, item));
      return { ...current, multiSelect: [...items.values()] };
    });
  }, [
    aiEnabled,
    charts,
    connections,
    conversation?.id,
    datasets,
    isOpen,
    pendingConversationId,
    projects,
    routeContextKey,
  ]);

  // Join conversation room when conversation changes
  useEffect(() => {
    if (!isSocketReady || !conversation?.id) return;

    // Join the conversation room
    socketClient.joinConversation(conversation.id);

    // Listen for progress events
    const handleProgress = (data) => {
      if (!isProgressForConversation(data, conversation.id)) return;
      setProgressEvents((prev) => [...prev, normalizeProgressEvent(data)]);
    };

    socketClient.on("ai-progress", handleProgress);

    return () => {
      socketClient.off("ai-progress", handleProgress);
      socketClient.leaveConversation(conversation.id);
    };
  }, [isSocketReady, conversation?.id]);

  const loadConversations = async () => {
    try {
      const data = await getAiConversations(team.id);
      setConversations(data.conversations);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const loadAiToolDisplayNames = async () => {
    try {
      const data = await getAiTools(team.id);
      const displayNames = {};

      (data.tools || []).forEach((tool) => {
        if (tool?.name) {
          const displayName = tool.displayName || tool.display_name;
          if (displayName) displayNames[tool.name] = displayName;
        }
      });

      setToolDisplayNames(displayNames);
    } catch (error) {
      console.error("Failed to load AI tool display names:", error);
    }
  };

  const _onAskAi = async (questionText) => {
    const submittedText = questionText || "";
    // Allow submission if there's either a question or a selected context
    const hasContent = submittedText.trim() || selectedContext.multiSelect.length > 0 || selectedContext.singleSelect;
    if (!hasContent || isLoading) return;
    if (!ensureAiAvailable()) return;
    setShowAccessNotice(false);

    // An empty array also removes saved context from the conversation.
    const context = selectedContext.multiSelect;

    setIsLoading(true);
    setProgressEvents([]);
    let currentQuestion = submittedText.trim();

    // Append singleSelect to the question text
    if (selectedContext.singleSelect) {
      currentQuestion += (currentQuestion ? "\n\n" : "") + selectedContext.singleSelect.label;
    }

    const userMessage = {
      role: "user",
      content: currentQuestion || selectedContext.multiSelect.map((entity) => entity.label).join("\n")
    };
    beginActiveConversation(conversation?.title || userMessage.content.slice(0, 100));
    const activeKey = activeKeyRef.current;

    setSelectedContext((current) => ({
      ...current,
      singleSelect: null,
    }));
    setContextSearch("");

    try {
      // If no conversation exists, create it immediately and switch to conversation view
      if (!conversation || conversation.isTemporary) {
        setPendingActions([]);
        // Add user message to local messages immediately
        setLocalMessages([userMessage]);
        
        // Create a temporary conversation object to show in UI
        const tempConversation = {
          id: conversation?.id || null, // Keep ID if already set by socket
          title: "New Conversation",
          full_history: [],
          createdAt: new Date().toISOString(),
          message_count: 1,
          isTemporary: true
        };
        
        setConversation(tempConversation);
        
        // Make the API call - backend creates conversation immediately
        const response = await respondAi({
          aiConversationId: tempConversation.id,
          context,
          message: currentQuestion,
          persistence: "persistent",
          sessionId: activeKey,
          teamId: team.id,
        });

        // Validate response structure
        if (!response || !response.orchestration || !response.orchestration.message) {
          throw new Error("Invalid response from AI");
        }
        rememberPendingAction(response.orchestration.pendingAction);

        // Add AI response to local messages
        const aiMessage = {
          role: "assistant",
          content: response.orchestration.message
        };
        setLocalMessages(prev => [...prev, aiMessage]);

        // Update with real conversation data in the background
        if (response.orchestration?.aiConversationId) {
          await loadConversations();
          const updatedConversations = await getAiConversations(team.id);
          const newConversation = updatedConversations.conversations.find(
            c => c.id === response.orchestration.aiConversationId
          );
          if (newConversation) {
            // Fetch the full conversation with history from database
            // This is important for follow-up messages to have complete context
            const fullConversation = await getAiConversation(newConversation.id, team.id);
            
            if (fullConversation?.conversation) {
              // Update conversation with complete data including full_history
              applyLoadedConversation(fullConversation.conversation, {
                id: newConversation.id,
                isTemporary: false,
              });

              // Clear localMessages and progress events since they're now in full_history
              setLocalMessages([]);
              setProgressEvents([]);
            }
          }
        }
      } else {
        const response = await respondAi({
          aiConversationId: conversation.id,
          context,
          message: currentQuestion,
          persistence: "persistent",
          teamId: team.id,
        });

        // Validate response structure
        if (!response || !response.orchestration || !response.orchestration.message) {
          throw new Error("Invalid response from AI");
        }
        rememberPendingAction(response.orchestration.pendingAction);

        // Refresh conversation with updated history from database
        const updatedConversation = await getAiConversation(conversation.id, team.id);
        if (updatedConversation?.conversation) {
          applyLoadedConversation(updatedConversation.conversation);
        }
        
        // Refresh conversations list
        await loadConversations();
      }

      // Clear progress events
      setProgressEvents([]);

    } catch (error) {
      toast.error(error.message);
      const errorMessage = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        isError: true
      };

      if (conversation) {
        setLocalMessages(prev => [...prev, errorMessage]);
      } else {
        // If conversation creation failed, go back to welcome screen
        setConversation(null);
        setLocalMessages([]);
      }

      // Clear progress events on error
      setProgressEvents([]);
    }

    dispatch(updateActiveAiConversation({ key: activeKey, busy: false }));
    setIsLoading(false);
  };

  const _onSelectConversation = async (conversationId) => {
    if (isLoading) return;
    beginActiveConversation("Continue conversation", conversationId);
    const activeKey = activeKeyRef.current;
    setConversation(null);
    // Reset state for clean viewing
    routeContextSeedRef.current = routeContextKey;
    setLocalMessages([]);
    setProgressEvents([]);
    setCreatedCharts([]);
    setChartLoadErrors({});
    setPendingActions([]);
    fetchedChartsRef.current.clear();
    setSelectedContext({
      multiSelect: [],
      singleSelect: null
    });
    setContextSearch("");
    setIsLoading(true);
    
    try {
      const response = await getAiConversation(conversationId, team.id);
      if (activeKey !== activeKeyRef.current) return;
      if (response?.conversation) {
        applyLoadedConversation(response.conversation);
      } else {
        toast.error("Failed to fetch conversation");
      }
    } catch (error) {
      if ([403, 404].includes(error.status)) dispatch(dismissAiConversation(activeKey));
      toast.error(error.message);
    } finally {
      dispatch(updateActiveAiConversation({ key: activeKey, busy: false }));
      if (activeKey === activeKeyRef.current) setIsLoading(false);
    }
  };

  // Open a specific conversation when requested from outside the modal
  useEffect(() => {
    if (!isOpen || !aiEnabled || isLoading || !team?.id || !pendingConversationId) return;
    const conversationId = pendingConversationId;
    dispatch(clearAiModalConversationId());
    _onSelectConversation(conversationId);
  }, [aiEnabled, isOpen, isLoading, team?.id, pendingConversationId]);

  const _onDeleteConversation = async (conversationId) => {
    try {
      await deleteAiConversation(conversationId, team.id);
      if (activeConversation?.id === conversationId) dispatch(dismissAiConversation(activeConversation.key));
      toast.success("Conversation deleted");

      // If we deleted the current conversation, go back to welcome screen
      if (conversation?.id === conversationId) {
        routeContextSeedRef.current = "";
        setConversation(null);
        setLocalMessages([]);
        setProgressEvents([]);
        setCreatedCharts([]);
        setChartLoadErrors({});
        setPendingActions([]);
        setSelectedContext({ multiSelect: [], singleSelect: null });
        fetchedChartsRef.current.clear();
      }

      // Reload conversations list
      await loadConversations();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const _onConfirmPendingAction = async (pendingAction) => {
    if (!ensureAiAvailable()) return;
    if (isLoading || !conversation?.id || !pendingAction?.actionId) return;
    setIsLoading(true);
    setProgressEvents([]);
    beginActiveConversation(conversation.title);
    const activeKey = activeKeyRef.current;
    try {
      await respondAi({
        action: {
          actionId: pendingAction.actionId,
          type: "confirm_pending_action",
        },
        aiConversationId: conversation.id,
        persistence: "persistent",
        teamId: team.id,
      });
      const updatedConversation = await getAiConversation(conversation.id, team.id);
      if (updatedConversation?.conversation) {
        applyLoadedConversation(updatedConversation.conversation);
      }
      setPendingActions((current) => current.filter((item) => {
        return item.actionId !== pendingAction.actionId;
      }));
      await loadConversations();
    } catch (error) {
      toast.error(error.message);
    } finally {
      dispatch(updateActiveAiConversation({ key: activeKey, busy: false }));
      setIsLoading(false);
    }
  };

  const _onChangePendingAction = async (pendingAction) => {
    setPendingActions((current) => current.filter((item) => {
      return item.actionId !== pendingAction.actionId;
    }));
    await _onAskAi("I want to change the proposed settings.");
  };

  const _onChartAction = async ({ action }) => {
    if (!conversation?.id) return null;
    const chartPreview = await placeAiChartPreview({
      action,
      aiConversationId: conversation.id,
      persistence: "persistent",
      teamId: team.id,
    });
    const updatedConversation = await getAiConversation(conversation.id, team.id);
    if (updatedConversation?.conversation) {
      applyLoadedConversation(updatedConversation.conversation);
    }
    return chartPreview;
  };

  const _onSuggestionClick = async (suggestion) => {
    if (isLoading) return;

    // Check if this is a quick reply (set as context)
    if (suggestion.action === "reply") {
      // Set the suggestion as single-select context (toggle behavior)
      setSelectedContext(prev => ({
        ...prev,
        singleSelect: prev.singleSelect?.id === suggestion.id ? null : suggestion
      }));
      // Focus the input so user can add more text
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }

    if (!ensureAiAvailable()) return;

    setIsLoading(true);
    setProgressEvents([]);

    try {
      // For non-reply actions, create a synthetic user message with action details
      const syntheticQuestion = `Please execute this action: ${JSON.stringify({
        action: suggestion.action,
        params: suggestion.params || {},
        label: suggestion.label
      })}`;
      beginActiveConversation(conversation?.title || suggestion.label);

      // Add user message to local messages
      const userMessage = {
        role: "user",
        content: syntheticQuestion
      };
      setLocalMessages([userMessage]);

      // Create a temporary conversation if needed
      let currentConversationId = conversation?.id;
      if (!conversation || conversation.isTemporary) {
        const tempConversation = {
          id: conversation?.id || null,
          title: "Quick Action",
          full_history: [],
          createdAt: new Date().toISOString(),
          message_count: 1,
          isTemporary: true
        };
        setConversation(tempConversation);
        currentConversationId = tempConversation.id;
      }

      // Call orchestrate with the suggestion action
      const response = await respondAi({
        aiConversationId: currentConversationId,
        context: selectedContext.multiSelect,
        message: syntheticQuestion,
        persistence: "persistent",
        sessionId: activeKeyRef.current,
        teamId: team.id,
      });

      // Validate response structure
      if (!response || !response.orchestration || !response.orchestration.message) {
        throw new Error("Invalid response from AI");
      }
      rememberPendingAction(response.orchestration.pendingAction);

      // Add AI response to local messages
      const aiMessage = {
        role: "assistant",
        content: response.orchestration.message
      };
      setLocalMessages(prev => [...prev, aiMessage]);

      // Update conversation data in background
      if (response.orchestration?.aiConversationId) {
        await loadConversations();
        const updatedConversations = await getAiConversations(team.id);
        const newConversation = updatedConversations.conversations.find(
          c => c.id === response.orchestration.aiConversationId
        );
        if (newConversation) {
          const fullConversation = await getAiConversation(newConversation.id, team.id);
          if (fullConversation?.conversation) {
            applyLoadedConversation(fullConversation.conversation, {
              id: newConversation.id,
              isTemporary: false,
            });
            setLocalMessages([]);
            setProgressEvents([]);
          }
        }
      }

      // Clear progress events
      setProgressEvents([]);

    } catch (error) {
      toast.error(error.message);
      const errorMessage = {
        role: "assistant",
        content: `Sorry, I encountered an error executing that action: ${error.message}`,
        isError: true
      };

      if (conversation) {
        setLocalMessages(prev => [...prev, errorMessage]);
      } else {
        setConversation(null);
        setLocalMessages([]);
      }

      setProgressEvents([]);
    }

    dispatch(updateActiveAiConversation({ key: activeKeyRef.current, busy: false }));
    setIsLoading(false);
  };

  const _onSubmitAi = (questionText) => {
    if (!ensureAiAvailable()) return false;
    _onAskAi(questionText);
    return true;
  };


  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setShowAccessNotice(false);
            onClose();
          }
        }}
      >
        <Modal.Container className={conversation ? "sm:mt-3" : ""} scroll="outside">
          <Modal.Dialog className={conversation ? "h-[min(880px,92vh)] sm:max-w-[1180px]" : "sm:max-w-2xl"}>
            <Modal.CloseTrigger className="z-20" />
            {!conversation && (
              <Modal.Body className="flex flex-col gap-5 pb-6 pt-8">
                <div className="flex w-full flex-col gap-1.5">
                  <h2 className="font-tw text-2xl font-semibold text-foreground">
                    What do you want to understand?
                  </h2>
                  <p className="text-sm leading-6 text-muted">
                    Ask about a metric, compare a period, investigate a change, or create a visualization.
                  </p>
                </div>
                <AiComposer
                  id="ai-form"
                  name="aiQuestion"
                  placeholder={questionPlaceholder}
                  isLoading={isLoading}
                  rows={2}
                  selectedContext={selectedContext}
                  status={(
                    <AiAvailabilityStatus
                      availability={availability}
                      canManagePlatform={user.admin === true}
                      canManageTeam={isTeamAdmin}
                      onNavigate={onClose}
                    />
                  )}
                  onSubmitQuestion={_onSubmitAi}
                  onAtTyped={() => {
                    if (!isContextPopoverOpen) {
                      setIsContextPopoverOpen(true);
                    }
                  }}
                  leadingControl={(
                    <AiContextPicker
                      isOpen={isContextPopoverOpen}
                      onOpenChange={setIsContextPopoverOpen}
                      isLoading={isLoading}
                      contextSearch={contextSearch}
                      setContextSearch={setContextSearch}
                      contextEntities={contextEntities}
                      error={contextLoadError}
                      isSearching={isContextLoading}
                      selectedContext={selectedContext}
                      setSelectedContext={setSelectedContext}
                      getContextLabel={getContextLabel}
                      triggerVariant="outline"
                      triggerSize="sm"
                      showTriggerLabel
                    />
                  )}
                  suggestions={[
                    "Summarize the metrics that changed recently",
                    "Compare this month with the previous month"
                  ]}
                />
                <AiAccessNotice
                  availability={availability}
                  canManagePlatform={user.admin === true}
                  canManageTeam={isTeamAdmin}
                  error={availabilityError}
                  isLoading={isAvailabilityLoading}
                  isRequested={showAccessNotice}
                  onNavigate={onClose}
                  onRetry={reloadAvailability}
                />

                {(selectedContext.multiSelect.length > 0 || selectedContext.singleSelect) && (
                  <div className="flex flex-row flex-wrap items-center gap-1">
                    {selectedContext.multiSelect.map((entity) => (
                      <Chip
                        key={`${entity.entity_type}-${entity.id}`}
                        variant="primary"
                        size="sm"
                      >
                        <Chip.Label>{entity.label}</Chip.Label>
                        <button
                          type="button"
                          aria-label={`Remove ${entity.label}`}
                          className="inline-flex shrink-0 rounded-full p-0.5 text-foreground hover:bg-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          onClick={() => {
                            setSelectedContext(prev => ({
                              ...prev,
                              multiSelect: prev.multiSelect.filter(e => !(e.id === entity.id && e.entity_type === entity.entity_type))
                            }));
                          }}
                        >
                          <LuX size={14} aria-hidden />
                        </button>
                      </Chip>
                    ))}
                    {selectedContext.singleSelect && (
                      <Chip variant="secondary" size="sm">
                        <Chip.Label>{selectedContext.singleSelect.label}</Chip.Label>
                        <button
                          type="button"
                          aria-label={`Remove ${selectedContext.singleSelect.label}`}
                          className="inline-flex shrink-0 rounded-full p-0.5 text-foreground hover:bg-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          onClick={() => {
                            setSelectedContext(prev => ({
                              ...prev,
                              singleSelect: null
                            }));
                          }}
                        >
                          <LuX size={14} aria-hidden />
                        </button>
                      </Chip>
                    )}
                  </div>
                )}
                <Separator />
                <Accordion>
                  <Accordion.Item
                    id="previous_conversations"
                    textValue={`Previous Conversations (${conversations.length})`}
                  >
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        <span className="text-sm font-medium flex-1 text-start">{`Previous Conversations (${conversations.length})`}</span>
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body>
                    <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto">
                      {conversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="flex flex-row gap-2 cursor-pointer p-2 rounded-lg hover:bg-surface-secondary transition-colors group"
                          onClick={() => _onSelectConversation(conv.id)}
                        >
                          <div className="pt-1">
                            {conv.source === "slack" ? <LuSlack size={16} /> : <LuMessageSquare size={16} />}
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="text-sm text-foreground font-medium">{conv.title}</div>
                            <div className="flex flex-row items-center gap-3 text-xs text-foreground-500">
                              <div className="flex items-center gap-1">
                                <LuClock size={12} />
                                <span>{formatDate(conv.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Dropdown>
                              <Dropdown.Trigger>
                                <Button isIconOnly size="sm" variant="tertiary">
                                  <LuEllipsis size={16} />
                                </Button>
                              </Dropdown.Trigger>
                              <Dropdown.Popover>
                                <Dropdown.Menu>
                                  <Dropdown.Item id="delete_conversation" onPress={() => _onDeleteConversation(conv.id)} textValue="Delete conversation">
                                    <div className="flex flex-row items-center gap-2">
                                      <LuTrash2 size={16} />
                                      <span>Delete conversation</span>
                                    </div>
                                  </Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown.Popover>
                            </Dropdown>
                          </div>
                        </div>
                      ))}
                    </div>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>

              </Modal.Body>
            )}

            {conversation && (
              <Modal.Body className="h-full min-h-0 p-0">
                <div className="flex h-full min-h-0 flex-row">
                  <aside className="hidden w-64 flex-none border-r border-divider md:block">
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="w-full px-3 pt-4">
                        <Button
                          variant="primary"
                          onPress={() => {
                            dispatch(dismissAiConversation(activeKeyRef.current));
                            routeContextSeedRef.current = "";
                            setConversation(null);
                            setLocalMessages([]);
                            setProgressEvents([]);
                            setCreatedCharts([]);
                            setChartLoadErrors({});
                            setPendingActions([]);
                            fetchedChartsRef.current.clear();
                            setSelectedContext({
                              multiSelect: [],
                              singleSelect: null
                            });
                            setContextSearch("");
                          }}
                          fullWidth
                          isDisabled={isLoading}
                        >
                          <LuPlus size={18} />
                          New conversation
                        </Button>
                        <div className="h-4" />
                        <Separator />
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
                        {conversations.map((c) => (
                          <div
                            key={c.id}
                            className={`group relative flex cursor-pointer flex-row gap-2 rounded-lg px-2 py-2.5 transition-colors ${c.id === conversation.id ? "bg-surface-secondary" : "hover:bg-surface-secondary/60"}`}
                            onClick={() => _onSelectConversation(c.id)}
                          >
                            <div className="pt-1">
                              {c.source === "slack" ? <LuSlack size={14} /> : <LuMessageSquare size={14} />}
                            </div>
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <div className="text-sm text-foreground truncate pr-6">{c.title}</div>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1 text-xs text-muted">
                                  <LuClock size={10} />
                                  <span className="truncate">{formatDate(c.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Dropdown>
                                <Dropdown.Trigger>
                                  <Button isIconOnly size="sm" variant="tertiary">
                                    <LuEllipsis size={16} />
                                  </Button>
                                </Dropdown.Trigger>
                                <Dropdown.Popover>
                                  <Dropdown.Menu>
                                    <Dropdown.Item id="delete_conversation" onPress={() => _onDeleteConversation(c.id)} textValue="Delete conversation">
                                      <div className="flex flex-row items-center gap-2">
                                        <LuTrash2 size={16} />
                                        <span>Delete conversation</span>
                                      </div>
                                    </Dropdown.Item>
                                  </Dropdown.Menu>
                                </Dropdown.Popover>
                              </Dropdown>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  </aside>
                  <div className="relative flex min-w-0 flex-1 flex-col">
                    <header className="shrink-0 border-b border-divider px-5 py-3 pr-12">
                      <div className="mx-auto flex w-full max-w-3xl flex-row items-start gap-3">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex flex-row items-center gap-2">
                            <div className="truncate text-base font-semibold text-foreground">{conversation.title}</div>
                            <Dropdown>
                              <Dropdown.Trigger>
                                <Button isIconOnly size="sm" variant="tertiary">
                                  <LuEllipsis size={16} />
                                </Button>
                              </Dropdown.Trigger>
                              <Dropdown.Popover>
                                <Dropdown.Menu>
                                  <Dropdown.Item id="delete_conversation" onPress={() => _onDeleteConversation(conversation.id)} textValue="Delete conversation">
                                    <div className="flex flex-row items-center gap-2">
                                      <LuTrash2 size={16} />
                                      <span>Delete conversation</span>
                                    </div>
                                  </Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown.Popover>
                            </Dropdown>
                          </div>
                          <div className="flex flex-row items-center gap-3 text-xs text-muted">
                            <div className="flex items-center gap-1">
                              <LuClock size={12} />
                              <span>{formatDate(conversation.createdAt)}</span>
                            </div>
                            {conversation.message_count > 0 && (
                              <div className="flex items-center gap-1">
                                <LuMessageSquare size={12} />
                                <span>{conversation.message_count} {conversation.message_count === 1 ? "message" : "messages"}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </header>
                    <div
                      className="min-h-0 flex-1 overflow-y-auto py-5 pb-8"
                      ref={chatScrollContainerRef}
                    >
                      <div className="min-h-full" ref={chatScrollContentRef}>
                        {conversation?.full_history?.length > 0 ? (
                          <>
                            {conversationGroups.map((group, index) => (
                              <AiMessageGroup
                                key={`group-${index}`}
                                group={group}
                                groupIndex={index}
                                createdCharts={createdCharts}
                                chartLoadErrors={chartLoadErrors}
                                completedActionIds={completedActionIds}
                                toolDisplayNames={toolDisplayNames}
                                onChangeAction={_onChangePendingAction}
                                onChartAction={_onChartAction}
                                onConfirmAction={_onConfirmPendingAction}
                                onSuggestionClick={_onSuggestionClick}
                                onContinue={_onAskAi}
                                isLoading={isLoading}
                                selectedContext={selectedContext}
                                teamId={team.id}
                                conversationId={conversation.id}
                              />
                            ))}
                            {pendingActions.map((pendingAction) => (
                              <div className="mx-auto mb-6 w-full max-w-3xl px-4" key={pendingAction.actionId}>
                                <AiActionPreviewCard
                                  action={pendingAction}
                                  isLoading={isLoading}
                                  onChange={_onChangePendingAction}
                                  onConfirm={_onConfirmPendingAction}
                                />
                              </div>
                            ))}
                            <AiProgress
                              className="mx-auto mb-5 w-full max-w-3xl px-4"
                              isLoading={isLoading}
                              progressEvents={progressEvents}
                              toolDisplayNames={toolDisplayNames}
                            />
                          </>
                        ) : localMessages.length > 0 ? (
                          <>
                            <div className="mx-auto mb-5 w-full max-w-3xl px-4">
                              <AiUserPrompt>{localMessages[0].content}</AiUserPrompt>
                            </div>
                            <AiProgress
                              className="mx-auto mb-5 w-full max-w-3xl px-4"
                              isLoading={isLoading}
                              progressEvents={progressEvents}
                              toolDisplayNames={toolDisplayNames}
                            />
                          </>
                        ) : progressEvents.length > 0 ? (
                          <AiProgress
                            className="mx-auto mb-5 w-full max-w-3xl px-4"
                            isLoading={isLoading}
                            progressEvents={progressEvents}
                            toolDisplayNames={toolDisplayNames}
                          />
                        ) : isLoading ? (
                          <div className="flex justify-center items-center h-full">
                            <div className="flex items-center gap-2 text-muted">
                              <LuLoader className="animate-spin text-accent" size={18} aria-hidden />
                              <span className="text-sm">Loading conversation…</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-sm text-muted">Ask a question to begin.</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 border-t border-divider bg-surface px-4 py-3">
                      <div className="w-full">
                        <AiAccessNotice
                          availability={availability}
                          canManagePlatform={user.admin === true}
                          canManageTeam={isTeamAdmin}
                          error={availabilityError}
                          isLoading={isAvailabilityLoading}
                          isRequested={showAccessNotice}
                          onNavigate={onClose}
                          onRetry={reloadAvailability}
                        />
                        {isAccessNoticeVisible ? <div className="h-3" /> : null}
                        <AiComposer
                          id="ai-conversation-form"
                          name="aiConversationQuestion"
                          inputRef={inputRef}
                          placeholder={questionPlaceholder}
                          isLoading={isLoading}
                          rows={2}
                          selectedContext={selectedContext}
                          status={(
                            <AiAvailabilityStatus
                              availability={availability}
                              canManagePlatform={user.admin === true}
                              canManageTeam={isTeamAdmin}
                              onNavigate={onClose}
                            />
                          )}
                          onSubmitQuestion={_onSubmitAi}
                          onAtTyped={() => {
                            if (!isSecondContextPopoverOpen) {
                              setIsSecondContextPopoverOpen(true);
                            }
                          }}
                          showEnterHint
                          leadingContent={(selectedContext.multiSelect.length > 0 || selectedContext.singleSelect) ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {selectedContext.multiSelect.map((entity) => (
                                <Chip
                                  key={`${entity.entity_type}-${entity.id}`}
                                  variant="soft"
                                  color="accent"
                                  size="sm"
                                >
                                  <Chip.Label>{entity.label}</Chip.Label>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${entity.label}`}
                                    className="inline-flex shrink-0 rounded-full p-0.5 text-foreground hover:bg-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    onClick={() => {
                                      setSelectedContext(prev => ({
                                        ...prev,
                                        multiSelect: prev.multiSelect.filter(e => !(e.id === entity.id && e.entity_type === entity.entity_type))
                                      }));
                                    }}
                                  >
                                    <LuX size={14} aria-hidden />
                                  </button>
                                </Chip>
                              ))}
                              {selectedContext.singleSelect && (
                                <Chip variant="soft" color="accent" size="sm">
                                  <Chip.Label>{selectedContext.singleSelect.label}</Chip.Label>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${selectedContext.singleSelect.label}`}
                                    className="inline-flex shrink-0 rounded-full p-0.5 text-foreground hover:bg-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    onClick={() => {
                                      setSelectedContext(prev => ({
                                        ...prev,
                                        singleSelect: null
                                      }));
                                    }}
                                  >
                                    <LuX size={14} aria-hidden />
                                  </button>
                                </Chip>
                              )}
                            </div>
                          ) : null}
                          leadingControl={(
                            <AiContextPicker
                              isOpen={isSecondContextPopoverOpen}
                              onOpenChange={setIsSecondContextPopoverOpen}
                              isLoading={isLoading}
                              contextSearch={contextSearch}
                              setContextSearch={setContextSearch}
                              contextEntities={contextEntities}
                              error={contextLoadError}
                              isSearching={isContextLoading}
                              selectedContext={selectedContext}
                              setSelectedContext={setSelectedContext}
                              getContextLabel={getContextLabel}
                              placement="top start"
                              contentClassName="z-[100] w-80"
                              triggerVariant="outline"
                              triggerSize="sm"
                              triggerIsIconOnly
                              triggerTooltip="Add context"
                            />
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Modal.Body>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

AiModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
}

export default AiModal
