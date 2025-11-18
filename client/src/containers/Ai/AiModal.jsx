import React, { useEffect, useState, useRef } from "react"
import PropTypes from "prop-types"
import { Modal, ModalContent, ModalBody, Avatar, Spacer, Input, Button, Accordion, AccordionItem, Divider, Kbd, Popover, PopoverTrigger, PopoverContent, Code, Chip, Tooltip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, CircularProgress, Listbox, ListboxItem } from "@heroui/react"
import { LuArrowRight, LuBrainCircuit, LuClock, LuMessageSquare, LuPlus, LuChevronDown, LuLoader, LuTrash2, LuCoins, LuEllipsis, LuWrench, LuAtSign, LuLayoutGrid, LuPlug, LuDatabase } from "react-icons/lu"
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useParams } from "react-router";

import { getAiConversation, getAiConversations, orchestrateAi, deleteAiConversation, getAiUsage } from "../../api/ai";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import { getChart } from "../../slices/chart";
import Chart from "../Chart/Chart";
import { selectProjects } from "../../slices/project";
import { selectConnections } from "../../slices/connection";
import { selectDatasetsNoDrafts } from "../../slices/dataset";
import isMac from "../../modules/isMac";
import socketClient from "../../modules/socketClient";

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

const components = {
  code: ({ children }) => {
    const formattedText = String(children).replace(/^`|`$/g, ""); // Strip backticks
    return formattedText;
  },
  li: ({ children, className }) => {
    // If this is a task list item, remove the bullet point and reduce padding
    if (className?.includes("task-list-item")) {
      return <li className={`${className} list-none -ml-6`}>{children}</li>;
    }
    return <li className={className}>{children}</li>;
  }
};

