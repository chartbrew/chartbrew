import React from "react";
import PropTypes from "prop-types";

function Text(props) {
  const {
    children,
    size = "md",
    color = "default",
    h1 = false,
    h2 = false,
    h3 = false,
    h4 = false,
    small = false,
    b = false,
    variant = "",
    className = "",
  } = props;
  const sizeClass = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-xl",
    h5: "text-base font-bold",
    h4: "text-lg font-bold",
    h3: "text-xl font-bold",
    h2: "text-2xl font-bold",
    h1: "text-3xl font-bold",
  }[size] || "text-base";
  const colorClass = {
    primary: "text-accent",
    secondary: "text-secondary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    default: "text-foreground",
    gray: "text-default-500",
  }[color] || "text-foreground";

  return (
    <span
      className={`${sizeClass} ${colorClass} ${h1 ? "text-3xl" : ""} ${h2 ? "text-2xl" : ""} ${h3 ? "text-xl" : ""} ${h4 ? "text-lg" : ""} ${small ? "text-sm" : ""} ${b || variant === "b" ? "font-bold" : ""} ${variant === "i" ? "italic" : ""} ${variant === "small" ? "text-sm" : ""} ${className}`}
    >
      {children}
    </span>
  );
}

Text.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl", "h5", "h4", "h3", "h2", "h1"]),
  color: PropTypes.oneOf(["primary", "secondary", "success", "warning", "error", "default", "gray"]),
  h1: PropTypes.bool,
  h2: PropTypes.bool,
  h3: PropTypes.bool,
  h4: PropTypes.bool,
  small: PropTypes.bool,
  b: PropTypes.bool,
  className: PropTypes.string,
  variant: PropTypes.oneOf(["", "b", "i", "small"]),
};

export default Text
