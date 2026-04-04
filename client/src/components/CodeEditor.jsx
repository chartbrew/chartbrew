import React, { Suspense, lazy } from "react";
import PropTypes from "prop-types";
import { Skeleton } from "@heroui/react";

const MODE_MAP = {
  css: "css",
  javascript: "javascript",
  json: "json",
  pgsql: "sql",
  sql: "sql",
};

const THEME_MAP = {
  one_dark: "chartbrew-dark",
  tomorrow: "chartbrew-light",
};

const MonacoEditor = lazy(async () => {
  const [{ default: Editor }, { ensureMonacoThemes }] = await Promise.all([
    import("@monaco-editor/react"),
    import("../modules/monacoLoader"),
  ]);

  function MonacoEditorInner(props) {
    return <Editor beforeMount={ensureMonacoThemes} {...props} />;
  }

  return { default: MonacoEditorInner };
});

function CodeEditor({
  value = "",
  onChange,
  onLoad,
  height = "500px",
  width = "none",
  mode = "json",
  theme = "tomorrow",
  className = "",
  style,
  readOnly = false,
  options,
  editorProps,
  ...otherProps
}) {
  void editorProps;

  const resolvedMode = MODE_MAP[mode] || "plaintext";
  const resolvedTheme = THEME_MAP[theme] || theme || "chartbrew-light";
  const resolvedWidth = width === "none" ? "100%" : width;

  return (
    <div
      className={`cb-code-editor overflow-hidden ${className}`}
      style={{
        width: resolvedWidth,
        height,
        borderRadius: 10,
        ...style,
      }}
    >
      <Suspense
        fallback={(
          <div className="flex h-full w-full flex-col gap-3 p-4">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-11/12 rounded-md" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
            <Skeleton className="mt-2 h-full min-h-0 w-full rounded-lg" />
          </div>
        )}
      >
        <MonacoEditor
          defaultLanguage={resolvedMode}
          language={resolvedMode}
          theme={resolvedTheme}
          value={value}
          height="100%"
          width="100%"
          onChange={(nextValue) => onChange?.(nextValue ?? "")}
          onMount={(editor, monaco) => {
            onLoad?.(editor, monaco);
          }}
          options={{
            automaticLayout: true,
            contextmenu: !readOnly,
            fontSize: 13,
            minimap: { enabled: false },
            padding: { top: 12, bottom: 12 },
            readOnly,
            roundedSelection: true,
            scrollBeyondLastLine: false,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
            },
            wordWrap: "off",
            ...options,
          }}
          {...otherProps}
        />
      </Suspense>
    </div>
  );
}

CodeEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onLoad: PropTypes.func,
  height: PropTypes.string,
  width: PropTypes.string,
  mode: PropTypes.string,
  theme: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  readOnly: PropTypes.bool,
  options: PropTypes.object,
  editorProps: PropTypes.object,
};

export default CodeEditor;
