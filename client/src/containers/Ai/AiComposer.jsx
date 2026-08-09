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

  return (
    <form className="flex w-full flex-col gap-2" id={id} onSubmit={handleSubmit}>
      {suggestions.length > 0 ? (
        <div className="flex flex-row flex-wrap items-center gap-1.5">
          {suggestions.map((suggestion) => (
            <Chip
              className="cursor-pointer"
              key={suggestion}
              onClick={() => {
                setDraftQuestion(suggestion);
                composerRef.current?.focus();
              }}
              size="sm"
              variant="soft"
            >
              {suggestion}
            </Chip>
          ))}
        </div>
      ) : null}

      {isInline && leadingContent ? leadingContent : null}

      <TextField
        aria-label={placeholder}
        className="flex w-full flex-col"
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
            className="flex flex-col gap-2 rounded-3xl py-2"
            fullWidth
          >
            {leadingContent || leadingControl ? (
              <InputGroup.Prefix className="flex w-full flex-col items-start gap-2 px-3 py-0">
                {leadingControl}
                {leadingContent}
              </InputGroup.Prefix>
            ) : null}
            <InputGroup.TextArea
              className="w-full resize-none px-3.5 py-0"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              ref={composerRef}
              rows={rows}
              value={draftQuestion}
            />
            <InputGroup.Suffix className="flex w-full items-center gap-2 px-3 py-0">
              <div className="ms-auto">
                {sendButton}
              </div>
            </InputGroup.Suffix>
          </InputGroup>
        )}
      </TextField>
    </form>
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
};

export default AiComposer;
