import React from "react";
import PropTypes from "prop-types";
import "./PixelLoader.css";

const variants = {
  orbit: { palette: "warm", phases: [0, 7, 6, 1, 0, 5, 2, 3, 4] },
  comet: { palette: "blue", phases: [0, 7, 6, 1, 0, 5, 2, 3, 4] },
  twin: { palette: "orange", phases: [0, 6, 4, 2, 0, 2, 4, 6, 0] },
  columns: { palette: "blue", phases: [0, 3, 6, 1, 4, 7, 2, 5, 8] },
  bars: { palette: "orange", phases: [0, 3, 6, 1, 4, 7, 2, 5, 8] },
  heat: { palette: "warm", phases: [1, 6, 3, 8, 0, 5, 4, 7, 2] },
  ripple: { palette: "blue", phases: [4, 6, 4, 6, 0, 6, 4, 6, 4] },
  diagonal: { palette: "orange", phases: [0, 6, 4, 6, 4, 2, 4, 2, 0] },
};

function PixelLoader({ variant = "orbit", size = 16 }) {
  const { palette, phases } = variants[variant];

  return (
    <svg className={`pixel-loader pixel-loader-${variant}`} data-palette={palette} viewBox="0 0 30 30" width={size} height={size} aria-hidden="true">
      {phases.map((phase, index) => (
        <rect
          key={index}
          x={(index % 3) * 10}
          y={Math.floor(index / 3) * 10}
          width="10"
          height="10"
          style={{ "--phase": phase, "--column": index % 3, "--row": Math.floor(index / 3) }}
        />
      ))}
    </svg>
  );
}

PixelLoader.propTypes = {
  variant: PropTypes.oneOf(Object.keys(variants)),
  size: PropTypes.number,
};

export default PixelLoader;
