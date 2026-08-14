import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@heroui/react";
import {
  LuCheck, LuCopy, LuLoader,
} from "react-icons/lu";

import AiMarkdown from "./AiMarkdown";

export function AiUserPrompt({ children }) {
  return (
    <div className="flex w-full justify-end">
      <div className="max-w-[85%] rounded-2xl bg-content2 px-4 py-3 text-sm leading-6 text-foreground">
        <p className="whitespace-pre-wrap">{children}</p>
      </div>
    </div>
  );
}

AiUserPrompt.propTypes = {
  children: PropTypes.string.isRequired,
};

export function AiAnswer({ actions, after, before, content, isError = false }) {
  const [copied, setCopied] = useState(false);

  const copyAnswer = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article>
      {before}
      <div className={isError
        ? "rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3"
        : ""}
      >
        <AiMarkdown isError={isError}>{content}</AiMarkdown>
      </div>
      {after}
      {!isError ? (
        <div className="mt-2 flex flex-row items-center gap-0.5">
          <Button
            aria-label="Copy answer"
            className="size-7 min-w-7 text-muted"
            isIconOnly
            onPress={copyAnswer}
            size="sm"
            variant="ghost"
          >
            {copied ? <LuCheck size={13} aria-hidden /> : <LuCopy size={13} aria-hidden />}
          </Button>
          {actions}
        </div>
      ) : null}
    </article>
  );
}

AiAnswer.propTypes = {
  actions: PropTypes.node,
  after: PropTypes.node,
  before: PropTypes.node,
  content: PropTypes.string.isRequired,
  isError: PropTypes.bool,
};

export function AiLoadingActivity({ children = "Working through the available data…" }) {
  return (
    <div className="flex w-full items-center gap-2 text-sm text-muted">
      <LuLoader className="animate-spin text-accent" size={15} aria-hidden />
      {children}
    </div>
  );
}

AiLoadingActivity.propTypes = {
  children: PropTypes.string,
};
