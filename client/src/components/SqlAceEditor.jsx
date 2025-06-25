import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/mode-json";
import "ace-builds/src-min-noconflict/mode-pgsql";
import "ace-builds/src-min-noconflict/theme-tomorrow";
import "ace-builds/src-min-noconflict/theme-one_dark";

// Custom hook for moustache variable highlighting and events
const useMoustacheVariables = (editor, onVariableClick) => {
  const hoverMarkerRef = useRef(null);
  const variableMarkersRef = useRef(new Set());
  const [highlightedVariable, setHighlightedVariable] = useState(null);
  const updateTimeoutRef = useRef(null);

  const backgroundColor = "rgba(4, 139, 222, 0.1)";
  const borderColor = "rgba(4, 139, 222, 0.6)";
  const hoverBackgroundColor = "rgba(4, 139, 222, 0.2)";
  const hoverBorderColor = "rgba(4, 139, 222, 0.8)";

  useEffect(() => {
    if (!editor) return;

    // Define custom CSS styles for moustache variables
    const styleId = `ace-variable-styles-${Math.random().toString(36).substring(2, 9)}`;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .ace_variable_highlight {
        position: absolute;
        background-color: ${backgroundColor};
        border: 1px solid ${borderColor};
        border-radius: 3px;
        cursor: pointer;
        z-index: 4;
      }
      .ace_variable_hover {
        position: absolute;
        background-color: ${hoverBackgroundColor} !important;
        border: 1px solid ${hoverBorderColor} !important;
        border-radius: 3px;
        cursor: pointer;
        z-index: 5;
      }
    `;
    document.head.appendChild(style);

    const session = editor.getSession();

    // Function to find moustache variables in a line
    const findVariablesInLine = (line, rowIndex) => {
      const variables = [];
      const regex = /\{\{([^}]+)\}\}/g;
      let match;
      
      while ((match = regex.exec(line)) !== null) {
        variables.push({
          row: rowIndex,
          startColumn: match.index,
          endColumn: match.index + match[0].length,
          variable: match[1].trim(),
          fullMatch: match[0]
        });
      }
      return variables;
    };

    // Function to clear all variable markers
    const clearAllVariableMarkers = () => {
      // Clear tracked markers
      variableMarkersRef.current.forEach(markerId => {
        try {
          session.removeMarker(markerId);
        } catch (e) {
          // Marker might already be removed
        }
      });
      variableMarkersRef.current.clear();

      // Also clear any orphaned markers by checking all markers
      const allMarkers = session.getMarkers();
      Object.keys(allMarkers).forEach(markerId => {
        const marker = allMarkers[markerId];
        if (marker.clazz && marker.clazz.includes("ace_variable_highlight")) {
          try {
            session.removeMarker(parseInt(markerId));
          } catch (e) {
            // Marker might already be removed
          }
        }
      });
    };

    // Function to add permanent markers for all moustache variables
    const addVariableMarkers = () => {
      // Clear existing markers first
      clearAllVariableMarkers();
      
      const doc = session.getDocument();
      const lines = doc.getAllLines();
      
      lines.forEach((line, rowIndex) => {
        const variables = findVariablesInLine(line, rowIndex);
        variables.forEach(variable => {
          try {
            // Create range using editor's built-in Range constructor
            const Range = editor.getSelectionRange().constructor;
            const range = new Range(
              variable.row,
              variable.startColumn,
              variable.row,
              variable.endColumn
            );
            
            const markerId = session.addMarker(range, "ace_variable_highlight", "text", true);
            variableMarkersRef.current.add(markerId);
          } catch (e) {
            console.warn("Failed to add variable marker:", e);
          }
        });
      });
    };

    // Function to find variable at cursor position
    const findVariableAtPosition = (row, column) => {
      // First check if the row is valid
      if (row < 0 || row >= session.getLength()) {
        return null;
      }
      
      const line = session.getLine(row);
      if (!line) {
        return null;
      }
      
      const variables = findVariablesInLine(line, row);
      
      return variables.find(variable => 
        variable.row === row && 
        column >= variable.startColumn && 
        column < variable.endColumn  // Changed <= to < for exclusive end boundary
      );
    };

    // Clear hover marker
    const clearHoverMarker = () => {
      if (hoverMarkerRef.current) {
        try {
          session.removeMarker(hoverMarkerRef.current);
        } catch (e) {
          // Marker might already be removed
        }
        hoverMarkerRef.current = null;
      }
    };

    // Mouse move handler for hover effects
    const onMouseMove = (event) => {
      try {
        const position = editor.renderer.screenToTextCoordinates(event.clientX, event.clientY);
        
        // Ensure position is valid
        if (position.row < 0 || position.column < 0) {
          if (highlightedVariable) {
            clearHoverMarker();
            setHighlightedVariable(null);
            editor.renderer.setCursorStyle("");
          }
          return;
        }
        
        const variable = findVariableAtPosition(position.row, position.column);
        
        if (variable) {
          // Only update if it's a different variable
          if (!highlightedVariable || 
              highlightedVariable.row !== variable.row || 
              highlightedVariable.startColumn !== variable.startColumn) {
            
            // Clear previous hover marker
            clearHoverMarker();
            
            try {
              // Add new hover marker
              const Range = editor.getSelectionRange().constructor;
              const range = new Range(
                variable.row,
                variable.startColumn,
                variable.row,
                variable.endColumn
              );
              
              hoverMarkerRef.current = session.addMarker(range, "ace_variable_hover", "text", true);
              setHighlightedVariable(variable);
              editor.renderer.setCursorStyle("pointer");
            } catch (e) {
              console.warn("Failed to add hover marker:", e);
            }
          }
        } else if (highlightedVariable) {
          // Remove hover marker when not over a variable
          clearHoverMarker();
          setHighlightedVariable(null);
          editor.renderer.setCursorStyle("");
        }
      } catch (e) {
        // Handle any coordinate conversion errors
        if (highlightedVariable) {
          clearHoverMarker();
          setHighlightedVariable(null);
          editor.renderer.setCursorStyle("");
        }
      }
    };

    // Click handler for variables
    const onClick = (event) => {
      if (highlightedVariable && onVariableClick) {
        event.preventDefault();
        event.stopPropagation();
        onVariableClick(highlightedVariable);
      }
    };

    // Debounced document change handler to update markers
    const onDocumentChange = () => {
      // Clear any pending update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Clear hover marker on document change
      clearHoverMarker();
      setHighlightedVariable(null);
      editor.renderer.setCursorStyle("");
      
      // Debounce the marker update to prevent rapid updates
      updateTimeoutRef.current = setTimeout(() => {
        addVariableMarkers();
      }, 100);
    };

    // Add initial markers
    addVariableMarkers();

    // Add event listeners
    const container = editor.container;
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("click", onClick);
    session.on("change", onDocumentChange);

    // Cleanup function
    return () => {
      // Clear timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Remove event listeners
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("click", onClick);
      session.off("change", onDocumentChange);
      
      // Clear all markers
      clearHoverMarker();
      clearAllVariableMarkers();
      
      // Remove style element
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, [editor, onVariableClick, highlightedVariable]);
};

/*
  Reusable SQL AceEditor component with moustache variable highlighting
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
  const [editorInstance, setEditorInstance] = useState(null);

  // Use the custom hook for moustache variable highlighting
  useMoustacheVariables(editorInstance, onVariableClick);

  return (
    <div className="w-full">
      <AceEditor
        mode={mode}
        theme={theme}
        style={{ borderRadius: 10 }}
        height={height}
        width={width}
        value={value}
        onChange={onChange}
        onLoad={(editor) => {
          setEditorInstance(editor);
        }}
        name={name}
        readOnly={readOnly}
        editorProps={{ $blockScrolling: true }}
        className={`rounded-md border-1 border-solid border-content3 ${className}`}
        {...otherProps}
      />
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
