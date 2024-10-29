import React from "react";
import { tv } from "tailwind-variants";
import PropTypes from "prop-types";

const container = tv({
  base: "container mx-auto flex flex-col",
})

function Container(props) {
  const { children, size = "md", className = "" } = props;
  return (
    <div className={`${container({ size })} ${className}`}>
      {children}
    </div>
  )
}

Container.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl", "fluid"]),
  className: PropTypes.string,
};

export default Container;
