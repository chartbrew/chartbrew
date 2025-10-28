import React, { useEffect, useState, useRef } from "react"
import PropTypes from "prop-types"
import { Modal, ModalContent, ModalBody, Avatar, Spacer, Input, Button, Accordion, AccordionItem, Divider, Link, Kbd, Popover, PopoverTrigger, PopoverContent, Code, Chip } from "@heroui/react"
import { LuArrowRight, LuBrainCircuit, LuClock, LuMessageSquare, LuPlus, LuChevronDown, LuLoader } from "react-icons/lu"
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

import { getAiConversation, getAiConversations, orchestrateAi } from "../../api/ai";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import { API_HOST } from "../../config/settings";

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function AiModal({ isOpen, onClose }) {
  const [question, setQuestion] = useState("");
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [progressEvents, setProgressEvents] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const [isActiveSession, setIsActiveSession] = useState(false);

  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, progressEvents]);

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
    if (socket && conversation) {
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
        setIsActiveSession(true); // Mark as active session
        
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
            // Update conversation metadata but keep full_history empty since we're using localMessages
            setConversation({
              ...newConversation,
              full_history: []
            });
          }
        }
      } else {
        // Mark as active session when sending messages in existing conversation
        setIsActiveSession(true);
        
        // Existing conversation - add message to local state
        setLocalMessages(prev => [...prev, userMessage]);

        // Prepare conversation history
        const allMessages = conversation?.full_history || [];
        const conversationHistory = [...allMessages, ...localMessages];

        const response = await orchestrateAi(
          team.id,
          user.id,
          currentQuestion,
          conversationHistory,
          conversation.id
        );

        // Add AI response to local messages
        const aiMessage = {
          role: "assistant",
          content: response.orchestration.message
        };
        setLocalMessages(prev => [...prev, aiMessage]);
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
        setIsActiveSession(false);
      }
    }

    setIsLoading(false);
  };

  const _onSelectConversation = async (conversationId) => {
    setLocalMessages([]);
    setProgressEvents([]);
    setIsActiveSession(false); // Viewing historical conversation
    try {
      const response = await getAiConversation(conversationId, team.id, user.id);
      if (response?.conversation) {
        setConversation(response.conversation);
      } else {
        toast.error("Failed to fetch conversation");
      }
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
      return {
        type: "tool_result",
        name: message.name,
        content: JSON.parse(message.content)
      };
    }

    // Regular message
    return {
      type: "message",
      content: message.content
    };
  };

  const _groupMessages = (messages) => {
    const groups = [];
    let currentGroup = null;

    messages.forEach((message) => {
      if (message.role === "user") {
        // User messages are always separate
        groups.push({
          type: "user",
          messages: [message]
        });
        currentGroup = null;
      } else if (message.role === "assistant" || message.role === "tool") {
        // Group consecutive assistant and tool messages
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
            <div className="bg-content2 border border-divider px-4 py-3 rounded-lg">
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
                  <Popover key={idx} placement="bottom" className="max-w-md">
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
              <Popover placement="bottom">
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

    // Assistant messages - centered, taking most space
    if (message.role === "assistant" && parsed.type === "message") {
      const isError = message.isError;
      return (
        <div key={index} className="flex justify-center mb-4 px-4">
          <div className="w-full max-w-[90%]">
            <div className={`px-6 py-4 rounded-lg ${
              isError 
                ? "bg-danger-50 border border-danger-200" 
                : "bg-content2 border border-divider"
            }`}>
              <div className="flex items-start gap-3">
                <Avatar
                  icon={<LuBrainCircuit size={16} className="text-background" />}
                  size="sm"
                  color={isError ? "danger" : "primary"}
                />
                <div className="flex-1">
                  <div className={`text-sm whitespace-pre-wrap ${
                    isError ? "text-danger" : "text-foreground"
                  }`}>{parsed.content}</div>
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
        finalMessage = message;
      }
    });

    // Render grouped assistant messages
    return (
      <div key={`group-${groupIndex}`} className="flex justify-center mb-4 px-4">
        <div className="w-full max-w-[90%]">
          <div className="bg-content2 border border-divider px-6 py-4 rounded-lg">
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
                        <Popover key={idx} placement="bottom">
                          <PopoverTrigger>
                            <div className="text-sm text-primary cursor-pointer hover:underline flex items-center gap-1">
                              <span>•</span>
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
                  <div className="text-sm whitespace-pre-wrap text-foreground">
                    {finalMessage.content}
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
          <div className="bg-primary-50 border border-primary-200 px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <LuLoader size={16} className="animate-spin text-primary" />
              <span className="text-sm font-medium text-primary">AI is working...</span>
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
      size={conversation ? "5xl" : "lg"}
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
                <div className="flex flex-col gap-2">
                  {conversations.map((conversation) => (
                    <Link
                      onPress={() => _onSelectConversation(conversation.id)}
                      className="flex flex-row gap-2 cursor-pointer"
                      key={conversation.id}
                    >
                      <div><LuMessageSquare /></div>
                      <div className="flex flex-col gap-1">
                        <div className="text-sm text-foreground">{conversation.title}</div>
                        <div className="flex flex-row items-center gap-1">
                          <div><LuClock size={12} /></div>
                          <div className="text-xs text-foreground-500">{formatDate(conversation.createdAt)}</div>
                        </div>
                      </div>
                    </Link>
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
                        setIsActiveSession(false);
                      }}
                      fullWidth
                    >
                      New Conversation
                    </Button>
                    <Spacer y={4} />
                  </div>
                  <div className="flex flex-col h-full gap-2 px-2 overflow-y-auto border-r border-divider py-4">
                    {conversations.map((c) => (
                      <Link
                        onPress={() => _onSelectConversation(c.id)}
                        className={`flex flex-row gap-2 cursor-pointer px-2 py-2 rounded-lg ${c.id === conversation.id ? "bg-background shadow-sm" : ""}`}
                        key={c.id}
                      >
                        <div><LuMessageSquare /></div>
                        <div className="flex flex-col gap-1">
                          <div className="text-sm text-foreground">{c.title}</div>
                          <div className="flex flex-row items-center gap-1">
                            <div><LuClock size={12} /></div>
                            <div className="text-xs text-foreground-500">{formatDate(c.createdAt)}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4 border-r border-t border-divider bg-content2 rounded-bl-2xl">
                    <div className="text-xs text-foreground-500 text-center">End of conversations</div>
                  </div>
                </div>
              </div>
              <div className="relative flex-1 h-full rounded-lg">
                <div className="py-4 border-b border-divider">
                  <div className="flex flex-row gap-2 pl-4">
                    <Avatar
                      icon={<LuBrainCircuit size={24} className="text-background" />}
                      color="primary"
                    />
                    <div className="flex flex-col gap-1">
                      <div className="text-md text-foreground">{conversation.title}</div>
                      <div className="text-xs text-foreground-500">{formatDate(conversation.createdAt)}</div>
                    </div>
                  </div>
                </div>
                <div className="h-[calc(100vh-250px)] overflow-y-auto py-4 pb-20">
                  {(conversation?.full_history?.length > 0 || localMessages.length > 0) ? (
                    <>
                      {(() => {
                        // Show grouped view only for historical conversations (not active sessions)
                        if (!isActiveSession && conversation?.full_history?.length > 0 && localMessages.length === 0) {
                          const groups = _groupMessages(conversation.full_history);
                          return groups.map((group, index) => _renderGroupedMessages(group, index));
                        }
                        // Otherwise show live messages for active sessions
                        return (
                          <>
                            {conversation?.full_history?.map((message, index) => _renderMessage(message, index))}
                            {localMessages.map((message, index) => _renderMessage(message, `local-${index}`))}
                          </>
                        );
                      })()}
                      {_renderProgressEvents()}
                      {isLoading && progressEvents.length === 0 && (
                        <div className="flex justify-center mb-4 px-4">
                          <div className="w-full max-w-[90%]">
                            <div className="bg-content2 border border-divider px-4 py-3 rounded-lg">
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
