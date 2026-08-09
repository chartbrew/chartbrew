import React from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function getNodeText(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (React.isValidElement(node)) return getNodeText(node.props.children);
  return "";
}

const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-5 text-xl font-semibold text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 text-lg font-semibold text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-base font-semibold text-foreground first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1.5 mt-4 text-sm font-semibold text-foreground first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mb-1.5 mt-3 text-sm font-semibold text-foreground first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mb-1.5 mt-3 text-sm font-medium text-foreground first:mt-0">{children}</h6>
  ),
  p: ({ children }) => (
    <p className="my-3 leading-6 first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-5 marker:text-foreground-400 first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-5 marker:text-foreground-400 first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children, className }) => {
    if (className?.includes("task-list-item")) {
      return <li className="list-none -ml-5">{children}</li>;
    }
    return <li className="pl-0.5 leading-6">{children}</li>;
  },
  a: ({ href, children }) => (
    <a className="text-accent no-underline hover:underline" href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-divider pl-3 text-muted">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  hr: () => <hr className="my-4 border-divider" />,
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl bg-content2 p-3 text-foreground">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className) || getNodeText(children).includes("\n");
    if (isBlock) {
      return <code className={`${className || ""} text-[0.9em]`.trim()}>{children}</code>;
    }
    return (
      <code className="rounded bg-content2 px-1 py-0.5 text-[0.9em] text-foreground">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-divider px-2 py-1.5 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-divider px-2 py-1.5 align-top">{children}</td>
  ),
};

function AiMarkdown({ children, isError = false, compact = false }) {
  return (
    <div className={`max-w-none text-sm leading-6 ${compact ? "[&_p]:my-2" : ""} ${isError ? "text-danger" : "text-foreground"}`}>
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
