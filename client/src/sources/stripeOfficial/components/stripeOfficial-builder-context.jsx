import React, { createContext, useContext } from "react";
import PropTypes from "prop-types";

const StripeOfficialBuilderContext = createContext(null);

export function StripeOfficialBuilderProvider({ value, children }) {
  return (
    <StripeOfficialBuilderContext.Provider value={value}>
      {children}
    </StripeOfficialBuilderContext.Provider>
  );
}

StripeOfficialBuilderProvider.propTypes = {
  value: PropTypes.object.isRequired,
  children: PropTypes.node.isRequired,
};

export function useStripeOfficialBuilder() {
  const context = useContext(StripeOfficialBuilderContext);
  if (!context) {
    throw new Error("useStripeOfficialBuilder must be used inside StripeOfficialBuilderProvider");
  }
  return context;
}
