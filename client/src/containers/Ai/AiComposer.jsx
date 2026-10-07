import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Button, Chip, InputGroup, Kbd, Label, ScrollShadow, TextField, Tooltip,
} from "@heroui/react";
import { LuArrowUp } from "react-icons/lu";
import { keepSuggestionOrder } from "./homeSuggestionState";
import PixelLoader from "../../components/PixelLoader";

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
  onSelectSuggestion,
  scrollSuggestions = false,
  showEnterHint = false,
  rows = 4,
  framed = false,
  fill = false,
  value,
  onValueChange,
  submitLabel = "Send question",
}) {
  const [localQuestion, setLocalQuestion] = useState("");
  const draftQuestion = value ?? localQuestion;
  const setDraftQuestion = onValueChange || setLocalQuestion;
  const fallbackRef = useRef(null);
  const composerRef = inputRef || fallbackRef;
  const [visibleSuggestions, setVisibleSuggestions] = useState(suggestions);
  const [selectingSuggestion, setSelectingSuggestion] = useState(false);
  const suggestionRow = useRef(null);
  const suggestionVersion = JSON.stringify(suggestions);
  useEffect(() => {
    setVisibleSuggestions((previous) => keepSuggestionOrder(previous, JSON.parse(suggestionVersion),
      Boolean(draftQuestion) || Boolean(suggestionRow.current?.contains(document.activeElement))));
  }, [suggestionVersion, draftQuestion]);
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
      <Tooltip.Trigger render={(triggerProps) => (
        <Button {...triggerProps}
          aria-label={submitLabel}
          aria-busy={isLoading}
          className="rounded-full"
          isDisabled={!hasContent || isLoading}
          isIconOnly
          size="sm"
          type="submit"
          variant="primary"
        >
          {isLoading ? <PixelLoader variant="ripple" size={17} /> : <LuArrowUp size={17} aria-hidden />}
        </Button>
      )} />
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

  const fillSuggestion = async (suggestion) => {
    if (selectingSuggestion) return;
    setSelectingSuggestion(true);
    try {
      if (onSelectSuggestion && await onSelectSuggestion(suggestion) === false) return;
      setDraftQuestion(typeof suggestion === "string" ? suggestion : suggestion.prompt);
      composerRef.current?.focus();
    } finally {
      setSelectingSuggestion(false);
    }
  };

  const suggestionButtons = visibleSuggestions.length > 0 ? (
    <div ref={suggestionRow} className={`flex flex-row items-center ${scrollSuggestions ? "w-max flex-nowrap p-1" : "flex-wrap"} ${framed ? "gap-2" : "gap-1.5"}`}>
      {visibleSuggestions.map((suggestion) => (
        framed ? (
          <Button
            key={suggestion.id || suggestion}
            className={`h-auto min-h-8 max-w-full rounded-full border border-divider bg-surface px-3 py-1 text-left font-normal text-foreground shadow-none ${scrollSuggestions ? "shrink-0 whitespace-nowrap" : "whitespace-normal"}`}
            isDisabled={selectingSuggestion || isLoading}
            onPress={() => fillSuggestion(suggestion)}
            size="sm"
            type="button"
            variant="outline"
          >
            {suggestion.title || suggestion}
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
  const suggestionChips = scrollSuggestions && suggestionButtons ? (
    <ScrollShadow className="min-w-0 w-full" orientation="horizontal" hideScrollBar>
      {suggestionButtons}
    </ScrollShadow>
  ) : suggestionButtons;

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
        className={fill ? "flex h-full min-h-0 w-full flex-col" : "flex w-full flex-col border border-divider rounded-3xl"}
        fullWidth
        isDisabled={isLoading}
        name={name}
      >
        <Label className="sr-only">{placeholder}</Label>
        <InputGroup
          className={framed
            ? `relative flex flex-col items-stretch gap-2 overflow-visible border-transparent bg-surface py-2 shadow-none${fill ? " h-full" : ""}`
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
      ? "flex h-full min-h-0 flex-1 flex-col rounded-3xl bg-surface-secondary p-3 border border-divider"
      : "rounded-3xl bg-surface-secondary p-3"}
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
  suggestions: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
  onSelectSuggestion: PropTypes.func,
  scrollSuggestions: PropTypes.bool,
  showEnterHint: PropTypes.bool,
  rows: PropTypes.number,
  framed: PropTypes.bool,
  fill: PropTypes.bool,
  value: PropTypes.string,
  onValueChange: PropTypes.func,
  submitLabel: PropTypes.string,
};

export default AiComposer;
