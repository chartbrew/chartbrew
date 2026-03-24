import React from "react";
import PropTypes from "prop-types";

function Row(props) {
  const {
    children,
    align = "start",
    justify = "start",
    content = "start",
    wrap = "none",
    className = ""
  } = props;
  const alignClass = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
    baseline: "items-baseline",
  }[align] || "items-start";
  const justifyClass = {
    "flex-start": "justify-start",
    center: "justify-center",
    "flex-end": "justify-end",
    "flex-between": "justify-between",
    "flex-around": "justify-around",
    "flex-evenly": "justify-evenly",
    start: "justify-start",
    end: "justify-end",
    "space-between": "justify-between",
    "space-around": "justify-around",
    "space-evenly": "justify-evenly",
  }[justify] || "justify-start";
  const contentClass = {
    start: "content-start",
    center: "content-center",
    end: "content-end",
    between: "content-between",
    around: "content-around",
    evenly: "content-evenly",
    stretch: "content-stretch",
  }[content] || "content-start";
  const wrapClass = {
    none: "flex-nowrap",
    reverse: "flex-wrap-reverse",
    wrap: "flex-wrap",
  }[wrap] || "flex-nowrap";

  return (
    <div className={`flex flex-row ${alignClass} ${justifyClass} ${contentClass} ${wrapClass} ${className}`}>
      {children}
    </div>
  )
}

Row.propTypes = {
  children: PropTypes.node.isRequired,
  align: PropTypes.oneOf(["start", "center", "end", "stretch", "baseline"]),
  justify: PropTypes.oneOf(["flex-start", "center", "flex-end", "flex-between", "flex-around", "flex-evenly", "start", "end", "space-between", "space-around", "space-evenly"]),
  content: PropTypes.oneOf(["start", "center", "end", "between", "around", "evenly", "stretch"]),
  wrap: PropTypes.oneOf(["none", "reverse", "wrap"]),
  className: PropTypes.string,
};

export default Row
