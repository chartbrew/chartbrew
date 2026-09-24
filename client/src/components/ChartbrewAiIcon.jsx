import React from "react";
import PropTypes from "prop-types";

function ChartbrewAiIcon({ size = 16, className = "", ...props }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      viewBox="0 0 28 28"
      width={size}
      {...props}
    >
      <rect x="10" y="0" width="8" height="8" fill="#048bde" opacity="0.45" />
      <rect x="0" y="10" width="8" height="8" fill="#048bde" />
      <rect x="10" y="10" width="8" height="8" fill="#f17041" />
      <rect x="20" y="10" width="8" height="8" fill="#048bde" />
      <rect x="10" y="20" width="8" height="8" fill="#048bde" opacity="0.45" />
    </svg>
  );
}

ChartbrewAiIcon.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};

export default ChartbrewAiIcon;
