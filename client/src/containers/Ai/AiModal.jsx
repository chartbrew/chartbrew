import React, { useEffect, useMemo, useState, useRef } from "react"
import PropTypes from "prop-types"
import { Accordion, Avatar, Button, Chip, Dropdown, Kbd, Modal, Separator, Tooltip } from "@heroui/react"
import { LuBrainCircuit, LuClock, LuMessageSquare, LuPlus, LuLoader, LuTrash2, LuCoins, LuEllipsis, LuSlack, LuX } from "react-icons/lu"
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { useParams } from "react-router";

import { getAiConversation, getAiConversations, getAiTools, orchestrateAi, deleteAiConversation, getAiUsage } from "../../api/ai";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import { getChart } from "../../slices/chart";
import { selectProjects } from "../../slices/project";
import { selectConnections } from "../../slices/connection";
import { selectDatasetsNoDrafts } from "../../slices/dataset";
import isMac from "../../modules/isMac";
import socketClient from "../../modules/socketClient";
import getDatasetDisplayName from "../../modules/getDatasetDisplayName";
import AiComposer from "./AiComposer";
import AiContextPicker from "./AiContextPicker";
import AiMessageGroup from "./AiMessageGroup";
import AiProgress from "./AiProgress";
import { getChartToolMessageInfo, groupAiMessages, humanizeToolName } from "./aiMessageUtils";

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTokens(tokens) {
  if (!tokens || tokens === 0) return "0";
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function AiModal({ isOpen, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [progressEvents, setProgressEvents] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [teamUsage, setTeamUsage] = useState(null);
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const dispatch = useDispatch();
  const fetchedChartsRef = useRef(new Set());
  const projects = useSelector(selectProjects);
  const connections = useSelector(selectConnections);
  const datasets = useSelector(selectDatasetsNoDrafts);
  const contextEntities = useMemo(() => [
    ...projects.map((p) => ({ ...p, entity_type: "project" })),
    ...connections.map((c) => ({ ...c, entity_type: "connection" })),
    ...datasets.map((d) => ({ ...d, entity_type: "dataset" })),
  ], [projects, connections, datasets]);

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
            isUpdate: chartInfo.type === "chart_updated",
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
      loadAiToolDisplayNames();
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
      // load usage in the background
      loadTeamUsage();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const loadTeamUsage = async () => {
    try {
      const data = await getAiUsage(team.id);
      setTeamUsage(data);
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
          displayNames[tool.name] = tool.displayName || tool.display_name || humanizeToolName(tool.name);
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
        const response = await orchestrateAi(
          team.id,
          currentQuestion,
          [],
          tempConversation.id, // Use the ID if we already have it from socket
          context
        );

        // Validate response structure
        if (!response || !response.orchestration || !response.orchestration.message) {
          throw new Error("Invalid response from AI");
        }

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
        // Existing conversation - get complete history from database
        const latestConversation = await getAiConversation(conversation.id, team.id);
        const conversationHistory = latestConversation?.conversation?.full_history || [];

        const response = await orchestrateAi(
          team.id,
          currentQuestion,
          conversationHistory,
          conversation.id,
          context
        );

        // Validate response structure
        if (!response || !response.orchestration || !response.orchestration.message) {
          throw new Error("Invalid response from AI");
        }

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
        fetchedChartsRef.current.clear();
      }

      // Reload conversations list
      await loadConversations();
    } catch (error) {
      toast.error(error.message);
    }
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
      const response = await orchestrateAi(
        team.id,
        syntheticQuestion,
        conversation?.full_history || [],
        currentConversationId,
        null // no context for suggestion actions
      );

      // Validate response structure
      if (!response || !response.orchestration || !response.orchestration.message) {
        throw new Error("Invalid response from AI");
      }

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
        <Modal.Container className={conversation ? "sm:mt-4" : ""} scroll="outside">
          <Modal.Dialog className={conversation ? "sm:max-w-6xl" : "sm:max-w-xl"}>
            <Modal.CloseTrigger />
            {!conversation && (
              <Modal.Body className="pt-8">
                <div className="flex flex-col gap-2 items-center justify-center">
                  <Avatar
                    size="lg"
                    color="accent"
                    variant="soft"
                  >
                    <Avatar.Fallback>
                      <LuBrainCircuit size={24} className="text-accent" />
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex flex-row items-center gap-2">
                      <div className="font-tw font-medium text-lg">Chartbrew AI</div>
                      <Chip variant="soft" color="accent" size="sm" className="">
                        Beta
                      </Chip>
                    </div>
                    <div className="text-sm text-foreground-500">Ask me anything about your data</div>
                    <div className="flex flex-row items-center gap-1 mt-2">
                      <Kbd>
                        <Kbd.Abbr keyValue={isMac() ? "command" : "ctrl"} />
                        <Kbd.Content>K</Kbd.Content>
                      </Kbd>
                    </div>
                  </div>
                </div>
                <div className="h-8" />
                <AiComposer
                  id="ai-form"
                  name="aiQuestion"
                  placeholder="Ask me a question"
                  isLoading={isLoading}
                  selectedContext={selectedContext}
                  onSubmitQuestion={_onAskAi}
                  onAtTyped={() => {
                    if (!isContextPopoverOpen) {
                      setIsContextPopoverOpen(true);
                    }
                  }}
                  suggestions={[
                    "What can you do?",
                    "How many users I have in my database?"
                  ]}
                />

                <div className="h-2" />

                <div className="flex flex-row items-center gap-1 flex-wrap">
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
                    showTriggerLabel
                  />

                  {(selectedContext.multiSelect.length > 0 || selectedContext.singleSelect) && (
                    <>
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
                    </>
                  )}
                </div>
                <div className="h-8" />
                <Separator />
                <div className="h-2" />
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
                              {conv.total_tokens > 0 && (
                                <div className="flex items-center gap-1">
                                  <LuCoins size={12} />
                                  <span>{formatTokens(conv.total_tokens)} tokens</span>
                                </div>
                              )}
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

                <div className="h-2" />
                <Separator />
                <div className="h-2" />
                <div className="text-xs text-foreground-500 mb-2">
                  <span className="font-medium">Note:</span> We are still in beta. Some features may not work as expected. Please let us know if you encounter any issues or have any feedback at <a href="mailto:support@chartbrew.com" className="text-accent-500 hover:text-accent-600">support@chartbrew.com</a>
                </div>
              </Modal.Body>
            )}

            {conversation && (
              <Modal.Body className="p-0">
                <div className="flex flex-row">
                  <div className="flex-none w-60 pr-4">
                    <div className="flex flex-col relative h-full bg-surface-secondary rounded-3xl rounded-bl-2xl">
                      <div className="w-full px-4 pt-4">
                        <Button
                          variant="primary"
                          onPress={() => {
                            setConversation(null);
                            setLocalMessages([]);
                            setProgressEvents([]);
                            setCreatedCharts([]);
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
                          New Conversation
                        </Button>
                        <div className="h-4" />
                        <Separator />
                      </div>
                      <div className="flex flex-col h-full max-h-[calc(100vh-200px)] gap-2 px-2 overflow-y-auto py-4 pb-10">
                        {conversations.map((c) => (
                          <div
                            key={c.id}
                            className={`flex flex-row gap-2 cursor-pointer px-2 py-2 rounded-lg transition-colors group relative ${c.id === conversation.id ? "bg-surface border border-divider" : "hover:bg-surface/50"}`}
                            onClick={() => _onSelectConversation(c.id)}
                          >
                            <div className="pt-1">
                              {c.source === "slack" ? <LuSlack size={14} /> : <LuMessageSquare size={14} />}
                            </div>
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <div className="text-sm text-foreground truncate pr-6">{c.title}</div>
                              <div className="flex flex-col gap-1">
                                <div className="text-xs text-foreground-500 flex items-center gap-1">
                                  <LuClock size={10} />
                                  <span className="truncate">{formatDate(c.createdAt)}</span>
                                </div>
                                {c.total_tokens > 0 && (
                                  <div className="text-xs text-foreground-500 flex items-center gap-1">
                                    <LuCoins size={10} />
                                    <span>{formatTokens(c.total_tokens)}</span>
                                  </div>
                                )}
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

                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-surface-secondary rounded-3xl">
                        <Tooltip>
                          <Tooltip.Trigger>
                            <div className="flex flex-row items-center justify-center gap-2 cursor-help">
                              <div><LuCoins size={14} /></div>
                              <div className="text-sm text-foreground-500">{formatTokens(teamUsage?.total?.total_tokens || 0)}</div>
                            </div>
                          </Tooltip.Trigger>
                          <Tooltip.Content>
                            <div className="flex flex-col gap-1">
                              <div className="text-xs text-foreground-500">Total tokens used: {formatTokens(teamUsage?.total?.total_tokens || 0)}</div>
                              <div className="text-xs text-foreground-500">Total API calls: {teamUsage?.total?.api_calls || 0}</div>
                              <div className="text-xs text-foreground-500">Total models used: {teamUsage?.byModel?.length || 0}</div>
                            </div>
                          </Tooltip.Content>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                  <div className="relative flex-1 h-full rounded-lg mt-4">
                    <div className="pb-4 border-b border-divider">
                      <div className="flex flex-row gap-3 pl-4 pr-4 items-start">
                        <Avatar
                          color="accent"
                          variant="soft"
                        >
                          <Avatar.Fallback>
                            <LuBrainCircuit size={24} className="text-foreground" />
                          </Avatar.Fallback>
                        </Avatar>
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex flex-row items-center gap-2">
                            <div className="text-md text-foreground font-medium">{conversation.title}</div>
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
                          <div className="flex flex-row items-center gap-3 text-xs text-foreground-500">
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
                            {conversation.total_tokens > 0 && (
                              <Tooltip>
                                <Tooltip.Trigger>
                                  <div className="flex items-center gap-1 cursor-help">
                                    <LuCoins size={12} />
                                    <span>{formatTokens(conversation.total_tokens)}</span>
                                  </div>
                                </Tooltip.Trigger>
                                <Tooltip.Content>
                                  {`${conversation.total_tokens.toLocaleString()} tokens used`}
                                </Tooltip.Content>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="h-[calc(100vh-200px)] overflow-y-auto py-4 pb-24">
                      {conversation?.full_history?.length > 0 ? (
                        <>
                          {conversationGroups.map((group, index) => (
                            <AiMessageGroup
                              key={`group-${index}`}
                              group={group}
                              groupIndex={index}
                              createdCharts={createdCharts}
                              toolDisplayNames={toolDisplayNames}
                              onSuggestionClick={_onSuggestionClick}
                              isLoading={isLoading}
                            />
                          ))}
                          <AiProgress progressEvents={progressEvents} toolDisplayNames={toolDisplayNames} />
                          {isLoading && progressEvents.length === 0 && (
                            <div className="flex justify-center mb-4 px-4">
                              <div className="w-full max-w-[90%]">
                                <div className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Avatar
                                      icon={<LuBrainCircuit size={16} className="text-background" />}
                                      size="sm"
                                      color="accent"
                                    />
                                    <LuLoader size={16} className="animate-spin" />
                                    <span className="text-sm">Thinking...</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </>
                      ) : progressEvents.length > 0 ? (
                        <>
                          {localMessages.length > 0 && (
                            <div className="flex justify-end mb-4 px-4">
                              <div className="max-w-[70%] bg-primary text-accent-foreground px-4 py-3 rounded-lg">
                                <div className="text-sm whitespace-pre-wrap">{localMessages[0].content}</div>
                              </div>
                            </div>
                          )}
                          <AiProgress progressEvents={progressEvents} toolDisplayNames={toolDisplayNames} />
                          <div ref={messagesEndRef} />
                        </>
                      ) : isLoading ? (
                        <div className="flex justify-center items-center h-full">
                          <div className="flex items-center gap-2">
                            <LuLoader size={24} className="animate-spin text-accent" />
                            <span className="text-sm text-foreground-500">Loading conversation...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-foreground-500 text-sm">No messages yet</div>
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-divider bg-surface z-10">
                      <AiComposer
                        id="ai-conversation-form"
                        name="aiConversationQuestion"
                        inputRef={inputRef}
                        placeholder="Ask me anything about your data..."
                        isLoading={isLoading}
                        selectedContext={selectedContext}
                        onSubmitQuestion={_onAskAi}
                        onAtTyped={() => {
                          if (!isSecondContextPopoverOpen) {
                            setIsSecondContextPopoverOpen(true);
                          }
                        }}
                        showEnterHint
                        leadingContent={(selectedContext.multiSelect.length > 0 || selectedContext.singleSelect) && (
                          <div className="flex flex-wrap items-center gap-2 mb-2">
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
                            <span className="text-xs text-foreground-500">+ add more details</span>
                          </div>
                        )}
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
                            triggerVariant="outline"
                            triggerSize="md"
                            triggerIsIconOnly
                          />
                        )}
                      />
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
