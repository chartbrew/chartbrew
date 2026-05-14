import React from "react";
import PropTypes from "prop-types";
import { Avatar, Button, Chip, Popover } from "@heroui/react";
import { LuBrainCircuit, LuChevronDown } from "react-icons/lu";

import AiChartPreview from "./AiChartPreview";
import AiMarkdown from "./AiMarkdown";
import AiToolOperations from "./AiToolOperations";
import { getToolDisplayName } from "./aiMessageUtils";

function renderMessage({
  item,
  index,
  createdCharts,
  toolDisplayNames,
  onSuggestionClick,
  isLoading,
}) {
  const { message, parsed } = item;

  if (message.role === "user") {
    return (
      <div key={index} className="flex justify-end mb-4 px-4">
        <div className="max-w-[70%] bg-primary text-accent-foreground px-4 py-3 rounded-lg">
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }

  if (parsed.type === "tool_call") {
    return (
      <div key={index} className="flex justify-center mb-4 px-4">
        <div className="w-full max-w-[90%]">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Avatar
                size="sm"
                color="accent"
              >
                <Avatar.Fallback>
                  <LuBrainCircuit size={16} className="text-background" />
                </Avatar.Fallback>
              </Avatar>
              <span className="text-sm font-medium">AI is working...</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {parsed.tools.map((tool, idx) => (
                <Popover key={idx} aria-label="Tool call arguments">
                  <Popover.Trigger>
                    <Chip
                      variant="primary"
                      size="sm"
                      className="cursor-pointer"
                    >
                      {getToolDisplayName(tool.name, toolDisplayNames)}
                      <LuChevronDown size={14} />
                    </Chip>
                  </Popover.Trigger>
                  <Popover.Content placement="bottom" className="max-w-md">
                    <Popover.Dialog>
                      <div className="p-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold">{getToolDisplayName(tool.name, toolDisplayNames)}</div>
                          <code className="text-[11px] text-foreground-500">{tool.name}</code>
                        </div>
                        <code className="block rounded-md bg-default/40 p-2 text-xs text-default-700 whitespace-pre-wrap">
                          {JSON.stringify(tool.args, null, 2)}
                        </code>
                      </div>
                    </Popover.Dialog>
                  </Popover.Content>
                </Popover>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (parsed.type === "tool_result") {
    return (
      <div key={index} className="flex justify-center mb-4 px-4">
        <div className="w-full max-w-[90%]">
          <div className="bg-success-50 border border-success-200 px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Chip variant="soft" color="success" size="sm">
                {getToolDisplayName(parsed.name, toolDisplayNames)} complete
              </Chip>
            </div>
            <Popover aria-label="Tool result">
              <Popover.Trigger>
                <Button size="sm" variant="tertiary">
                  View result
                  <LuChevronDown size={14} />
                </Button>
              </Popover.Trigger>
              <Popover.Content placement="bottom" className="max-w-2xl">
                <Popover.Dialog>
                  <div className="p-2">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold">{getToolDisplayName(parsed.name, toolDisplayNames)}</div>
                      <code className="text-[11px] text-foreground-500">{parsed.name}</code>
                    </div>
                    <code className="block rounded-md bg-default/40 p-2 text-xs text-default-700 whitespace-pre-wrap">
                      {typeof parsed.content === "string" ? parsed.content : JSON.stringify(parsed.content, null, 2)}
                    </code>
                  </div>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          </div>
        </div>
      </div>
    );
  }

  if (parsed.type === "chart_created" || parsed.type === "chart_updated" || parsed.type === "chart_temporary") {
    const chartData = createdCharts.find((chart) => chart.id === parsed.chartId);
    return (
      <AiChartPreview
        key={index}
        parsed={parsed}
        chartData={chartData}
      />
    );
  }

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
                size="sm"
                color={isError ? "danger" : "accent"}
                variant="soft"
              >
                <Avatar.Fallback>
                  <LuBrainCircuit size={16} className="text-foreground" />
                </Avatar.Fallback>
              </Avatar>
              <div className="flex-1">
                {parsed.content && (
                  <AiMarkdown isError={isError} compact>
                    {parsed.content}
                  </AiMarkdown>
                )}
                {parsed.suggestions && parsed.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {parsed.suggestions.map((suggestion) => (
                      <Button
                        key={suggestion.id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-auto min-h-7 rounded-full px-3 py-1 font-normal"
                        onPress={() => onSuggestionClick(suggestion)}
                        isPending={isLoading}
                      >
                        {suggestion.label}
                      </Button>
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
                size="sm"
                color={isError ? "danger" : "accent"}
                variant="soft"
              >
                <Avatar.Fallback>
                  <LuBrainCircuit size={16} className="text-foreground" />
                </Avatar.Fallback>
              </Avatar>
              <div className="flex-1">
                <AiMarkdown isError={isError}>
                  {parsed.content}
                </AiMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function AiMessageGroup({ group, groupIndex, createdCharts, toolDisplayNames, onSuggestionClick, isLoading }) {
  if (group.type === "user" || group.type === "chart_created" || group.type === "chart_updated" || group.type === "chart_temporary") {
    return renderMessage({
      item: group.items[0],
      index: `group-${groupIndex}-${group.type}`,
      createdCharts,
      toolDisplayNames,
      onSuggestionClick,
      isLoading,
    });
  }

  const operations = [];
  let finalMessage = null;
  let suggestions = null;

  group.items.forEach(({ message, parsed }) => {
    if (parsed.type === "tool_call") {
      parsed.tools.forEach((tool) => {
        operations.push({
          type: "call",
          name: tool.name,
          data: tool.args,
        });
      });
    } else if (parsed.type === "tool_result") {
      operations.push({
        type: "result",
        name: parsed.name,
        data: parsed.content,
      });
    } else if (parsed.type === "message_with_suggestions") {
      finalMessage = {
        ...message,
        content: parsed.content,
      };
      suggestions = parsed.suggestions;
    } else if (parsed.type === "message") {
      finalMessage = {
        ...message,
        content: parsed.content,
      };
    }
  });

  return (
    <div key={`group-${groupIndex}`} className="flex justify-center mb-4 px-4">
      <div className="w-full max-w-[90%]">
        <div className="px-6 py-4">
          <div className="flex items-start gap-3">
            <Avatar
              size="sm"
              color="accent"
              variant="soft"
            >
              <Avatar.Fallback>
                <LuBrainCircuit size={16} className="text-foreground" />
              </Avatar.Fallback>
            </Avatar>
            <div className="flex-1">
              <AiToolOperations
                operations={operations}
                groupIndex={groupIndex}
                toolDisplayNames={toolDisplayNames}
              />
              {finalMessage && (
                <AiMarkdown compact>
                  {finalMessage.content}
                </AiMarkdown>
              )}
              {suggestions && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.id}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-auto min-h-7 rounded-full px-3 py-1 font-normal"
                      onPress={() => onSuggestionClick(suggestion)}
                      isPending={isLoading}
                    >
                      {suggestion.label}
                    </Button>
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

AiMessageGroup.propTypes = {
  group: PropTypes.shape({
    type: PropTypes.string.isRequired,
    items: PropTypes.arrayOf(PropTypes.shape({
      message: PropTypes.object.isRequired,
      parsed: PropTypes.object.isRequired,
    })).isRequired,
  }).isRequired,
  groupIndex: PropTypes.number.isRequired,
  createdCharts: PropTypes.arrayOf(PropTypes.object).isRequired,
  toolDisplayNames: PropTypes.object.isRequired,
  onSuggestionClick: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
};

export default AiMessageGroup;
