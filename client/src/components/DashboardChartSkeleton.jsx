import React from "react";
import PropTypes from "prop-types";
import { Button, Skeleton } from "@heroui/react";

function DashboardChartSkeleton({ height }) {
  const skeletonHeight = Math.max(height || 150, 150);

  return (
    <div
      className="h-full rounded-2xl border border-solid border-divider bg-surface shadow-none"
      role="status"
      aria-label="Loading chart"
      style={{ minHeight: skeletonHeight }}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-40 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-24 rounded-lg" />
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <Skeleton
          className="w-full rounded-xl"
          style={{ height: Math.max(skeletonHeight - 88, 96) }}
        />
      </div>
    </div>
  );
}

DashboardChartSkeleton.propTypes = {
  height: PropTypes.number,
};

DashboardChartSkeleton.defaultProps = {
  height: 150,
};

export function DashboardChartContent({ chart, loading, onRetry, children }) {
  if (chart.initialDataError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-divider bg-surface p-5" role="alert">
        <p className="font-medium">{chart.name}</p>
        <p>Could not load this chart.</p>
        <Button variant="secondary" onPress={onRetry}>Try again</Button>
      </div>
    );
  }
  return loading ? <DashboardChartSkeleton /> : children;
}

DashboardChartContent.propTypes = {
  chart: PropTypes.object.isRequired,
  loading: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
  children: PropTypes.node,
};

export default DashboardChartSkeleton;
