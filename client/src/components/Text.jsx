import React from "react";
import { tv } from "tailwind-variants";
import PropTypes from "prop-types";

const text = tv({
  base: "text-base",
  variants: {
    small: {
      true: "text-sm",
    },
    h4: {
      true: "text-lg",
    },
    h3: {
      true: "text-xl",
    },
    h2: {
      true: "text-2xl"
    },
    h1: {
      true: "text-3xl",
    },
    b: {
      true: "font-bold",
    },
    i: {
      true: "italic",
    },
    size: {
      xs: "text-xs",
      sm: "text-sm",
      md: "text-md",
      lg: "text-lg",
      xl: "text-xl",
      h5: "text-md font-bold",
      h4: "text-lg font-bold",
      h3: "text-xl font-bold",
      h2: "text-2xl font-bold",
      h1: "text-3xl font-bold",
    },
    variant: {
      b: "font-bold",
      i: "italic",
      small: "text-sm",
    },
    color: {
      primary: "text-primary",
      secondary: "text-secondary",
      success: "text-success",
      warning: "text-warning",
      danger: "text-danger",
      default: "text-foreground",
      gray: "text-default-500",
    }
  },
  defaultVariants: {
    size: "md",
    color: "default",
  }
})

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
  return (
    <span className={`${text({ size, color, h1, h2, h3, h4, small, b, variant })} ${className}`}>
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
