import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Chip, InputGroup, Kbd, Label, TextField, Tooltip,
} from "@heroui/react";
import { LuArrowUp } from "react-icons/lu";

function AiComposer({
  id,
  name,
  inputRef,
  placeholder,
  isLoading,
  selectedContext,
  onSubmitQuestion,
  onAtTyped,
  leadingContent,
  leadingControl,
  suggestions = [],
  showEnterHint = false,
  rows = 4,
  layout = "stacked",
  framed = false,
  fill = false,
}) {
  const [draftQuestion, setDraftQuestion] = useState("");
  const fallbackRef = useRef(null);
  const composerRef = inputRef || fallbackRef;
  const isInline = layout === "inline";
  const hasContent = draftQuestion.trim()
    || selectedContext.multiSelect.length > 0
    || selectedContext.singleSelect;

  const submit = () => {
    if (!hasContent || isLoading) return;
    const submittedQuestion = draftQuestion;
    setDraftQuestion("");
    onSubmitQuestion(submittedQuestion);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submit();
  };

  const handleChange = (event) => {
    const value = event.target.value;
    setDraftQuestion(value);
    if (value.endsWith("@")) onAtTyped?.();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const sendButton = (
    <Tooltip delay={0}>
      <Tooltip.Trigger>
        <Button
          aria-label="Send question"
          className="rounded-full"
          isDisabled={!hasContent}
          isIconOnly
          isPending={isLoading}
          size="sm"
          type="submit"
          variant="primary"
        >
          <LuArrowUp size={17} aria-hidden />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <div className="flex items-center gap-1.5 text-xs">
          <span>Send</span>
          {showEnterHint ? (
            <Kbd className="h-4 rounded-sm px-1">
              <Kbd.Abbr keyValue="enter" />
            </Kbd>
          ) : null}
        </div>
      </Tooltip.Content>
    </Tooltip>
  );

  const fillSuggestion = (suggestion) => {
    setDraftQuestion(suggestion);
    composerRef.current?.focus();
  };

  const suggestionChips = suggestions.length > 0 ? (
    <div className={`flex flex-row flex-wrap items-center ${framed ? "gap-2" : "gap-1.5"}`}>
      {suggestions.map((suggestion) => (
        framed ? (
          <Button
            className="h-auto min-h-8 rounded-full border border-divider bg-surface px-3 py-1 font-normal text-foreground shadow-none"
            key={suggestion}
            onPress={() => fillSuggestion(suggestion)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {suggestion}
          </Button>
        ) : (
          <Chip
            className="cursor-pointer"
            key={suggestion}
            onClick={() => fillSuggestion(suggestion)}
            size="sm"
            variant="soft"
          >
            {suggestion}
          </Chip>
        )
      ))}
    </div>
  ) : null;

  const form = (
    <form
      className={framed
        ? `flex w-full flex-col gap-3${fill ? " min-h-0 flex-1" : ""}`
        : "flex w-full flex-col gap-2"}
      id={id}
      onSubmit={handleSubmit}
    >
      {!framed && suggestionChips}

      {isInline && leadingContent ? leadingContent : null}

      <div className={fill ? "min-h-0 flex-1" : undefined}>
      <TextField
        aria-label={placeholder}
        className={fill ? "flex h-full min-h-0 w-full flex-col" : "flex w-full flex-col"}
        fullWidth
        isDisabled={isLoading}
        name={name}
      >
        <Label className="sr-only">{placeholder}</Label>
        {isInline ? (
          <InputGroup className="w-full rounded-3xl shadow-none" fullWidth variant="secondary">
            {leadingControl ? (
              <InputGroup.Prefix className="shrink-0 ps-1.5 pe-0">
                {leadingControl}
              </InputGroup.Prefix>
            ) : null}
            <InputGroup.Input
              className="min-w-0 flex-1"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              ref={composerRef}
              value={draftQuestion}
            />
            <InputGroup.Suffix className="shrink-0 pe-1.5 ps-0">
              {sendButton}
            </InputGroup.Suffix>
          </InputGroup>
        ) : (
          <InputGroup
            className={framed
              ? `relative flex flex-col items-stretch gap-2 overflow-visible rounded-[1.25rem] border-transparent bg-surface py-2 shadow-none${fill ? " h-full" : ""}`
              : "flex flex-col gap-2 rounded-3xl py-2"}
            fullWidth
            variant={framed ? "secondary" : "primary"}
          >
            {leadingContent || leadingControl ? (
              <InputGroup.Prefix className="flex w-full flex-col items-start gap-2 px-3 py-0">
                {leadingControl}
                {leadingContent}
              </InputGroup.Prefix>
            ) : null}
            <InputGroup.TextArea
              className={framed
                ? `w-full resize-none px-3.5 pb-10 pt-0${fill ? " h-full min-h-0" : ""}`
                : "w-full resize-none px-3.5 py-0"}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              ref={composerRef}
              rows={fill ? 8 : rows}
              value={draftQuestion}
            />
            {framed ? (
              <div className="absolute bottom-2 right-3 z-10">
                {sendButton}
              </div>
            ) : (
              <InputGroup.Suffix className="flex w-full items-center gap-2 px-3 py-0">
                <div className="ms-auto">
                  {sendButton}
                </div>
              </InputGroup.Suffix>
            )}
          </InputGroup>
        )}
      </TextField>
      </div>

      {framed && suggestionChips}
    </form>
  );

  if (!framed || isInline) return form;

  return (
    <div className={fill
      ? "flex h-full min-h-0 flex-1 flex-col rounded-[2rem] bg-foreground/[0.055] p-3 dark:bg-foreground/[0.08]"
      : "rounded-[2rem] bg-foreground/[0.055] p-3 dark:bg-foreground/[0.08]"}
    >
      {form}
    </div>
  );
}

AiComposer.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  inputRef: PropTypes.object,
  placeholder: PropTypes.string.isRequired,
  isLoading: PropTypes.bool.isRequired,
  selectedContext: PropTypes.shape({
    multiSelect: PropTypes.array.isRequired,
    singleSelect: PropTypes.object,
  }).isRequired,
  onSubmitQuestion: PropTypes.func.isRequired,
  onAtTyped: PropTypes.func,
  leadingContent: PropTypes.node,
  leadingControl: PropTypes.node,
  suggestions: PropTypes.arrayOf(PropTypes.string),
  showEnterHint: PropTypes.bool,
  rows: PropTypes.number,
  layout: PropTypes.oneOf(["stacked", "inline"]),
  framed: PropTypes.bool,
  fill: PropTypes.bool,
};

export default AiComposer;
