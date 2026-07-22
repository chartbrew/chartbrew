import React from "react";
import PropTypes from "prop-types";

function ChartPerformanceNotice({ complexity }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center" role="status">
      <div className="max-w-md">
        <p className="text-sm font-medium text-foreground">
          Chart paused to keep this dashboard responsive
        </p>
        <p className="mt-1 text-xs text-muted">
          {`${complexity.seriesCount.toLocaleString()} series and ${complexity.renderedPointCount.toLocaleString()} points exceed the safe rendering limit. Use “Show top series” in the chart editor to reduce the breakdown.`}
        </p>
      </div>
    </div>
  );
}

ChartPerformanceNotice.propTypes = {
  complexity: PropTypes.shape({
    renderedPointCount: PropTypes.number.isRequired,
    seriesCount: PropTypes.number.isRequired,
  }).isRequired,
};

export default ChartPerformanceNotice;
