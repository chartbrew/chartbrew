import React from "react";
import { tv } from "tailwind-variants";
import PropTypes from "prop-types";

const container = tv({
  base: "container mx-auto px-4 flex flex-col",
  variants: {
    size: {
      sm: "sm:px-6 md:px-15 lg:px-20 xl:px-30",
      md: "sm:px-4 md:px-10 lg:px-15 xl:px-20",
      lg: "sm:px-2 md:px-3 lg:px-5 xl:px-10",
      xl: "sm:px-0 md:px-1 lg:px-2 xl:px-5",
      fluid: "w-full p-0 mx-0",
    }
  },
  defaultVariants: {
    size: "md",
  },
})

function Container(props) {
  const { children, size, className } = props;
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

Container.defaultProps = {
  size: "md",
  className: "",
};

export default Container;
