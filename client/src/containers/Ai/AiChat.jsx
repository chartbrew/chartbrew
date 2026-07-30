import React from "react";
import PropTypes from "prop-types";
import { Button, Card } from "@heroui/react";
import { LuBookmark, LuLoader } from "react-icons/lu";

import AiComposer from "./AiComposer";
import AiMarkdown from "./AiMarkdown";

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
        <div aria-live="polite" className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto">
          {messages.map((message, index) => (
            <div
              className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              key={`${message.role}-${index}`}
            >
              <Card
                className="max-w-[90%] gap-0 border border-divider p-3 shadow-none"
                variant={message.role === "user" ? "secondary" : "default"}
              >
                <Card.Content>
                  {message.role === "assistant" ? (
                    <AiMarkdown isError={message.isError}>{message.content}</AiMarkdown>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  )}
                </Card.Content>
              </Card>
            </div>
          ))}
          {isLoading ? (
            <div className="flex items-center gap-2 px-2 text-sm text-foreground-500">
              <LuLoader className="animate-spin" aria-hidden />
              Looking through your data…
            </div>
          ) : null}
        </div>
      ) : null}

      <AiComposer
        id={id}
        isLoading={isLoading}
        name={`${id}-question`}
        onSubmitQuestion={onSubmit}
        placeholder={placeholder}
        selectedContext={EMPTY_CONTEXT}
        suggestions={suggestions}
      />

      {showSave ? (
        <div className="flex justify-end">
          <Button onPress={onSave} size="sm" variant="tertiary">
            <LuBookmark aria-hidden />
            Save conversation
          </Button>
        </div>
      ) : null}
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
