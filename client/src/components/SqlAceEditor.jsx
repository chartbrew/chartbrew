import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import CodeEditor from "./CodeEditor";

const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;

const findVariables = (text) => {
  const variables = [];
  const lines = text.split("\n");

  lines.forEach((line, lineIndex) => {
    let match;
    VARIABLE_REGEX.lastIndex = 0;

    while ((match = VARIABLE_REGEX.exec(line)) !== null) {
      const startColumn = match.index + 1;

      variables.push({
        row: lineIndex + 1,
        startColumn,
        endColumn: startColumn + match[0].length,
        variable: match[1].trim(),
        fullMatch: match[0],
      });
    }
  });

  return variables;
};

const isSameVariable = (first, second) => {
  if (!first || !second) {
    return false;
  }

  return (
    first.row === second.row
    && first.startColumn === second.startColumn
    && first.endColumn === second.endColumn
  );
};

/*
  Reusable SQL editor component with moustache variable highlighting
*/
function SqlAceEditor({
  value = "",
  onChange,
  onVariableClick,
  height = "300px",
  width = "none",
  theme = "tomorrow",
  mode = "pgsql",
  className = "",
  name = "sqlEditor",
  readOnly = false,
  ...otherProps
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const variableDecorationsRef = useRef([]);
  const hoverDecorationsRef = useRef([]);
  const variablesRef = useRef([]);
  const hoveredVariableRef = useRef(null);
  const [editorVersion, setEditorVersion] = useState(0);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco) {
      return undefined;
    }

    const nextVariables = findVariables(value || "");
    variablesRef.current = nextVariables;

    variableDecorationsRef.current = editor.deltaDecorations(
      variableDecorationsRef.current,
      nextVariables.map((variable) => ({
        range: new monaco.Range(
          variable.row,
          variable.startColumn,
          variable.row,
          variable.endColumn
        ),
        options: {
          inlineClassName: "cb-monaco-variable",
        },
      }))
    );

    if (
      hoveredVariableRef.current
      && !nextVariables.some((variable) => isSameVariable(variable, hoveredVariableRef.current))
    ) {
      hoveredVariableRef.current = null;
      hoverDecorationsRef.current = editor.deltaDecorations(hoverDecorationsRef.current, []);
    }

    return undefined;
  }, [value, editorVersion]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco) {
      return undefined;
    }

    const setHoveredVariable = (variable) => {
      if (isSameVariable(variable, hoveredVariableRef.current)) {
        return;
      }

      hoveredVariableRef.current = variable;

      hoverDecorationsRef.current = editor.deltaDecorations(
        hoverDecorationsRef.current,
        variable
          ? [{
            range: new monaco.Range(
              variable.row,
              variable.startColumn,
              variable.row,
              variable.endColumn
            ),
            options: {
              inlineClassName: "cb-monaco-variable-hover",
            },
          }]
          : []
      );
    };

    const getVariableAtPosition = (position) => {
      if (!position) {
        return null;
      }

      return variablesRef.current.find((variable) => (
        variable.row === position.lineNumber
        && position.column >= variable.startColumn
        && position.column < variable.endColumn
      )) || null;
    };

    const domNode = editor.getDomNode();

    const mouseMoveDisposable = editor.onMouseMove((event) => {
      const variable = getVariableAtPosition(event.target.position);

      if (domNode) {
        domNode.style.cursor = variable ? "pointer" : "";
      }

      setHoveredVariable(variable);
    });

    const mouseLeaveDisposable = editor.onMouseLeave(() => {
      if (domNode) {
        domNode.style.cursor = "";
      }

      setHoveredVariable(null);
    });

    const mouseDownDisposable = editor.onMouseDown((event) => {
      const variable = getVariableAtPosition(event.target.position);

      if (!variable || !onVariableClick) {
        return;
      }

      event.event.browserEvent.preventDefault();
      event.event.browserEvent.stopPropagation();
      onVariableClick(variable);
    });

    return () => {
      if (domNode) {
        domNode.style.cursor = "";
      }

      mouseMoveDisposable.dispose();
      mouseLeaveDisposable.dispose();
      mouseDownDisposable.dispose();
    };
  }, [onVariableClick, editorVersion]);

  useEffect(() => () => {
    const editor = editorRef.current;

    if (editor) {
      editor.deltaDecorations(variableDecorationsRef.current, []);
      editor.deltaDecorations(hoverDecorationsRef.current, []);
    }
  }, []);

  return (
    <div className="w-full">
      <CodeEditor
        mode={mode}
        theme={theme}
        height={height}
        width={width}
        value={value}
        onChange={onChange}
        onLoad={(editor, monaco) => {
          editorRef.current = editor;
          monacoRef.current = monaco;
          setEditorVersion((version) => version + 1);
        }}
        name={name}
        readOnly={readOnly}
        className={`rounded-md border-1 border-solid border-content3 ${className}`}
        {...otherProps}
      />
      <div className="text-sm mt-2 text-gray-500">
        {"You can use variables like {{variable_name}} as values"}
      </div>
    </div>
  );
}

SqlAceEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onVariableClick: PropTypes.func,
  height: PropTypes.string,
  width: PropTypes.string,
  theme: PropTypes.string,
  mode: PropTypes.string,
  className: PropTypes.string,
  name: PropTypes.string,
  readOnly: PropTypes.bool,
};

export default SqlAceEditor;
