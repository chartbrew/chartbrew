import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button, Chip, InputGroup, Kbd, Label, TextField } from "@heroui/react";
import { LuArrowRight } from "react-icons/lu";

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
}) {
  const [draftQuestion, setDraftQuestion] = useState("");
  const hasContent = draftQuestion.trim() || selectedContext.multiSelect.length > 0 || selectedContext.singleSelect;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasContent || isLoading) return;

    const submittedQuestion = draftQuestion;
    setDraftQuestion("");
    onSubmitQuestion(submittedQuestion);
  };

  return (
    <form onSubmit={handleSubmit} id={id}>
      {leadingContent}
      <div className="flex flex-row gap-2 items-center">
        {leadingControl}
        <TextField
          fullWidth
          className="min-w-0 flex-1"
          name={name}
          aria-label={placeholder}
          isDisabled={isLoading}
        >
          <Label className="sr-only">{placeholder}</Label>
          <InputGroup fullWidth>
            <InputGroup.Input
              ref={inputRef}
              placeholder={placeholder}
              value={draftQuestion}
              onChange={(e) => {
                const value = e.target.value;
                setDraftQuestion(value);
                if (value.endsWith("@")) {
                  onAtTyped?.();
                }
              }}
            />
            {showEnterHint && (
              <InputGroup.Suffix className="pr-2">
                <Kbd>
                  <Kbd.Abbr keyValue="enter" />
                </Kbd>
              </InputGroup.Suffix>
            )}
          </InputGroup>
        </TextField>
        <Button
          type="submit"
          isIconOnly
          isDisabled={!hasContent}
          variant="primary"
          isPending={isLoading}
          size={showEnterHint ? undefined : "sm"}
          aria-label="Submit question"
        >
          <LuArrowRight size={showEnterHint ? undefined : 18} />
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-row items-center gap-1 flex-wrap mt-2">
          {suggestions.map((suggestion) => (
            <Chip
              key={suggestion}
              variant="soft"
              size="sm"
              onClick={() => setDraftQuestion(suggestion)}
              className="cursor-pointer"
            >
              {suggestion}
            </Chip>
          ))}
        </div>
      )}
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
};

export default AiComposer;
