import React from "react";
import { tv } from "tailwind-variants";
import PropTypes from "prop-types";

const segment = tv({
  base: "container flex flex-col p-4 sm:p-6 border-1 border-solid border-content3 rounded-lg",
})

function Segment(props) {
  const { children, size = "md", className = "" } = props;
  return (
    <div className={`${segment({ size })} ${className}`}>
      {children}
    </div>
  )
}

Segment.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl", "fluid"]),
  className: PropTypes.string,
};

export default Segment;
