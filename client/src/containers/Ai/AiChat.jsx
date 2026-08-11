import React from "react";
import PropTypes from "prop-types";
import { Button } from "@heroui/react";
import { LuBookmark } from "react-icons/lu";

import AiComposer from "./AiComposer";
import { AiAnswer, AiLoadingActivity, AiUserPrompt } from "./AiTranscript";
import { parseAiMessage } from "./aiMessageUtils";

const EMPTY_CONTEXT = {
  multiSelect: [],
  singleSelect: null,
};

function AiChat({
  id,
  isLoading,
  messages,
  onSave,
  onSubmit,
  placeholder = "Ask a question about your data",
  showSave = false,
  suggestions = [],
}) {
  return (
    <div className="flex flex-col gap-3">
      {messages.length > 0 ? (
        <div aria-live="polite" className="max-h-[34rem] overflow-y-auto pr-1">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            {messages.map((message, index) => {
              if (message.role === "user") {
                return (
                  <AiUserPrompt key={`${message.role}-${index}`}>{message.content}</AiUserPrompt>
                );
              }
              const parsed = parseAiMessage(message);
              return (
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
                  after={parsed.type === "message_with_suggestions" ? (
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
                  ) : null}
                  content={parsed.content || "I need a little more information to answer that."}
                  isError={message.isError}
                  key={`${message.role}-${index}`}
                />
              );
            })}
            {isLoading ? (
              <AiLoadingActivity />
            ) : null}
          </div>
        </div>
      ) : null}

      <AiComposer
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
  );
}

AiChat.propTypes = {
  id: PropTypes.string.isRequired,
  isLoading: PropTypes.bool.isRequired,
  messages: PropTypes.arrayOf(PropTypes.shape({
    content: PropTypes.string,
    isError: PropTypes.bool,
    role: PropTypes.string,
  })).isRequired,
  onSave: PropTypes.func,
  onSubmit: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  showSave: PropTypes.bool,
  suggestions: PropTypes.arrayOf(PropTypes.string),
};

export default AiChat;
