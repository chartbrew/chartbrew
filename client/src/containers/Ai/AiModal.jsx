import React, { useEffect, useState, useRef } from "react"
import PropTypes from "prop-types"
import { Modal, ModalContent, ModalBody, Avatar, Spacer, Input, Button, Accordion, AccordionItem, Divider, Kbd, Popover, PopoverTrigger, PopoverContent, Code, Chip, Tooltip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, CircularProgress } from "@heroui/react"
import { LuArrowRight, LuBrainCircuit, LuClock, LuMessageSquare, LuPlus, LuChevronDown, LuLoader, LuTrash2, LuCoins, LuEllipsis, LuWrench } from "react-icons/lu"
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import ReactMarkdown from "react-markdown";

import { getAiConversation, getAiConversations, orchestrateAi, deleteAiConversation, getAiUsage } from "../../api/ai";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import { getChart } from "../../slices/chart";
import { API_HOST } from "../../config/settings";
import Chart from "../Chart/Chart";
import { Link } from "react-router";

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
  const [question, setQuestion] = useState("");
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [progressEvents, setProgressEvents] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [teamUsage, setTeamUsage] = useState(null);
  const [createdCharts, setCreatedCharts] = useState([]);

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const dispatch = useDispatch();
  const fetchedChartsRef = useRef(new Set());

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

      const chartCreationMessages = allMessages
        .filter(msg => msg.role === "tool")
        .map(msg => {
          try {
            const content = JSON.parse(msg.content);
            if (msg.name === "create_chart" && content.chart_id && !fetchedChartsRef.current.has(content.chart_id)) {
              return {
                chartId: content.chart_id,
                projectId: content.project_id
              };
            }
          } catch (e) {
            // Ignore parsing errors
          }
          return null;
        })
        .filter(Boolean);

      // Fetch charts that haven't been loaded yet
      for (const { chartId, projectId } of chartCreationMessages) {
        if (!fetchedChartsRef.current.has(chartId)) {
          fetchedChartsRef.current.add(chartId);
          await fetchChartData(chartId, projectId);
        }
      }
    };

    fetchNewCharts();
  }, [conversation?.full_history, localMessages]);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!isOpen) return;

    const socketConnection = io(API_HOST);
    
    socketConnection.on("connect", () => {
      socketConnection.emit("authenticate", { userId: user.id, teamId: team.id });
    });

    socketConnection.on("authenticated", () => {
    });

    // Listen for conversation creation event
    socketConnection.on("conversation-created", (data) => {
      // Join the conversation room immediately
      socketConnection.emit("join-conversation", { conversationId: data.conversationId });
      // Update conversation with real ID
      setConversation(prev => prev ? { ...prev, id: data.conversationId, isTemporary: false } : null);
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.disconnect();
      setSocket(null);
    };
  }, [isOpen, user.id, team.id]);

  // Load conversations when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  // Join conversation room when conversation changes
  useEffect(() => {
    if (socket && conversation && conversation.id) {
      socket.emit("join-conversation", { conversationId: conversation.id });

      // Listen for progress events
      const handleProgress = (data) => {
        setProgressEvents(prev => [...prev, {
          id: Date.now() + Math.random(),
          type: data.event,
          message: data.data.message,
          timestamp: new Date(data.timestamp)
        }]);
      };

      socket.on("ai-progress", handleProgress);

      return () => {
        socket.off("ai-progress", handleProgress);
        socket.emit("leave-conversation", { conversationId: conversation.id });
      };
    }
  }, [socket, conversation]);

  const loadConversations = async () => {
    try {
      const data = await getAiConversations(team.id, user.id);
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
    if (!question.trim() || isLoading) return;

    const userMessage = {
      role: "user",
      content: question.trim()
    };

    setIsLoading(true);
    setProgressEvents([]);
    const currentQuestion = question.trim();
    setQuestion("");

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
          user.id,
          currentQuestion,
          [],
          tempConversation.id // Use the ID if we already have it from socket
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
          const updatedConversations = await getAiConversations(team.id, user.id);
          const newConversation = updatedConversations.conversations.find(
            c => c.id === response.orchestration.aiConversationId
          );
          if (newConversation) {
            // Fetch the full conversation with history from database
            // This is important for follow-up messages to have complete context
            const fullConversation = await getAiConversation(newConversation.id, team.id, user.id);
            
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
        const latestConversation = await getAiConversation(conversation.id, team.id, user.id);
        const conversationHistory = latestConversation?.conversation?.full_history || [];

        const response = await orchestrateAi(
          team.id,
          user.id,
          currentQuestion,
          conversationHistory,
          conversation.id
        );

        // Validate response structure
        if (!response || !response.orchestration || !response.orchestration.message) {
          throw new Error("Invalid response from AI");
        }

        // Refresh conversation with updated history from database
        const updatedConversation = await getAiConversation(conversation.id, team.id, user.id);
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
    setIsLoading(true);
    
    try {
      const response = await getAiConversation(conversationId, team.id, user.id);
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

      // Check if this is a chart creation result
      if (message.name === "create_chart" && content.chart_id) {
        return {
          type: "chart_created",
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

      if (message.role === "user" || parsed.type === "chart_created") {
        // User messages and chart creation messages are always separate
        groups.push({
          type: parsed.type === "chart_created" ? "chart_created" : "user",
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

    // Chart created messages - render the actual chart
    if (parsed.type === "chart_created") {
      const chartData = createdCharts.find((c) => c.id === parsed.chartId);

      return (
        <div key={index} className="flex justify-center mb-4 px-4">
          <div className="w-full max-w-[90%]">
            <div className="px-6 py-4 rounded-lg border border-success-200">
              <div className="flex items-start gap-3">
                <Avatar
                  icon={<LuBrainCircuit size={16} className="text-background" />}
                  size="sm"
                  color="success"
                />
                <div className="w-full">
                  {chartData ? (
                    <div className="overflow-hidden h-[300px]">
                      <Chart
                        chart={chartData}
                        isPublic={false}
                        showExport={false}
                      />
                    </div>
                  ) : (
                    <div className="border border-success-200 rounded-lg p-8">
                      <CircularProgress aria-label="Loading chart" />
                      <div className="text-sm mt-2">Loading chart...</div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Link to={`/${team.id}/${parsed.projectId}/dashboard`}>
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="pointer-events-none"
                      >
                        View on Dashboard
                      </Button>
                    </Link>
                    <Link to={`/${team.id}/${parsed.projectId}/chart/${parsed.chartId}/edit`}>
                      <Button
                        size="sm"
                        variant="flat"
                        className="pointer-events-none"
                      >
                        Edit Chart
                      </Button>
                    </Link>
                  </div>
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
                  <div className={`text-sm prose prose-sm max-w-none ${
                    isError ? "text-danger" : "text-foreground"
                  }`}>
                    <ReactMarkdown>{parsed.content}</ReactMarkdown>
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

    if (group.type === "chart_created") {
      // Render chart creation message
      return _renderMessage(group.messages[0], `group-${groupIndex}-chart`);
    }

    // Group assistant messages - collect all operations and final message
    const operations = [];
    let finalMessage = null;

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
                  <div className="text-sm prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{finalMessage.content}</ReactMarkdown>
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
      size={conversation ? "6xl" : "lg"}
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
                <div className="font-tw font-medium text-lg">Chartbrew AI Assistant</div>
                <div className="text-sm text-foreground-500">Ask me anything about your data</div>
              </div>
            </div>
            <Spacer y={2} />
            <form onSubmit={_onAskAi} id="ai-form">
              <Input
                placeholder="Ask me a question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                variant="bordered"
                endContent={
                  <Button type="submit" isIconOnly isDisabled={!question} color="primary" onPress={() => setQuestion(question + " ")} size="sm">
                    <LuArrowRight size={18} />
                  </Button>
                }
              />
            </form>
            <div className="text-xs text-foreground-500 text-center">Our AI can give you insights, answer questions, and generate charts for you.</div>
            <Divider />
            <Accordion variant="light">
              <AccordionItem
                key="previous_conversations"
                title={`Previous Conversations (${conversations.length})`}
                classNames={{ title: "text-sm font-medium" }}
              >
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
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

            <Spacer y={4} />
          </ModalBody>
        )}

        {conversation && (
          <ModalBody className="p-0">
            <div className="flex flex-row">
              <div className="flex-none w-60">
                <div className="flex flex-col relative h-full bg-content2 rounded-tl-2xl rounded-bl-2xl">
                  <div className="w-full bg-content1 px-4 pt-4 border-b border-r border-divider rounded-tl-2xl">
                    <Button
                      color="primary"
                      startContent={<LuPlus size={18} />}
                      onPress={() => {
                        setConversation(null);
                        setLocalMessages([]);
                        setProgressEvents([]);
                        setCreatedCharts({});
                        fetchedChartsRef.current.clear();
                      }}
                      fullWidth
                    >
                      New Conversation
                    </Button>
                    <Spacer y={4} />
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
                <div className="h-[calc(100vh-200px)] overflow-y-auto py-4 pb-20">
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
                  <form onSubmit={_onAskAi}>
                    <div className="flex flex-row gap-2">
                      <Input
                        ref={inputRef}
                        placeholder="Ask me anything about your data..."
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        disabled={isLoading}
                        endContent={<Kbd keys={["enter"]} />}
                      />
                      <Button
                        type="submit"
                        isIconOnly
                        color="primary"
                        isDisabled={!question.trim() || isLoading}
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
