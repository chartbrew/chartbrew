import React from "react";
import PropTypes from "prop-types";

function Badge({ children, type = "neutral" }) {
  const typeClass = {
    success: "bg-success/15 text-success",
    error: "bg-danger/15 text-danger",
    warning: "bg-warning/15 text-warning",
    primary: "bg-primary/15 text-accent",
    secondary: "bg-secondary/15 text-secondary",
    neutral: "bg-content3 text-default-800",
  }[type] || "bg-content3 text-default-800";

  return (
    <span className={`mx-0.5 inline-flex items-center self-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.6px] shadow-sm ${typeClass}`}>
      {children}
    </span>
  );
}

Badge.propTypes = {
  children: PropTypes.node.isRequired,
  type: PropTypes.oneOf(["success", "error", "warning", "primary", "secondary", "neutral"]),
};

export default Badge;
