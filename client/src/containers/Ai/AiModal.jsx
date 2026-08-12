import React, { useEffect, useMemo, useState, useRef } from "react"
import PropTypes from "prop-types"
import { Accordion, Button, Chip, Dropdown, Modal, Separator } from "@heroui/react"
import { LuClock, LuMessageSquare, LuPlus, LuLoader, LuTrash2, LuEllipsis, LuSlack, LuX } from "react-icons/lu"
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { useParams } from "react-router";

import { getAiConversation, getAiConversations, getAiTools, respondAi, deleteAiConversation } from "../../api/ai";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import { getChart } from "../../slices/chart";
import { selectProjects } from "../../slices/project";
import { selectConnections } from "../../slices/connection";
import { selectDatasetsNoDrafts } from "../../slices/dataset";
import { clearAiModalConversationId, selectAiModalConversationId } from "../../slices/ui";
import socketClient from "../../modules/socketClient";
import getDatasetDisplayName from "../../modules/getDatasetDisplayName";
import canAccess from "../../config/canAccess";
import AiComposer from "./AiComposer";
import AiActionPreviewCard from "./AiActionPreviewCard";
import AiContextPicker from "./AiContextPicker";
import AiMessageGroup from "./AiMessageGroup";
import AiProgress from "./AiProgress";
import { AiLoadingActivity, AiUserPrompt } from "./AiTranscript";
import {
  getChartToolMessageInfo,
  getCompletedActionIds,
  groupAiMessages,
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
  const [selectedContext, setSelectedContext] = useState({
    multiSelect: [], // entities selected via "@" button (multiple allowed)
    singleSelect: null // entity selected via quick reply (only one at a time)
  });
  const [contextSearch, setContextSearch] = useState("");
  const [isContextPopoverOpen, setIsContextPopoverOpen] = useState(false);
  const [isSecondContextPopoverOpen, setIsSecondContextPopoverOpen] = useState(false);

  const params = useParams();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const pendingConversationId = useSelector(selectAiModalConversationId);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const dispatch = useDispatch();
  const fetchedChartsRef = useRef(new Set());
  const projects = useSelector(selectProjects);
  const connections = useSelector(selectConnections);
  const datasets = useSelector(selectDatasetsNoDrafts);
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const isTeamAdmin = canAccess("teamAdmin", user.id, team?.TeamRoles);
  const isReportingOnly = teamRole === "projectViewer";
  const questionPlaceholder = isReportingOnly
    ? "Ask about existing reports and metrics"
    : "Ask a question about your data";
  const contextEntities = useMemo(() => [
    ...projects.map((p) => ({ ...p, entity_type: "project" })),
    ...(isTeamAdmin ? connections.map((c) => ({ ...c, entity_type: "connection" })) : []),
    ...(!isReportingOnly ? datasets.map((d) => ({ ...d, entity_type: "dataset" })) : []),
  ], [projects, connections, datasets, isReportingOnly, isTeamAdmin]);

  // Filter context entities based on search
  const filteredContextEntities = useMemo(() => contextEntities.filter((entity) => {
    if (!contextSearch.trim()) return true;

    const searchLower = contextSearch.toLowerCase();
    const name = entity.name?.toLowerCase() || "";
    const type = entity.type?.toLowerCase() || "";
    const legend = entity.legend?.toLowerCase() || "";

    return name.includes(searchLower) ||
           type.includes(searchLower) ||
           legend.includes(searchLower);
  }), [contextEntities, contextSearch]);
  const conversationGroups = useMemo(() => (
    groupAiMessages(conversation?.full_history || [])
  ), [conversation?.full_history]);
  const completedActionIds = useMemo(() => (
    getCompletedActionIds(conversation?.full_history || [])
  ), [conversation?.full_history]);

  const rememberPendingAction = (pendingAction) => {
    if (!pendingAction?.actionId) return;
    setPendingActions((current) => [
      ...current.filter((item) => item.actionId !== pendingAction.actionId),
      pendingAction,
    ]);
  };

  // Helper to get display label for context entity
  const getContextLabel = (entity) => {
    switch (entity.entity_type) {
      case "project":
        return `Project: ${entity.name}`;
      case "connection":
        return `Connection: ${entity.name} (${entity.type})`;
      case "dataset":
        return `Dataset: ${getDatasetDisplayName(entity)}`;
      default:
        return entity.name;
    }
  };

  // Function to fetch chart data when a chart is created
  const fetchChartData = async (chartId, projectId) => {
    try {
      const result = await dispatch(getChart({
        project_id: projectId,
        chart_id: chartId
      }));

      if (result?.payload) {
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
    } catch (error) {
      console.error("Failed to fetch chart data:", error);
      toast.error("Failed to load chart data");
    }
    return null;
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, progressEvents]);

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
    if (!isOpen || !user?.id || !team?.id) return;

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
      if (data?.conversationId) {
        socketClient.joinConversation(data.conversationId);
        setConversation(prev => prev ? { ...prev, id: data.conversationId, isTemporary: false } : null);
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
  }, [isOpen, user?.id, team?.id]);

  // Load conversations when modal opens
  useEffect(() => {
    if (isOpen && team?.id) {
      loadConversations();
      if (isTeamAdmin) loadAiToolDisplayNames();
      // check the route params and add project and chart id to the context
      const projectId = parseInt(params?.projectId, 10);
      const chartId = parseInt(params?.chartId, 10);
      const connectionId = parseInt(params?.connectionId, 10);
      const datasetId = parseInt(params?.datasetId, 10);

      if (projectId && selectedContext?.multiSelect?.find(e => e.id === projectId) === undefined) {
        const project = projects.find(p => p.id === projectId);
        const projectLabel = `Project: ${project?.name}`;
        setSelectedContext(prev => ({ ...prev, multiSelect: [...prev.multiSelect, { id: projectId, entity_type: "project", label: projectLabel }] }));
      }
      if (chartId && selectedContext?.multiSelect?.find(e => e.id === chartId) === undefined) {
        const chartLabel = `Chart ID: ${chartId}`;
        setSelectedContext(prev => ({ ...prev, multiSelect: [...prev.multiSelect, { id: chartId, entity_type: "chart", label: chartLabel }] }));
      }
      if (connectionId && selectedContext?.multiSelect?.find(e => e.id === connectionId) === undefined) {
        const connection = connections.find(c => c.id === connectionId);
        const connectionLabel = `Connection: ${connection?.name} (${connection?.type})`;
        setSelectedContext(prev => ({ ...prev, multiSelect: [...prev.multiSelect, { id: connectionId, entity_type: "connection", label: connectionLabel }] }));
      }
      if (datasetId && selectedContext?.multiSelect?.find(e => e.id === datasetId) === undefined) {
        const dataset = datasets.find(d => d.id === datasetId);
        const datasetLabel = `Dataset: ${getDatasetDisplayName(dataset)}`;
        setSelectedContext(prev => ({ ...prev, multiSelect: [...prev.multiSelect, { id: datasetId, entity_type: "dataset", label: datasetLabel }] }));
      }
    }
  }, [isOpen, team?.id]);

  // Join conversation room when conversation changes
  useEffect(() => {
    if (!isSocketReady || !conversation?.id) return;

    // Join the conversation room
    socketClient.joinConversation(conversation.id);

    // Listen for progress events
    const handleProgress = (data) => {
      setProgressEvents(prev => [...prev, {
        id: Date.now() + Math.random(),
        type: data.event,
        message: data.data?.message || "Processing...",
        tools: data.data?.tools || [],
        toolDisplayNames: data.data?.toolDisplayNames || data.data?.tool_display_names || [],
        toolEvents: data.data?.toolEvents || data.data?.tool_events || [],
        status: data.data?.status,
        timestamp: new Date(data.timestamp)
      }]);
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

    // Prepare context object (only multiSelect goes to context)
    let context = null;
    if (selectedContext.multiSelect.length > 0) {
      context = selectedContext.multiSelect;
    }

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

    setSelectedContext({
      multiSelect: [],
      singleSelect: null
    });
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
              setConversation({
                ...fullConversation.conversation,
                id: newConversation.id,
                isTemporary: false
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
          setConversation(updatedConversation.conversation);
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

    setIsLoading(false);
  };

  const _onSelectConversation = async (conversationId) => {
    // Reset state for clean viewing
    setLocalMessages([]);
    setProgressEvents([]);
    setCreatedCharts([]);
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
      if (response?.conversation) {
        setConversation(response.conversation);
      } else {
        toast.error("Failed to fetch conversation");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Open a specific conversation when requested from outside the modal
  useEffect(() => {
    if (!isOpen || !team?.id || !pendingConversationId) return;
    const conversationId = pendingConversationId;
    dispatch(clearAiModalConversationId());
    _onSelectConversation(conversationId);
  }, [isOpen, team?.id, pendingConversationId]);

  const _onDeleteConversation = async (conversationId) => {
    try {
      await deleteAiConversation(conversationId, team.id);
      toast.success("Conversation deleted");

      // If we deleted the current conversation, go back to welcome screen
      if (conversation?.id === conversationId) {
        setConversation(null);
        setLocalMessages([]);
        setProgressEvents([]);
        setCreatedCharts([]);
        setPendingActions([]);
        fetchedChartsRef.current.clear();
      }

      // Reload conversations list
      await loadConversations();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const _onConfirmPendingAction = async (pendingAction) => {
    if (isLoading || !conversation?.id || !pendingAction?.actionId) return;
    setIsLoading(true);
    setProgressEvents([]);
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
        setConversation(updatedConversation.conversation);
      }
      setPendingActions((current) => current.filter((item) => {
        return item.actionId !== pendingAction.actionId;
      }));
      await loadConversations();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const _onChangePendingAction = async (pendingAction) => {
    setPendingActions((current) => current.filter((item) => {
      return item.actionId !== pendingAction.actionId;
    }));
    await _onAskAi("I want to change the proposed settings.");
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

    setIsLoading(true);
    setProgressEvents([]);

    try {
      // For non-reply actions, create a synthetic user message with action details
      const syntheticQuestion = `Please execute this action: ${JSON.stringify({
        action: suggestion.action,
        params: suggestion.params || {},
        label: suggestion.label
      })}`;

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
        context: null,
        message: syntheticQuestion,
        persistence: "persistent",
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
            setConversation({
              ...fullConversation.conversation,
              id: newConversation.id,
              isTemporary: false
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

    setIsLoading(false);
  };


  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
      >
        <Modal.Container className={conversation ? "sm:mt-3" : ""} scroll="outside">
          <Modal.Dialog className={conversation ? "h-[min(880px,92vh)] sm:max-w-[1180px]" : "sm:max-w-2xl"}>
            <Modal.CloseTrigger />
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
                  onSubmitQuestion={_onAskAi}
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
                      filteredContextEntities={filteredContextEntities}
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
                          className="flex flex-row gap-2 cursor-pointer p-2 rounded-lg hover:bg-content2 transition-colors group"
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
                            setConversation(null);
                            setLocalMessages([]);
                            setProgressEvents([]);
                            setCreatedCharts([]);
                            setPendingActions([]);
                            fetchedChartsRef.current.clear();
                            setSelectedContext({
                              multiSelect: [],
                              singleSelect: null
                            });
                            setContextSearch("");
                          }}
                          fullWidth
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
                            className={`group relative flex cursor-pointer flex-row gap-2 rounded-lg px-2 py-2.5 transition-colors ${c.id === conversation.id ? "bg-content2" : "hover:bg-content2/60"}`}
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
                    <header className="shrink-0 border-b border-divider px-5 py-3">
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
                    <div className="min-h-0 flex-1 overflow-y-auto py-5 pb-8">
                      {conversation?.full_history?.length > 0 ? (
                        <>
                          {conversationGroups.map((group, index) => (
                            <AiMessageGroup
                              key={`group-${index}`}
                              group={group}
                              groupIndex={index}
                              createdCharts={createdCharts}
                              completedActionIds={completedActionIds}
                              toolDisplayNames={toolDisplayNames}
                              onChangeAction={_onChangePendingAction}
                              onConfirmAction={_onConfirmPendingAction}
                              onSuggestionClick={_onSuggestionClick}
                              isLoading={isLoading}
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
                          <AiProgress progressEvents={progressEvents} toolDisplayNames={toolDisplayNames} />
                          {isLoading && progressEvents.length === 0 && (
                            <div className="mb-5 px-4"><AiLoadingActivity /></div>
                          )}
                          <div ref={messagesEndRef} />
                        </>
                      ) : progressEvents.length > 0 ? (
                        <>
                          {localMessages.length > 0 && (
                            <div className="mx-auto mb-5 w-full max-w-3xl px-4">
                              <AiUserPrompt>{localMessages[0].content}</AiUserPrompt>
                            </div>
                          )}
                          <AiProgress progressEvents={progressEvents} toolDisplayNames={toolDisplayNames} />
                          <div ref={messagesEndRef} />
                        </>
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
                    <div className="shrink-0 border-t border-divider bg-content1 px-4 py-3">
                      <div className="w-full">
                        <AiComposer
                          id="ai-conversation-form"
                          name="aiConversationQuestion"
                          inputRef={inputRef}
                          placeholder={questionPlaceholder}
                          isLoading={isLoading}
                          layout="inline"
                          selectedContext={selectedContext}
                          onSubmitQuestion={_onAskAi}
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
                              filteredContextEntities={filteredContextEntities}
                              selectedContext={selectedContext}
                              setSelectedContext={setSelectedContext}
                              getContextLabel={getContextLabel}
                              placement="top"
                              contentClassName="z-[100] w-80"
                              triggerVariant="ghost"
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
