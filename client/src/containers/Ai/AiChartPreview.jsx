import React from "react";
import PropTypes from "prop-types";
import { Button, Chip, ProgressCircle } from "@heroui/react";
import {
  LuChartNoAxesColumnIncreasing, LuExternalLink, LuPencil, LuRefreshCw,
} from "react-icons/lu";

import Chart from "../Chart/Chart";

function AiChartPreview({ parsed, chartData, loadError, onRetry }) {
  const isTemporary = parsed.type === "chart_temporary" || parsed.visibility === "temporary";
  const isCreated = parsed.type === "chart_created";
  const title = parsed.chartName || chartData?.name || "Generated chart";

  return (
    <figure className="mx-auto mb-6 w-full max-w-3xl overflow-hidden rounded-2xl border border-divider bg-content1">
      <figcaption className="flex flex-col gap-2 border-b border-divider px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <LuChartNoAxesColumnIncreasing className="shrink-0 text-accent" size={18} aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted">Chartbrew visualization</p>
          </div>
        </div>
        <Chip color={isTemporary ? "warning" : "success"} size="sm" variant="soft">
          <Chip.Label>{isTemporary ? "Preview" : isCreated ? "Created" : "Updated"}</Chip.Label>
        </Chip>
      </figcaption>

      <div className="min-h-80 p-3">
        {chartData ? (
          <div className="h-80 overflow-hidden">
            <Chart chart={chartData} isPublic={false} showExport={false} />
          </div>
        ) : loadError ? (
          <div className="flex h-80 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted">The visualization could not load.</p>
            {onRetry ? (
              <Button onPress={onRetry} size="sm" variant="secondary">
                <LuRefreshCw size={15} aria-hidden />
                Try again
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex h-80 flex-col items-center justify-center gap-2 text-muted">
            <ProgressCircle aria-label="Loading generated chart" />
            <p className="text-sm">Loading visualization…</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-divider px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          {isTemporary
            ? "This preview has not been added to a dashboard."
            : "This visualization is available in your workspace."}
        </p>
        {!isTemporary ? (
          <div className="flex flex-row items-center gap-1">
            <Button
              onPress={() => window.open(`/dashboard/${parsed.projectId}`, "_blank", "noopener,noreferrer")}
              size="sm"
              variant="ghost"
            >
              <LuExternalLink size={15} aria-hidden />
              Open dashboard
            </Button>
            <Button
              onPress={() => window.open(
                `/dashboard/${parsed.projectId}/chart/${parsed.chartId}/edit`,
                "_blank",
                "noopener,noreferrer"
              )}
              size="sm"
              variant="ghost"
            >
              <LuPencil size={15} aria-hidden />
              Edit chart
            </Button>
          </div>
        ) : null}
      </div>
    </figure>
  );
}

AiChartPreview.propTypes = {
  parsed: PropTypes.shape({
    type: PropTypes.string.isRequired,
    visibility: PropTypes.string,
    chartId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    chartName: PropTypes.string,
    projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
  chartData: PropTypes.object,
  loadError: PropTypes.bool,
  onRetry: PropTypes.func,
};

export default AiChartPreview;
