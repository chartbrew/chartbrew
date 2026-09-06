import React from "react";
import PropTypes from "prop-types";
import { Button } from "@heroui/react";

import AiChartPreview from "./AiChartPreview";
import AiActionPreviewCard from "./AiActionPreviewCard";
import AiToolOperations from "./AiToolOperations";
import { AiAnswer, AiUserPrompt } from "./AiTranscript";
import { getUserMessageDisplayContent } from "./aiMessageUtils";

function AiMessageGroup({
  group,
  groupIndex,
  createdCharts,
  chartLoadErrors,
  toolDisplayNames,
  teamId,
  selectedContext,
  onChartAction,
  onSuggestionClick,
  onChangeAction,
  onConfirmAction,
  completedActionIds,
  isLoading,
}) {
  if (group.type === "user") {
    const message = group.items[0].message;
    return (
      <div className="mx-auto mb-5 w-full max-w-3xl px-4">
        <AiUserPrompt>{getUserMessageDisplayContent(message.content)}</AiUserPrompt>
      </div>
    );
  }

  if (["chart_created", "chart_updated", "chart_temporary"].includes(group.type)) {
    const { parsed } = group.items[0];
    const chartData = createdCharts.find((chart) => `${chart.id}` === `${parsed.chartId}`);
    return (
      <div className="mx-auto mb-6 w-full max-w-3xl px-4">
        <AiChartPreview
          chartData={chartData}
          isUnavailable={chartLoadErrors[parsed.chartId] === "unavailable"}
          loadError={chartLoadErrors[parsed.chartId] === "failed"}
          onChartAction={onChartAction}
          parsed={parsed}
          selectedContext={selectedContext}
          teamId={teamId}
        />
      </div>
    );
  }

  const operations = [];
  let finalMessage = null;
  let suggestions = [];
  let actionPreview = null;

  group.items.forEach(({ message, parsed }) => {
    if (parsed.type === "tool_call") {
      parsed.tools.forEach((tool) => operations.push({
        data: tool.args,
        name: tool.name,
        type: "call",
      }));
    } else if (parsed.type === "tool_result") {
      operations.push({ data: parsed.content, name: parsed.name, type: "result" });
    } else if (parsed.type === "action_preview") {
      actionPreview = parsed.action;
    } else if (parsed.type === "message_with_suggestions") {
      finalMessage = { ...message, content: parsed.content };
      suggestions = parsed.suggestions || [];
    } else if (parsed.type === "message") {
      finalMessage = { ...message, content: parsed.content };
    }
  });

  if (!finalMessage && operations.length === 0 && !actionPreview) return null;

  return (
    <article className="mx-auto mb-6 w-full max-w-3xl px-4">
      <AiAnswer
        after={(
          <>
            <AiToolOperations
              groupIndex={groupIndex}
              operations={operations}
              toolDisplayNames={toolDisplayNames}
            />
            {suggestions.length > 0 ? (
              <div className="mt-3 flex flex-row flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <Button
                    className="h-auto min-h-8 rounded-full px-3 py-1 font-normal"
                    isPending={isLoading}
                    key={suggestion.id}
                    onPress={() => onSuggestionClick(suggestion)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {suggestion.label}
                  </Button>
                ))}
              </div>
            ) : null}
            {actionPreview ? (
              <AiActionPreviewCard
                action={actionPreview}
                isApplied={completedActionIds.has(actionPreview.actionId)}
                isLoading={isLoading}
                onChange={onChangeAction}
                onConfirm={onConfirmAction}
              />
            ) : null}
          </>
        )}
        content={finalMessage?.content || "Work completed."}
        isError={finalMessage?.isError}
      />
    </article>
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
  chartLoadErrors: PropTypes.object.isRequired,
  toolDisplayNames: PropTypes.object.isRequired,
  teamId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  selectedContext: PropTypes.shape({ multiSelect: PropTypes.array }).isRequired,
  onChartAction: PropTypes.func.isRequired,
  onSuggestionClick: PropTypes.func.isRequired,
  onChangeAction: PropTypes.func.isRequired,
  onConfirmAction: PropTypes.func.isRequired,
  completedActionIds: PropTypes.instanceOf(Set).isRequired,
  isLoading: PropTypes.bool.isRequired,
};

export default AiMessageGroup;