function AiModal({ isOpen, onClose }) {
  const [question, setQuestion] = useState("");
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [progressEvents, setProgressEvents] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [teamUsage, setTeamUsage] = useState(null);
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
  const contextEntities = [
    ...projects.map((p) => ({ ...p, entity_type: "project" })),
    ...connections.map((c) => ({ ...c, entity_type: "connection" })),
    ...datasets.map((d) => ({ ...d, entity_type: "dataset" })),
  ];

  // Filter context entities based on search
  const filteredContextEntities = contextEntities.filter((entity) => {
    if (!contextSearch.trim()) return true;

    const searchLower = contextSearch.toLowerCase();
    const name = entity.name?.toLowerCase() || "";
    const type = entity.type?.toLowerCase() || "";
    const legend = entity.legend?.toLowerCase() || "";

    return name.includes(searchLower) ||
           type.includes(searchLower) ||
           legend.includes(searchLower);
  });

  // Helper to get display label for context entity
  const getContextLabel = (entity) => {
    switch (entity.entity_type) {
      case "project":
        return `Project: ${entity.name}`;
      case "connection":
        return `Connection: ${entity.name} (${entity.type})`;
      case "dataset":
        return `Dataset: ${entity.legend || entity.name}`;
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
        .filter(msg => msg.role === "tool")
        .map(msg => {
          try {
            const content = JSON.parse(msg.content);
            if ((msg.name === "create_chart" || msg.name === "update_chart") && content.chart_id) {
              return {
                chartId: content.chart_id,
                projectId: content.project_id,
                isUpdate: msg.name === "update_chart"
              };
            }
          } catch (e) {
            // Ignore parsing errors
          }
          return null;
        })
        .filter(Boolean);

      // Fetch charts that haven't been loaded yet (for both create and update)
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
    if (isOpen) {
      loadConversations();
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
        const datasetLabel = `Dataset: ${dataset?.legend || dataset?.name}`;
        setSelectedContext(prev => ({ ...prev, multiSelect: [...prev.multiSelect, { id: datasetId, entity_type: "dataset", label: datasetLabel }] }));
      }
    }
  }, [isOpen]);

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

  const _onAskAi = async (e) => {
    e.preventDefault();
    // Allow submission if there's either a question or a selected context
    const hasContent = question.trim() || selectedContext.multiSelect.length > 0 || selectedContext.singleSelect;
    if (!hasContent || isLoading) return;

    const userMessage = {
      role: "user",
      content: question.trim()
    };

    // Prepare context object (only multiSelect goes to context)
    let context = null;
    if (selectedContext.multiSelect.length > 0) {
      context = selectedContext.multiSelect;
    }

    setIsLoading(true);
    setProgressEvents([]);
    let currentQuestion = question.trim();

    // Append singleSelect to the question text
    if (selectedContext.singleSelect) {
      currentQuestion += (currentQuestion ? "\n\n" : "") + selectedContext.singleSelect.label;
    }
    setQuestion("");
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

  const _parseMessage = (message) => {
    // Check if message is a tool call
    if (message.tool_calls && message.tool_calls.length > 0) {
      return {
        type: "tool_call",
        tools: message.tool_calls.map(tc => ({
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments)
        }))
      };
    }

    // Check if message is a tool result
    if (message.role === "tool") {
      const content = JSON.parse(message.content);

      // Check if this is a chart creation or update result
      if ((message.name === "create_chart" || message.name === "update_chart") && content.chart_id) {
        return {
          type: message.name === "create_chart" ? "chart_created" : "chart_updated",
          chartId: content.chart_id,
          chartName: content.name,
          chartType: content.type,
          projectId: content.project_id,
          dashboardUrl: content.dashboard_url,
          chartUrl: content.chart_url,
          content: content
        };
      }

      return {
        type: "tool_result",
        name: message.name,
        content: content
      };
    }

    // Check for cb-actions suggestions block
    if (message.role === "assistant" && message.content) {
      // Try multiple patterns to handle cases where AI forgets proper formatting
      let cbActionsMatch = null;
      let suggestionsData = null;

      // First try the proper fenced code block format
      cbActionsMatch = message.content.match(/```cb-actions\s*\n([\s\S]*?)\n```/);
      if (cbActionsMatch) {
        try {
          suggestionsData = JSON.parse(cbActionsMatch[1]);
        } catch (e) {
          // Try parsing without the code block wrapper
        }
      }

      // If that didn't work, try parsing cb-actions directly (fallback for when AI forgets backticks)
      if (!suggestionsData) {
        const directMatch = message.content.match(/cb-actions\s*(\{[\s\S]*?\})/);
        if (directMatch) {
          try {
            suggestionsData = JSON.parse(directMatch[1]);
          } catch (e) {
            // Invalid JSON, continue to next fallback
          }
        }
      }

      // If we successfully parsed suggestions data, process it
      if (suggestionsData && suggestionsData.version === 1 && Array.isArray(suggestionsData.suggestions)) {
        // Remove the cb-actions block from content (try both formats)
        let content = message.content
          .replace(/```cb-actions\s*\n[\s\S]*?\n```/, "")
          .replace(/cb-actions\s*\{[\s\S]*?\}/, "")
          .trim();

        // Remove title if it starts with "# "
        if (content && content.startsWith("# ")) {
          const lines = content.split("\n");
          if (lines.length > 1) {
            content = lines.slice(1).join("\n").trim();
          } else {
            content = "";
          }
        }

        return {
          type: "message_with_suggestions",
          content: content,
          suggestions: suggestionsData.suggestions
        };
      }
    }

    // Regular message
    let content = message.content;
    // Remove title if it starts with "# "
    if (content && content.startsWith("# ")) {
      const lines = content.split("\n");
      if (lines.length > 1) {
        content = lines.slice(1).join("\n").trim();
      } else {
        content = "";
      }
    }

    return {
      type: "message",
      content: content
    };
  };

  const _groupMessages = (messages) => {
    const groups = [];
    let currentGroup = null;

    messages.forEach((message) => {
      const parsed = _parseMessage(message);

      if (message.role === "user" || parsed.type === "chart_created" || parsed.type === "chart_updated") {
        // User messages and chart creation/update messages are always separate
        groups.push({
          type: parsed.type === "chart_created" ? "chart_created" : parsed.type === "chart_updated" ? "chart_updated" : "user",
          messages: [message]
        });
        currentGroup = null;
      } else if (message.role === "assistant" || message.role === "tool") {
        // Group consecutive assistant and tool messages (except chart creation)
        if (!currentGroup || currentGroup.type !== "assistant") {
          currentGroup = {
            type: "assistant",
            messages: []
          };
          groups.push(currentGroup);
        }
        currentGroup.messages.push(message);
      }
    });

    return groups;
  };

  const _renderMessage = (message, index) => {
    const parsed = _parseMessage(message);

    // User messages - right aligned
    if (message.role === "user") {
      return (
        <div key={index} className="flex justify-end mb-4 px-4">
          <div className="max-w-[70%] bg-primary text-primary-foreground px-4 py-3 rounded-lg">
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          </div>
        </div>
      );
    }

    // Tool calls - centered with compact display
    if (parsed.type === "tool_call") {
      return (
        <div key={index} className="flex justify-center mb-4 px-4">
          <div className="w-full max-w-[90%]">
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Avatar
                  icon={<LuBrainCircuit size={16} className="text-background" />}
                  size="sm"
                  color="primary"
                />
                <span className="text-sm font-medium">AI is working...</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {parsed.tools.map((tool, idx) => (
                  <Popover key={idx} placement="bottom" className="max-w-md" aria-label="Tool call arguments">
                    <PopoverTrigger>
                      <Chip
                        variant="flat"
                        color="primary"
                        size="sm"
                        endContent={<LuChevronDown size={14} />}
                        className="cursor-pointer"
                      >
                        Tool: {tool.name}
                      </Chip>
                    </PopoverTrigger>
                    <PopoverContent className="max-w-md">
                      <div className="p-2">
                        <div className="text-xs font-semibold mb-2">Arguments:</div>
                        <Code className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(tool.args, null, 2)}
                        </Code>
                      </div>
                    </PopoverContent>
                  </Popover>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Tool results - centered with compact display
    if (parsed.type === "tool_result") {
      return (
        <div key={index} className="flex justify-center mb-4 px-4">
          <div className="w-full max-w-[90%]">
            <div className="bg-success-50 border border-success-200 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Chip variant="flat" color="success" size="sm">
                  Result: {parsed.name}
                </Chip>
              </div>
              <Popover placement="bottom" aria-label="Tool result">
                <PopoverTrigger>
                  <Button size="sm" variant="flat" endContent={<LuChevronDown size={14} />}>
                    View result
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="max-w-2xl">
                  <div className="p-2">
                    <Code className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(parsed.content, null, 2)}
                    </Code>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      );
    }

    // Chart created/updated messages - render the actual chart
    if ((parsed.type === "chart_created" || parsed.type === "chart_updated") && createdCharts?.length > 0) {
      const chartData = createdCharts.find((c) => c.id === parsed.chartId);

      return (
        <div key={index} className="flex justify-center mb-4 px-4">
          <div className="w-full max-w-[90%]">
            <div className={`px-6 py-4 rounded-lg border ${
              parsed.type === "chart_created" ? "border-success-200" : "border-warning-200"
            }`}>
              <div className="flex items-start gap-3">
                <Avatar
                  icon={<LuBrainCircuit size={16} className="text-background" />}
                  size="sm"
                  color={parsed.type === "chart_created" ? "success" : "warning"}
                />
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">
                      {parsed.type === "chart_created" ? "Chart Created" : "Chart Updated"}
                    </span>
                    <Chip
                      size="sm"
                      variant="flat"
                      color={parsed.type === "chart_created" ? "success" : "warning"}
                    >
                      {parsed.chartName}
                    </Chip>
                  </div>
                  {chartData ? (
                    <div className="overflow-hidden h-[300px]">
                      <Chart
                        chart={chartData}
                        isPublic={false}
                        showExport={false}
                      />
                    </div>
                  ) : (
                    <div className={`border ${
                      parsed.type === "chart_created" ? "border-success-200" : "border-warning-200"
                    } rounded-lg p-8`}>
                      <CircularProgress aria-label="Loading chart" />
                      <div className="text-sm mt-2">Loading chart...</div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <a href={`/${team.id}/${parsed.projectId}/dashboard`} target="_blank" rel="noopener noreferrer">
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="pointer-events-none"
                      >
                        View on Dashboard
                      </Button>
                    </a>
                    <a href={`/${team.id}/${parsed.projectId}/chart/${parsed.chartId}/edit`} target="_blank" rel="noopener noreferrer">
                      <Button
                        size="sm"
                        variant="flat"
                        className="pointer-events-none"
                      >
                        Edit Chart
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Assistant messages with suggestions - centered, taking most space
    if (message.role === "assistant" && parsed.type === "message_with_suggestions") {
      const isError = message.isError;
      return (
        <div key={index} className="flex justify-center mb-4 px-4">
          <div className="w-full max-w-[90%]">
            <div className={`px-6 py-4 rounded-lg ${
              isError
                ? "bg-danger-50 border border-danger-200"
                : ""
            }`}>
              <div className="flex items-start gap-3">
                <Avatar
                  icon={<LuBrainCircuit size={16} className="text-background" />}
                  size="sm"
                  color={isError ? "danger" : "primary"}
                />
                <div className="flex-1">
                  {parsed.content && (
                    <div className={`text-sm prose prose-xs md:prose-sm dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-h5:text-sm prose-h6:text-xs prose-a:text-primary prose-a:hover:text-primary-400 prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:pl-2 prose-blockquote:italic prose-strong:font-bold prose-em:italic prose-pre:bg-content2 prose-pre:text-foreground prose-pre:p-2 prose-pre:rounded-sm prose-img:rounded-sm prose-img:mx-auto max-w-none p-1 leading-tight [&>p]:mb-4 *:my-2 ${
                      isError ? "text-danger" : "text-foreground"
                    }`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                        {parsed.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {parsed.suggestions && parsed.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {parsed.suggestions.map((suggestion) => (
                        <Chip
                          key={suggestion.id}
                          variant="flat"
                          color="secondary"
                          size="sm"
                          className='cursor-pointer hover:bg-secondary-200 transition-colors'
                          onClick={() => _onSuggestionClick(suggestion)}
                          isDisabled={isLoading}
                        >
                          {suggestion.label}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Assistant messages - centered, taking most space
    if (message.role === "assistant" && parsed.type === "message") {
      const isError = message.isError;
      return (
        <div key={index} className="flex justify-center mb-4 px-4">
          <div className="w-full max-w-[90%]">
            <div className={`px-6 py-4 rounded-lg ${
              isError
                ? "bg-danger-50 border border-danger-200"
                : ""
            }`}>
              <div className="flex items-start gap-3">
                <Avatar
                  icon={<LuBrainCircuit size={16} className="text-background" />}
                  size="sm"
                  color={isError ? "danger" : "primary"}
                />
                <div className="flex-1">
                  <div className={`text-sm prose prose-xs md:prose-lg dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-h5:text-sm prose-h6:text-xs prose-a:text-primary prose-a:hover:text-primary-400 prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:pl-2 prose-blockquote:italic prose-strong:font-bold prose-em:italic prose-pre:bg-content2 prose-pre:text-foreground prose-pre:p-2 prose-pre:rounded-sm prose-img:rounded-sm prose-img:mx-auto max-w-none p-1 leading-tight [&>p]:mb-4 *:my-2 ${
                    isError ? "text-danger" : "text-foreground"
                  }`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={components}
                    >
                      {parsed.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const _renderGroupedMessages = (group, groupIndex) => {
    if (group.type === "user") {
      // Render user message
      return _renderMessage(group.messages[0], `group-${groupIndex}-user`);
    }

    if (group.type === "chart_created" || group.type === "chart_updated") {
      // Render chart creation/update message
      return _renderMessage(group.messages[0], `group-${groupIndex}-chart`);
    }

    // Group assistant messages - collect all operations and final message
    const operations = [];
    let finalMessage = null;
    let suggestions = null;

    group.messages.forEach((message) => {
      const parsed = _parseMessage(message);

      if (parsed.type === "tool_call") {
        parsed.tools.forEach((tool) => {
          operations.push({
            type: "call",
            name: tool.name,
            data: tool.args
          });
        });
      } else if (parsed.type === "tool_result") {
        operations.push({
          type: "result",
          name: parsed.name,
          data: parsed.content
        });
      } else if (parsed.type === "message_with_suggestions") {
        finalMessage = {
          ...message,
          content: parsed.content // Use the parsed content with title removed
        };
        suggestions = parsed.suggestions;
      } else if (parsed.type === "message") {
        finalMessage = {
          ...message,
          content: parsed.content // Use the parsed content with title removed
        };
      }
    });

    // Render grouped assistant messages
    return (
      <div key={`group-${groupIndex}`} className="flex justify-center mb-4 px-4">
        <div className="w-full max-w-[90%]">
          <div className="px-6 py-4">
            <div className="flex items-start gap-3">
              <Avatar
                icon={<LuBrainCircuit size={16} className="text-background" />}
                size="sm"
                color="primary"
              />
              <div className="flex-1">
                {operations.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-foreground-500 mb-2">Operations performed:</div>
                    <div className="space-y-1">
                      {operations.map((op, idx) => (
                        <Popover key={idx} placement="bottom" aria-label="Tool call arguments">
                          <PopoverTrigger>
                            <div className="text-xs text-gray-500 cursor-pointer hover:underline flex items-center gap-1">
                              <span><LuWrench size={12} /></span>
                              <span className="font-medium">
                                {op.type === "call" ? "Called" : "Got result from"}: {op.name}
                              </span>
                              <LuChevronDown size={14} className="opacity-60" />
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="max-w-2xl">
                            <div className="p-2">
                              <div className="text-xs font-semibold mb-2">
                                {op.type === "call" ? "Arguments:" : "Result:"}
                              </div>
                              <Code className="text-xs whitespace-pre-wrap max-h-96 overflow-auto">
                                {JSON.stringify(op.data, null, 2)}
                              </Code>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ))}
                    </div>
                  </div>
                )}
                {finalMessage && (
                  <div className="prose prose-xs md:prose-sm dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-h5:text-sm prose-h6:text-xs prose-a:text-primary prose-a:hover:text-primary-400 prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:pl-2 prose-blockquote:italic prose-strong:font-bold prose-em:italic prose-pre:bg-content2 prose-pre:text-foreground prose-pre:p-2 prose-pre:rounded-sm prose-img:rounded-sm prose-img:mx-auto max-w-none p-1 leading-tight [&>p]:mb-4 *:my-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                      {finalMessage.content}
                    </ReactMarkdown>
                  </div>
                )}
                {suggestions && suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {suggestions.map((suggestion) => (
                      <Chip
                        key={suggestion.id}
                        variant="flat"
                        color="secondary"
                        size="sm"
                        className='cursor-pointer hover:bg-secondary-200 transition-colors'
                        onClick={() => _onSuggestionClick(suggestion)}
                        isDisabled={isLoading}
                      >
                        {suggestion.label}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const _renderProgressEvents = () => {
    if (progressEvents.length === 0) return null;

    return (
      <div className="flex justify-center mb-4 px-4">
        <div className="w-full max-w-[90%]">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Avatar
                icon={<LuBrainCircuit size={16} className="text-background" />}
                size="sm"
                color="primary"
              />
              <LuLoader size={16} className="animate-spin" />
              <span className="text-sm">Working...</span>
            </div>
            <div className="space-y-1">
              {progressEvents.map((event) => (
                <div key={event.id} className="text-xs text-primary-700 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    event.type === "processing" ? "bg-blue-500" :
                    event.type === "connection" ? "bg-green-500" :
                    event.type === "analysis" ? "bg-yellow-500" :
                    event.type === "query_generation" ? "bg-purple-500" :
                    event.type === "execution" ? "bg-orange-500" :
                    event.type === "visualization" ? "bg-pink-500" :
                    "bg-gray-500"
                  }`} />
                  {event.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      classNames={{ wrapper: conversation ? "sm:mt-4" : "" }}
      isOpen={isOpen}
      onClose={onClose}
      size={conversation ? "6xl" : "xl"}
      scrollBehavior="outside"
    >
      <ModalContent>
        {!conversation && (
          <ModalBody className="pt-8">
            <div className="flex flex-col gap-2 items-center justify-center">
              <Avatar
                icon={<LuBrainCircuit size={24} className="text-background" />}
                size="lg"
                color="primary"
              />
              <div className="flex flex-col items-center justify-center">
                <div className="flex flex-row items-center gap-2">
                  <div className="font-tw font-medium text-lg">Chartbrew AI</div>
                  <Chip color="primary" variant="flat" size="sm" radius="sm" className="shadow-sm">
                    Beta
                  </Chip>
                </div>
                <div className="text-sm text-foreground-500">Ask me anything about your data</div>
                <div className="flex flex-row items-center gap-1 mt-2">
                  <Kbd keys={isMac() ? ["command"] : ["ctrl"]}>K</Kbd>
                </div>
              </div>
            </div>
            <Spacer y={2} />
            <form onSubmit={_onAskAi} id="ai-form">
              <Input
                placeholder="Ask me a question"
                value={question}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuestion(value);
                  // Open context popover when "@" is typed
                  if (value.endsWith("@") && !isContextPopoverOpen) {
                    setIsContextPopoverOpen(true);
                  }
                }}
                variant="bordered"
                endContent={
                  <Button type="submit" isIconOnly isDisabled={(!question.trim() && selectedContext.multiSelect.length === 0 && !selectedContext.singleSelect)} color="primary" onPress={() => setQuestion(question + " ")} size="sm">
                    <LuArrowRight size={18} />
                  </Button>
                }
              />
              <div className="flex flex-row items-center gap-1 flex-wrap mt-2">
                <Chip
                  variant="flat"
                  size="sm"
                  onClick={() => {
                    setQuestion("What can you do?");
                  }}
                  className="cursor-pointer"
                >
                  What can you do?
                </Chip>
                <Chip
                  variant="flat"
                  size="sm"
                  onClick={() => {
                    setQuestion("How many users I have in my database?");
                  }}
                  className="cursor-pointer"
                >
                  How many users I have in my database?
                </Chip>
              </div>
            </form>
            <div className="flex flex-row items-center gap-1 flex-wrap">
              <Popover placement="bottom" isOpen={isContextPopoverOpen} onOpenChange={setIsContextPopoverOpen}>
                <PopoverTrigger>
                  <Button
                    variant="light"
                    size="sm"
                    startContent={selectedContext.multiSelect.length > 0 ? null : <LuAtSign size={16} />}
                    isDisabled={isLoading}
                    isIconOnly={selectedContext.multiSelect.length > 0}
                  >
                    {selectedContext.multiSelect.length > 0 ? <LuAtSign size={16} /> : "Add extra context"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="p-2 w-full">
                    <div className="text-xs text-foreground-500 mb-2">
                      Context helps our AI to understand your intentions better.
                    </div>
                    <Input
                      placeholder="Search projects, connections, datasets..."
                      value={contextSearch}
                      onChange={(e) => setContextSearch(e.target.value)}
                      variant="bordered"
                      size="sm"
                      className="mb-2"
                      autoFocus
                    />
                    <div className="max-h-64 overflow-y-auto w-full">
                      <Listbox emptyContent="No entities found" className="w-full">
                        {filteredContextEntities.map((entity) => {
                          const isSelected = selectedContext.multiSelect.some(e => e.id === entity.id && e.entity_type === entity.entity_type);
                          return (
                            <ListboxItem
                              key={`${entity.entity_type}-${entity.id}`}
                              textValue={getContextLabel(entity)}
                              startContent={
                                entity.entity_type === "project" ? <LuLayoutGrid size={16} /> :
                                entity.entity_type === "connection" ? <LuPlug size={16} /> :
                                entity.entity_type === "dataset" ? <LuDatabase size={16} /> : null
                              }
                              endContent={isSelected ? <div className="w-2 h-2 bg-primary rounded-full" /> : null}
                              className={isSelected ? "bg-primary-50" : ""}
                              onPress={() => {
                              setSelectedContext(prev => {
                                const newEntity = {
                                  ...entity,
                                  label: getContextLabel(entity)
                                };
                                const isAlreadySelected = prev.multiSelect.some(e => e.id === entity.id && e.entity_type === entity.entity_type);
                                if (isAlreadySelected) {
                                  // Remove if already selected (toggle behavior for multi-select)
                                  return {
                                    ...prev,
                                    multiSelect: prev.multiSelect.filter(e => !(e.id === entity.id && e.entity_type === entity.entity_type))
                                  };
                                } else {
                                  // Add if not selected
                                  return {
                                    ...prev,
                                    multiSelect: [...prev.multiSelect, newEntity]
                                  };
                                }
                              });
                              setContextSearch("");
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm">{entity.name || entity.legend}</span>
                              <span className="text-xs text-foreground-500">
                                {entity.entity_type === "project" ? "Project" :
                                 entity.entity_type === "connection" ? `Connection (${entity.type})` :
                                 "Dataset"}
                              </span>
                            </div>
                          </ListboxItem>
                        )})}
                      </Listbox>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {(selectedContext.multiSelect.length > 0 || selectedContext.singleSelect) && (
                <>
                  {selectedContext.multiSelect.map((entity) => (
                    <Chip
                      key={`${entity.entity_type}-${entity.id}`}
                      color="primary"
                      variant="flat"
                      size="sm"
                      onClose={() => {
                        setSelectedContext(prev => ({
                          ...prev,
                          multiSelect: prev.multiSelect.filter(e => !(e.id === entity.id && e.entity_type === entity.entity_type))
                        }));
                      }}
                    >
                      {entity.label}
                    </Chip>
                  ))}
                  {selectedContext.singleSelect && (
                    <Chip
                      color="secondary"
                      variant="flat"
                      size="sm"
                      onClose={() => {
                        setSelectedContext(prev => ({
                          ...prev,
                          singleSelect: null
                        }));
                      }}
                    >
                      {selectedContext.singleSelect.label}
                    </Chip>
                  )}
                </>
              )}
            </div>
            <Divider />
            <Accordion variant="light">
              <AccordionItem
                key="previous_conversations"
                title={`Previous Conversations (${conversations.length})`}
                classNames={{ title: "text-sm font-medium" }}
              >
                <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="flex flex-row gap-2 cursor-pointer p-2 rounded-lg hover:bg-content2 transition-colors group"
                      onClick={() => _onSelectConversation(conv.id)}
                    >
                      <div className="pt-1"><LuMessageSquare size={16} /></div>
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
                          <DropdownTrigger>
                            <Button isIconOnly size="sm" variant="light">
                              <LuEllipsis size={16} />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu>
                            <DropdownItem key="delete_conversation" onPress={() => _onDeleteConversation(conv.id)} startContent={<LuTrash2 size={16} />}>
                              Delete conversation
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionItem>
            </Accordion>

            <Divider />
            <div className="text-xs text-foreground-500 mb-2">
              <span className="font-medium">Note:</span> We are still in beta. Some features may not work as expected. Please let us know if you encounter any issues or have any feedback at <a href="mailto:support@chartbrew.com" className="text-primary-500 hover:text-primary-600">support@chartbrew.com</a>
            </div>
          </ModalBody>
        )}

        {conversation && (
          <ModalBody className="p-0">
            <div className="flex flex-row">
              <div className="flex-none w-60">
                <div className="flex flex-col relative h-full bg-content2 rounded-tl-2xl rounded-bl-2xl">
                  <div className="w-full px-4 pt-4 border-r border-divider rounded-tl-2xl">
                    <Button
                      color="primary"
                      startContent={<LuPlus size={18} />}
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
                      New Conversation
                    </Button>
                    <Spacer y={4} />
                    <Divider />
                  </div>
                  <div className="flex flex-col h-full max-h-[calc(100vh-200px)] gap-2 px-2 overflow-y-auto border-r border-divider py-4">
                    {conversations.map((c) => (
                      <div
                        key={c.id}
                        className={`flex flex-row gap-2 cursor-pointer px-2 py-2 rounded-lg transition-colors group relative ${c.id === conversation.id ? "bg-background shadow-sm" : "hover:bg-background/50"}`}
                        onClick={() => _onSelectConversation(c.id)}
                      >
                        <div className="pt-1"><LuMessageSquare size={14} /></div>
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
                            <DropdownTrigger>
                              <Button isIconOnly size="sm" variant="light">
                                <LuEllipsis size={16} />
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu>
                              <DropdownItem key="delete_conversation" onPress={() => _onDeleteConversation(c.id)} startContent={<LuTrash2 size={16} />}>
                                Delete conversation
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4 border-r border-t border-divider bg-content2 rounded-bl-2xl">
                    <Tooltip
                      content={<div className="flex flex-col gap-1">
                        <div className="text-xs text-foreground-500">Total tokens used: {formatTokens(teamUsage?.total?.total_tokens || 0)}</div>
                        <div className="text-xs text-foreground-500">Total API calls: {teamUsage?.total?.api_calls || 0}</div>
                        <div className="text-xs text-foreground-500">Total models used: {teamUsage?.byModel?.length || 0}</div>
                      </div>}
                    >
                      <div className="flex flex-row items-center justify-center gap-2 cursor-help">
                        <div><LuCoins size={14} /></div>
                        <div className="text-sm text-foreground-500">{formatTokens(teamUsage?.total?.total_tokens || 0)}</div>
                      </div>
                    </Tooltip>
                  </div>
                </div>
              </div>
              <div className="relative flex-1 h-full rounded-lg">
                <div className="py-4 border-b border-divider">
                  <div className="flex flex-row gap-3 pl-4 pr-4 items-start">
                    <Avatar
                      icon={<LuBrainCircuit size={24} className="text-background" />}
                      color="primary"
                    />
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex flex-row items-center gap-2">
                        <div className="text-md text-foreground font-medium">{conversation.title}</div>
                        <Dropdown>
                          <DropdownTrigger>
                            <Button isIconOnly size="sm" variant="light">
                              <LuEllipsis size={16} />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu>
                            <DropdownItem key="delete_conversation" onPress={() => _onDeleteConversation(conversation.id)} startContent={<LuTrash2 size={16} />}>
                              Delete conversation
                            </DropdownItem>
                          </DropdownMenu>
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
                          <Tooltip content={`${conversation.total_tokens.toLocaleString()} tokens used`}>
                            <div className="flex items-center gap-1 cursor-help">
                              <LuCoins size={12} />
                              <span>{formatTokens(conversation.total_tokens)}</span>
                            </div>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-[calc(100vh-200px)] overflow-y-auto py-4 pb-24">
                  {conversation?.full_history?.length > 0 ? (
                    <>
                      {(() => {
                        // Show grouped view for all conversations
                        const groups = _groupMessages(conversation.full_history);
                        return groups.map((group, index) => _renderGroupedMessages(group, index));
                      })()}
                      {_renderProgressEvents()}
                      {isLoading && progressEvents.length === 0 && (
                        <div className="flex justify-center mb-4 px-4">
                          <div className="w-full max-w-[90%]">
                            <div className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Avatar
                                  icon={<LuBrainCircuit size={16} className="text-background" />}
                                  size="sm"
                                  color="primary"
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
                          <div className="max-w-[70%] bg-primary text-primary-foreground px-4 py-3 rounded-lg">
                            <div className="text-sm whitespace-pre-wrap">{localMessages[0].content}</div>
                          </div>
                        </div>
                      )}
                      {_renderProgressEvents()}
                      <div ref={messagesEndRef} />
                    </>
                  ) : isLoading ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="flex items-center gap-2">
                        <LuLoader size={24} className="animate-spin text-primary" />
                        <span className="text-sm text-foreground-500">Loading conversation...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-foreground-500 text-sm">No messages yet</div>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-divider bg-background z-10 rounded-b-2xl">
                  <form onSubmit={_onAskAi} id="ai-conversation-form">
                    {(selectedContext.multiSelect.length > 0 || selectedContext.singleSelect) && (
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {selectedContext.multiSelect.map((entity) => (
                          <Chip
                            key={`${entity.entity_type}-${entity.id}`}
                            color="primary"
                            variant="flat"
                            size="sm"
                            onClose={() => {
                              setSelectedContext(prev => ({
                                ...prev,
                                multiSelect: prev.multiSelect.filter(e => !(e.id === entity.id && e.entity_type === entity.entity_type))
                              }));
                            }}
                          >
                            {entity.label}
                          </Chip>
                        ))}
                        {selectedContext.singleSelect && (
                          <Chip
                            color="secondary"
                            variant="flat"
                            size="sm"
                            onClose={() => {
                              setSelectedContext(prev => ({
                                ...prev,
                                singleSelect: null
                              }));
                            }}
                          >
                            {selectedContext.singleSelect.label}
                          </Chip>
                        )}
                        <span className="text-xs text-foreground-500">+ add more details</span>
                      </div>
                    )}
                    <div className="flex flex-row gap-2 items-center">
                      <Popover placement="top-start" isOpen={isSecondContextPopoverOpen} onOpenChange={setIsSecondContextPopoverOpen}>
                        <PopoverTrigger>
                          <Button
                            variant="light"
                            isDisabled={isLoading}
                            isIconOnly
                          >
                            <LuAtSign size={18} />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="p-2 w-full">
                            <div className="text-xs text-foreground-500 mb-2">
                              Context helps our AI to understand your intentions better.
                            </div>
                            <Input
                              placeholder="Search projects, connections, datasets..."
                              value={contextSearch}
                              onChange={(e) => setContextSearch(e.target.value)}
                              variant="bordered"
                              size="sm"
                              className="mb-2"
                              autoFocus
                            />
                            <div className="max-h-64 overflow-y-auto w-full">
                              <Listbox emptyContent="No entities found" className="w-full">
                                {filteredContextEntities.map((entity) => {
                                  const isSelected = selectedContext.multiSelect.some(e => e.id === entity.id && e.entity_type === entity.entity_type);
                                  return (
                                    <ListboxItem
                                      key={`${entity.entity_type}-${entity.id}`}
                                      textValue={getContextLabel(entity)}
                                      startContent={
                                        entity.entity_type === "project" ? <LuLayoutGrid size={16} /> :
                                          entity.entity_type === "connection" ? <LuPlug size={16} /> :
                                            entity.entity_type === "dataset" ? <LuDatabase size={16} /> : null
                                      }
                                      endContent={isSelected ? <div className="w-2 h-2 bg-primary rounded-full" /> : null}
                                      className={isSelected ? "bg-primary-50" : ""}
                                      onPress={() => {
                                        setSelectedContext(prev => {
                                          const newEntity = {
                                            ...entity,
                                            label: getContextLabel(entity)
                                          };
                                          const isAlreadySelected = prev.multiSelect.some(e => e.id === entity.id && e.entity_type === entity.entity_type);
                                          if (isAlreadySelected) {
                                            // Remove if already selected (toggle behavior for multi-select)
                                            return {
                                              ...prev,
                                              multiSelect: prev.multiSelect.filter(e => !(e.id === entity.id && e.entity_type === entity.entity_type))
                                            };
                                          } else {
                                            // Add if not selected
                                            return {
                                              ...prev,
                                              multiSelect: [...prev.multiSelect, newEntity]
                                            };
                                          }
                                        });
                                        setContextSearch("");
                                      }}
                                    >
                                      <div className="flex flex-col">
                                        <span className="text-sm">{entity.name || entity.legend}</span>
                                        <span className="text-xs text-foreground-500">
                                          {entity.entity_type === "project" ? "Project" :
                                            entity.entity_type === "connection" ? `Connection (${entity.type})` :
                                              "Dataset"}
                                        </span>
                                      </div>
                                    </ListboxItem>
                                  )
                                })}
                              </Listbox>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Input
                        ref={inputRef}
                        placeholder="Ask me anything about your data..."
                        value={question}
                        onChange={(e) => {
                          const value = e.target.value;
                          setQuestion(value);
                          // Open context popover when "@" is typed
                          if (value.endsWith("@") && !isSecondContextPopoverOpen) {
                            setIsSecondContextPopoverOpen(true);
                          }
                        }}
                        disabled={isLoading}
                        endContent={<Kbd keys={["enter"]} />}
                      />
                      <Button
                        type="submit"
                        isIconOnly
                        color="primary"
                        isDisabled={(!question.trim() && selectedContext.multiSelect.length === 0 && !selectedContext.singleSelect) || isLoading}
                      >
                        <LuArrowRight />
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  )
}

AiModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
}

export default AiModal
