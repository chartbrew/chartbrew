import React from "react";
import PropTypes from "prop-types";
import { Avatar, Button, Chip, ProgressCircle } from "@heroui/react";
import { LuBrainCircuit } from "react-icons/lu";

import Chart from "../Chart/Chart";

function AiChartPreview({ parsed, chartData }) {
  const isTemporary = parsed.type === "chart_temporary" || parsed.visibility === "temporary";
  const isCreated = parsed.type === "chart_created";
  const color = isTemporary ? "primary" : isCreated ? "success" : "warning";

  return (
    <div className="flex justify-center mb-4 px-4">
      <div className="w-full max-w-[90%]">
        <div className={`px-6 py-4 rounded-lg border ${
          isTemporary ? "border-primary-200 bg-primary-50/50" : isCreated ? "border-success-200" : "border-warning-200"
        }`}>
          <div className="flex items-start gap-3">
            <Avatar
              size="sm"
              color={isTemporary ? undefined : color}
              variant={isTemporary ? "soft" : undefined}
            >
              <Avatar.Fallback>
                <LuBrainCircuit size={16} className="text-accent" />
              </Avatar.Fallback>
            </Avatar>
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">
                  {isTemporary ? "Temporary Chart Preview" : isCreated ? "Chart Created" : "Chart Updated"}
                </span>
                <Chip
                  size="sm"
                  variant={isTemporary ? "primary" : "soft"}
                  color={isTemporary ? undefined : color}
                >
                  {parsed.chartName}
                </Chip>
                {isTemporary && (
                  <Chip
                    size="sm"
                    variant="soft"
                    color="default"
                    className="ml-auto"
                  >
                    Not saved to dashboard
                  </Chip>
                )}
              </div>
              {chartData ? (
                <div className="overflow-hidden h-[300px]">
                  <Chart
                    chart={chartData}
                    isPublic={false}
                    showExport={false}
                  />
                </div>
              ) : (
                <div className={`border ${
                  isTemporary ? "border-primary-200" : isCreated ? "border-success-200" : "border-warning-200"
                } rounded-lg p-8`}>
                  <ProgressCircle aria-label="Loading chart" />
                  <div className="text-sm mt-2">Loading chart...</div>
                </div>
              )}
              {isTemporary ? (
                <div className="text-xs text-foreground-500 mt-3 mb-2">
                  {"This chart is temporary. Tell me which dashboard you'd like to add it to."}
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <a href={`/dashboard/${parsed.projectId}`} target="_blank" rel="noopener noreferrer">
                    <Button
                      size="sm"
                      variant="tertiary"
                      className="pointer-events-none"
                    >
                      View on Dashboard
                    </Button>
                  </a>
                  <a href={`/dashboard/${parsed.projectId}/chart/${parsed.chartId}/edit`} target="_blank" rel="noopener noreferrer">
                    <Button
                      size="sm"
                      variant="tertiary"
                      className="pointer-events-none"
                    >
                      Edit Chart
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
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
};

export default AiChartPreview;
