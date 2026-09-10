import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import toast from "react-hot-toast";
import {
  Autocomplete, Button, Chip, EmptyState, Link, ListBox, ProgressCircle,
  SearchField, useFilter,
} from "@heroui/react";
import {
  LuChartNoAxesColumnIncreasing, LuDatabase, LuExternalLink, LuRefreshCw,
} from "react-icons/lu";

import { searchAiContext } from "../../api/ai";
import Chart from "../Chart/Chart";

function getChartDatasets(parsed, chartData) {
  const datasets = parsed.datasets?.length > 0
    ? parsed.datasets
    : (chartData?.ChartDatasetConfigs || []).map((config) => ({
      id: config.Dataset?.id || config.dataset_id,
      name: config.Dataset?.name || config.Dataset?.legend || config.legend || "Dataset",
    }));
  return [...new Map(datasets.filter((dataset) => dataset.id).map((dataset) => [
    `${dataset.id}`,
    dataset,
  ])).values()];
}

function AiChartPreview({
  chartData,
  isUnavailable,
  loadError,
  onChartAction,
  onRetry,
  parsed,
  selectedContext,
  teamId,
}) {
  parsed = { ...parsed, ...chartData?.preview };
  const { contains } = useFilter({ sensitivity: "base" });
  const isTemporary = parsed.type === "chart_temporary" || parsed.visibility === "temporary";
  const title = parsed.chartName || chartData?.name || "Generated chart";
  const chartType = parsed.chartType || chartData?.type;
  const datasets = useMemo(() => getChartDatasets(parsed, chartData), [chartData, parsed]);
  const savedDashboard = useMemo(() => (!isTemporary && parsed.projectId ? {
    id: parsed.dashboard?.id || parsed.projectId,
    name: parsed.dashboard?.name || "Dashboard",
  } : null), [
    isTemporary,
    parsed.dashboard?.id,
    parsed.dashboard?.name,
    parsed.projectId,
  ]);
  const exactDashboard = selectedContext.multiSelect.find((item) => (
    item.entity_type === "project" && item.metadata?.canEdit
  ));
  const [dashboards, setDashboards] = useState([]);
  const [dashboardError, setDashboardError] = useState("");
  const [isLoadingDashboards, setIsLoadingDashboards] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState(
    savedDashboard ? `${savedDashboard.id}` : exactDashboard ? `${exactDashboard.id}` : null
  );
  const selectedDashboard = dashboards.find((dashboard) => (
    `${dashboard.id}` === selectedDashboardId
  )) || savedDashboard;

  const loadDashboards = useCallback(async () => {
    if (!teamId) return;
    setIsLoadingDashboards(true);
    setDashboardError("");
    try {
      const response = await searchAiContext(teamId, { limit: 50, type: "dashboard" });
      const editable = (response.context || []).filter((item) => item.metadata?.canEdit);
      if (exactDashboard && !editable.some((item) => `${item.id}` === `${exactDashboard.id}`)) {
        editable.unshift(exactDashboard);
      }
      if (savedDashboard && !editable.some((item) => `${item.id}` === `${savedDashboard.id}`)) {
        editable.unshift(savedDashboard);
      }
      setDashboards(editable);
    } catch (error) {
      setDashboardError(error.message);
    } finally {
      setIsLoadingDashboards(false);
    }
  }, [exactDashboard, savedDashboard, teamId]);

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  useEffect(() => {
    if (savedDashboard) setSelectedDashboardId(`${savedDashboard.id}`);
  }, [savedDashboard]);

  const addToDashboard = async (dashboard) => {
    if (!dashboard || isPlacing) return;
    setIsPlacing(true);
    try {
      const chartPreview = await onChartAction({
        action: {
          chartId: parsed.chartId,
          targetProjectId: dashboard.id,
          type: "add_preview_to_dashboard",
        },
      });
      if (!chartPreview) throw new Error("The chart could not be added to the dashboard");
    } catch (error) {
      setSelectedDashboardId(null);
      toast.error(error.message || "The chart could not be added to the dashboard");
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <figure className="flex w-full flex-col gap-3 rounded-[2rem] bg-foreground/[0.055] p-3 dark:bg-foreground/[0.08]">
      <figcaption className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <LuChartNoAxesColumnIncreasing className="shrink-0 text-accent" size={18} aria-hidden />
          <div className="min-w-0">
            {isUnavailable ? (
              <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            ) : (
              <Link
                className="inline-flex max-w-full min-w-0 gap-1.5 text-sm font-semibold"
                href={isTemporary ? `/previews/${parsed.chartId}` : `/dashboard/${parsed.projectId}/chart/${parsed.chartId}/edit`}
                rel="noreferrer"
                target="_blank"
              >
                <span className="truncate">{title}</span>
                <LuExternalLink className="shrink-0" size={13} aria-hidden />
              </Link>
            )}
            {chartType ? <p className="text-xs capitalize text-muted">{chartType}</p> : null}
          </div>
        </div>
        <Chip
          color={isUnavailable ? "default" : isTemporary ? "warning" : "success"}
          size="sm"
          variant="soft"
        >
          <Chip.Label>{isUnavailable ? "Unavailable" : isTemporary ? "Preview" : "Saved"}</Chip.Label>
        </Chip>
      </figcaption>

      <div className={`${isUnavailable ? "min-h-32" : "min-h-80"} overflow-hidden rounded-[1.25rem] bg-surface`}>
        {isUnavailable ? (
          <div className="flex h-32 items-center justify-center px-6 text-center">
            <p className="text-sm text-muted">This chart is no longer available.</p>
          </div>
        ) : chartData ? (
          <div className="h-80 overflow-hidden">
            <Chart chart={chartData} embedded isPublic={false} showExport={false} />
          </div>
        ) : loadError ? (
          <div className="flex h-80 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted">The chart could not load.</p>
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
            <p className="text-sm">Loading chart…</p>
          </div>
        )}
      </div>

      {!isUnavailable || datasets.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-divider px-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
          {!isUnavailable ? (
            <div className="min-w-0 flex-1 sm:max-w-md">
              {dashboards.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Autocomplete
                    aria-label={isTemporary ? "Select a dashboard" : "Dashboard"}
                    className="min-w-0 flex-1"
                    isDisabled={!isTemporary || isPlacing}
                    onChange={(value) => {
                      setSelectedDashboardId(value ? `${value}` : null);
                      if (isTemporary && value) {
                        addToDashboard(dashboards.find((dashboard) => `${dashboard.id}` === `${value}`));
                      }
                    }}
                    placeholder="Select a dashboard"
                    selectionMode="single"
                    size="sm"
                    value={selectedDashboardId}
                    variant="primary"
                  >
                    <Autocomplete.Trigger>
                      <Autocomplete.Value />
                      <Autocomplete.Indicator />
                    </Autocomplete.Trigger>
                    <Autocomplete.Popover>
                      <Autocomplete.Filter filter={contains}>
                        <SearchField autoFocus name={`chart-dashboard-${parsed.chartId}`} variant="secondary">
                          <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="Search dashboards" />
                            <SearchField.ClearButton />
                          </SearchField.Group>
                        </SearchField>
                        <ListBox renderEmptyState={() => <EmptyState>No dashboards found</EmptyState>}>
                          {dashboards.map((dashboard) => (
                            <ListBox.Item
                              id={`${dashboard.id}`}
                              key={dashboard.id}
                              textValue={dashboard.name}
                            >
                              {dashboard.name}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Autocomplete.Filter>
                    </Autocomplete.Popover>
                  </Autocomplete>
                  {selectedDashboard ? (
                    <Button
                      aria-label={`Open ${selectedDashboard.name} in a new tab`}
                      isDisabled={isPlacing}
                      isIconOnly
                      render={(props) => (
                        <a
                          {...props}
                          href={`/dashboard/${selectedDashboard.id}`}
                          rel="noreferrer"
                          target="_blank"
                        />
                      )}
                      size="sm"
                      variant="secondary"
                    >
                      <LuExternalLink size={15} aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ) : dashboardError ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-danger">
                  <span>{dashboardError}</span>
                  <Button onPress={loadDashboards} size="sm" variant="tertiary">Try again</Button>
                </div>
              ) : isLoadingDashboards ? (
                <span className="text-xs text-muted">Loading dashboards…</span>
              ) : null}
            </div>
          ) : null}

          {datasets.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
              {datasets.map((dataset) => (
                <Link
                  className="min-w-0 gap-1.5 text-sm"
                  href={`/datasets/${dataset.id}`}
                  key={dataset.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <LuDatabase className="shrink-0" size={14} aria-hidden />
                  <span className="truncate">{dataset.name}</span>
                  <LuExternalLink className="shrink-0" size={13} aria-hidden />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}

AiChartPreview.propTypes = {
  parsed: PropTypes.shape({
    type: PropTypes.string.isRequired,
    visibility: PropTypes.string,
    chartId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    chartName: PropTypes.string,
    chartType: PropTypes.string,
    dashboard: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      name: PropTypes.string,
    }),
    datasets: PropTypes.arrayOf(PropTypes.object),
    projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
  chartData: PropTypes.object,
  isUnavailable: PropTypes.bool,
  loadError: PropTypes.bool,
  onChartAction: PropTypes.func,
  onRetry: PropTypes.func,
  selectedContext: PropTypes.shape({ multiSelect: PropTypes.array }).isRequired,
  teamId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

AiChartPreview.defaultProps = {
  selectedContext: { multiSelect: [] },
};

export default AiChartPreview;
