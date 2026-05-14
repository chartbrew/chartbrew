import React from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents = {
  code: ({ children }) => {
    const formattedText = String(children).replace(/^`|`$/g, "");
    return formattedText;
  },
  li: ({ children, className }) => {
    if (className?.includes("task-list-item")) {
      return <li className={`${className} list-none -ml-6`}>{children}</li>;
    }
    return <li className={className}>{children}</li>;
  },
};

function AiMarkdown({ children, isError = false, compact = false }) {
  return (
    <div className={`text-sm prose prose-xs ${compact ? "md:prose-sm" : "md:prose-lg"} dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-h5:text-sm prose-h6:text-xs prose-a:text-accent prose-a:hover:text-accent-400 prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:pl-2 prose-blockquote:italic prose-strong:font-bold prose-em:italic prose-pre:bg-content2 prose-pre:text-foreground prose-pre:p-2 prose-pre:rounded-sm prose-img:rounded-sm prose-img:mx-auto max-w-none p-1 leading-tight [&>p]:mb-4 *:my-2 ${isError ? "text-danger" : "text-foreground"}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

AiMarkdown.propTypes = {
  children: PropTypes.string,
  isError: PropTypes.bool,
  compact: PropTypes.bool,
};

export default AiMarkdown;
