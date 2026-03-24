import React from "react";
import PropTypes from "prop-types";
import { Surface } from "@heroui/react";

function Container(props) {
  const { children, className = "" } = props;
  return (
    <Surface className={`container mx-auto flex flex-col ${className}`}>
      {children}
    </Surface>
  )
}

Container.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

export default Container;
