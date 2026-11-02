import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

function ShareImagePreview({ children, dimensions }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const updateScale = () => {
      const nextScale = Math.min(
        container.clientWidth / dimensions.width,
        container.clientHeight / dimensions.height
      );
      setScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    updateScale();
    return () => observer.disconnect();
  }, [dimensions.height, dimensions.width]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-surface-secondary/70"
    >
      <div style={{ height: dimensions.height * scale, width: dimensions.width * scale }}>
        <div
          style={{
            height: dimensions.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: dimensions.width,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

ShareImagePreview.propTypes = {
  children: PropTypes.node.isRequired,
  dimensions: PropTypes.shape({
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
  }).isRequired,
};

export default ShareImagePreview;
