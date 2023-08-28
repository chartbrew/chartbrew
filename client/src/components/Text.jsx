import React from "react";
import { tv } from "tailwind-variants";
import PropTypes from "prop-types";

const text = tv({
  base: "text-base",
  variants: {
    small: "text-sm",
    h4: "text-lg",
    h3: "text-xl",
    h2: "text-2xl",
    h1: "text-3xl",
    b: "font-bold",
    i: "italic",
    size: {
      xs: "text-xs",
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
      xl: "text-xl",
    },
    color: {
      primary: "text-primary",
      secondary: "text-secondary",
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
      default: "text-default",
      gray: "text-gray-500",
    }
  },
  defaultVariants: {
    size: "md",
    color: "default",
  }
})

function Text(props) {
  const {
    children, size, color, h1, h2, h3, h4, small, b, className,
  } = props;
  return (
    <span className={`${text({ size, color, h1, h2, h3, h4, small, b })} ${className}`}>
      {children}
    </span>
  );
}

Text.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl"]),
  color: PropTypes.oneOf(["primary", "secondary", "success", "warning", "error", "default", "gray"]),
  h1: PropTypes.bool,
  h2: PropTypes.bool,
  h3: PropTypes.bool,
  h4: PropTypes.bool,
  small: PropTypes.bool,
  b: PropTypes.bool,
  className: PropTypes.string,
};

Text.defaultProps = {
  size: "md",
  color: "default",
  h1: false,
  h2: false,
  h3: false,
  h4: false,
  small: false,
  b: false,
  className: "",
};

export default Text
