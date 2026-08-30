import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import PropTypes from "prop-types";
import { Button, ScrollShadow } from "@heroui/react";
import { LuBookmark } from "react-icons/lu";
import { useDispatch } from "react-redux";

import { getChart } from "../../slices/chart";
import AiComposer from "./AiComposer";
import AiChartPreview from "./AiChartPreview";
import AiActionPreviewCard from "./AiActionPreviewCard";
import AiProgress from "./AiProgress";
import { AiAnswer, AiUserPrompt } from "./AiTranscript";
import { getCompletedActionIds, parseAiMessage } from "./aiMessageUtils";
import useChatAutoScroll from "./hooks/useChatAutoScroll";
import {
  getChartPreviewKey,
  setChartPreviewFailed,
  setChartPreviewLoaded,
  setChartPreviewLoading,
  shouldLoadChartPreview,
} from "./chartPreviewState";

const EMPTY_CONTEXT = {
  multiSelect: [],
  singleSelect: null,
};

function AiChat({
  id,
  isLoading,
  messages,
  onSave,
  onChangeAction,
  onConfirmAction,
  onSubmit,
  placeholder = "Ask a question about your data",
  progressEvents = [],
  showSave = false,
  suggestions = [],
  toolDisplayNames = {},
  framed = false,
  fill = false,
}) {
  const dispatch = useDispatch();
  const fetchedChartsRef = useRef(new Set());
  const [chartStates, setChartStates] = useState({});
  const completedActionIds = getCompletedActionIds(messages);
  const chartPreviews = useMemo(() => messages.flatMap((message) => (
    Array.isArray(message.chartPreviews) ? message.chartPreviews : []
  )), [messages]);
  const chartPreviewKey = chartPreviews
    .map(getChartPreviewKey)
    .join("|");
  const scrollVersion = `${messages.length}:${isLoading}:${progressEvents.length}:${chartPreviewKey}`;
  const scrollResetKey = `${id}:${messages.length === 0 ? "empty" : "active"}`;
  const { containerRef, contentRef } = useChatAutoScroll(scrollVersion, scrollResetKey);

  const loadChartPreview = useCallback(async (preview, retry = false) => {
    const key = getChartPreviewKey(preview);
    if (!shouldLoadChartPreview(fetchedChartsRef.current, preview, retry)) return;
    fetchedChartsRef.current.add(key);
    setChartStates((current) => setChartPreviewLoading(current, key));
    try {
      const chart = await dispatch(getChart({
        chart_id: preview.chartId,
        project_id: preview.projectId,
      })).unwrap();
      setChartStates((current) => setChartPreviewLoaded(current, key, chart));
    } catch (_error) {
      setChartStates((current) => setChartPreviewFailed(current, key));
    }
  }, [dispatch]);

  useEffect(() => {
    chartPreviews.forEach((preview) => loadChartPreview(preview));
  }, [chartPreviews, loadChartPreview]);

  useEffect(() => {
    if (messages.length > 0) return;
    fetchedChartsRef.current.clear();
    setChartStates({});
  }, [messages.length]);

  return (
    <div className={fill
      ? "flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3"
      : "flex min-w-0 flex-col gap-3"}
    >
      {messages.length > 0 ? (
        <ScrollShadow
          aria-live="polite"
          className="min-w-0 max-h-[34rem] pr-3 [scrollbar-gutter:stable]"
          orientation="vertical"
          ref={containerRef}
          size={28}
        >
          <div className="flex min-w-0 w-full flex-col gap-5" ref={contentRef}>
            {messages.map((message, index) => {
              if (message.role === "user") {
                return (
                  <AiUserPrompt key={`${message.role}-${index}`}>{message.content}</AiUserPrompt>
                );
              }
              const parsed = parseAiMessage(message);
              const suggestionActions = parsed.type === "message_with_suggestions" ? (
                <div className="mt-3 flex flex-row flex-wrap gap-2">
                  {parsed.suggestions.map((suggestion) => (
                    <Button
                      className="h-auto min-h-8 rounded-full px-3 py-1 font-normal"
                      isDisabled={isLoading}
                      key={suggestion.id}
                      onPress={() => onSubmit(suggestion.label)}
                      size="sm"
                      variant="secondary"
                    >
                      {suggestion.label}
                    </Button>
                  ))}
                </div>
              ) : null;
              return (
                <React.Fragment key={`${message.role}-${index}`}>
                  <AiAnswer
                    actions={showSave && index === messages.length - 1 ? (
                      <Button
                        className="h-7 min-h-7 px-2 text-xs text-muted"
                        onPress={onSave}
                        size="sm"
                        variant="ghost"
                      >
                        <LuBookmark size={13} aria-hidden />
                        Save conversation
                      </Button>
                    ) : null}
                    after={(
                      <>
                        {message.chartPreviews?.length > 0 ? null : suggestionActions}
                        {parsed.type === "message_with_action" ? (
                          <AiActionPreviewCard
                            action={parsed.action}
                            isApplied={completedActionIds.has(parsed.action.actionId)}
                            isLoading={isLoading}
                            onChange={onChangeAction}
                            onConfirm={onConfirmAction}
                          />
                        ) : null}
                      </>
                    )}
                    content={parsed.content || "I need a little more information to answer that."}
                    isError={message.isError}
                  />
                  {(message.chartPreviews || []).map((preview) => {
                    const chartState = chartStates[getChartPreviewKey(preview)] || {};
                    return (
                      <AiChartPreview
                        chartData={chartState.chart}
                        key={`${preview.chartId}-${preview.projectId}`}
                        loadError={chartState.error}
                        onRetry={() => loadChartPreview(preview, true)}
                        parsed={{
                          chartId: preview.chartId,
                          chartName: preview.chartName,
                          projectId: preview.projectId,
                          type: preview.visibility === "temporary"
                            ? "chart_temporary"
                            : "chart_created",
                          visibility: preview.visibility,
                        }}
                      />
                    );
                  })}
                  {message.chartPreviews?.length > 0 ? suggestionActions : null}
                </React.Fragment>
              );
            })}
            {isLoading || progressEvents.length > 0 ? (
              <AiProgress
                className="pl-4"
                isLoading={isLoading}
                progressEvents={progressEvents}
                toolDisplayNames={toolDisplayNames}
              />
            ) : null}
          </div>
        </ScrollShadow>
      ) : null}

      <div className={fill ? "flex min-h-0 flex-1 flex-col" : undefined}>
        <AiComposer
          fill={fill}
          framed={framed}
          id={id}
          isLoading={isLoading}
          name={`${id}-question`}
          onSubmitQuestion={onSubmit}
          placeholder={placeholder}
          selectedContext={EMPTY_CONTEXT}
          showEnterHint={messages.length > 0}
          suggestions={suggestions}
        />
      </div>
    </div>
  );
}

AiChat.propTypes = {
  id: PropTypes.string.isRequired,
  isLoading: PropTypes.bool.isRequired,
  messages: PropTypes.arrayOf(PropTypes.shape({
    chartPreviews: PropTypes.arrayOf(PropTypes.object),
    content: PropTypes.string,
    isError: PropTypes.bool,
    role: PropTypes.string,
  })).isRequired,
  onSave: PropTypes.func,
  onChangeAction: PropTypes.func.isRequired,
  onConfirmAction: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  progressEvents: PropTypes.arrayOf(PropTypes.object),
  showSave: PropTypes.bool,
  suggestions: PropTypes.arrayOf(PropTypes.string),
  toolDisplayNames: PropTypes.object,
  framed: PropTypes.bool,
  fill: PropTypes.bool,
};

export default AiChat;
