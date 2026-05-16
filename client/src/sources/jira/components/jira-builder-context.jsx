import React, { createContext, useContext } from "react";
import PropTypes from "prop-types";

const JiraBuilderContext = createContext(null);

export function JiraBuilderProvider({ value, children }) {
  return (
    <JiraBuilderContext.Provider value={value}>
      {children}
    </JiraBuilderContext.Provider>
  );
}

JiraBuilderProvider.propTypes = {
  value: PropTypes.object.isRequired,
  children: PropTypes.node.isRequired,
};

export function useJiraBuilder() {
  const context = useContext(JiraBuilderContext);
  if (!context) {
    throw new Error("useJiraBuilder must be used inside JiraBuilderProvider");
  }
  return context;
}
