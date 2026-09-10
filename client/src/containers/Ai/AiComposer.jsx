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
  status,
  suggestions = [],
  showEnterHint = false,
  rows = 4,
  framed = false,
  fill = false,
}) {
  const [draftQuestion, setDraftQuestion] = useState("");
  const fallbackRef = useRef(null);
  const composerRef = inputRef || fallbackRef;
  const hasContent = draftQuestion.trim()
    || selectedContext.multiSelect.length > 0
    || selectedContext.singleSelect;

  const submit = () => {
    if (!hasContent || isLoading) return;
    const submittedQuestion = draftQuestion;
    const accepted = onSubmitQuestion(submittedQuestion);
    if (accepted !== false) setDraftQuestion("");
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
            variant="outline"
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

      <div className={fill ? "min-h-0 flex-1" : undefined}>
      <TextField
        aria-label={placeholder}
        className={fill ? "flex h-full min-h-0 w-full flex-col" : "flex w-full flex-col border border-divider rounded-3xl"}
        fullWidth
        isDisabled={isLoading}
        name={name}
      >
        <Label className="sr-only">{placeholder}</Label>
        <InputGroup
          className={framed
            ? `relative flex flex-col items-stretch gap-2 overflow-visible rounded-[1.25rem] border-transparent bg-surface py-2 shadow-none${fill ? " h-full" : ""}`
            : "flex flex-col gap-2 rounded-3xl py-2"}
          fullWidth
          variant={framed ? "secondary" : "primary"}
        >
          {leadingContent ? (
            <div className="flex w-full shrink-0 flex-col items-start gap-2 px-3 pt-1">
              {leadingContent}
            </div>
          ) : null}
          <InputGroup.TextArea
            className={framed
              ? `w-full resize-none px-3.5 py-0${fill ? " min-h-0 flex-1" : ""}`
              : "w-full resize-none px-3.5 py-0"}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            ref={composerRef}
            rows={fill ? 8 : rows}
            value={draftQuestion}
          />
          <div className="flex w-full shrink-0 items-center gap-2 px-3 py-0">
            {leadingControl}
            <div className="ms-auto flex items-center gap-1.5">
              {status}
              {sendButton}
            </div>
          </div>
        </InputGroup>
      </TextField>
      </div>

      {framed && suggestionChips}
    </form>
  );

  if (!framed) return form;

  return (
    <div className={fill
      ? "flex h-full min-h-0 flex-1 flex-col rounded-[2rem] bg-surface-secondary p-3 border border-divider"
      : "rounded-[2rem] bg-surface-secondary p-3"}
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
  status: PropTypes.node,
  suggestions: PropTypes.arrayOf(PropTypes.string),
  showEnterHint: PropTypes.bool,
  rows: PropTypes.number,
  framed: PropTypes.bool,
  fill: PropTypes.bool,
};

export default AiComposer;
