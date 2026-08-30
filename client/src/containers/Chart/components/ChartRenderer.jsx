import React, {
  useEffect, useMemo, useRef, useState,
} from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  getClientPresetImplementation,
  hasPresetCapability,
  isReadyPreset,
} from "../../../visualization/presetRegistry";
import {
  isCompatibleEChartsRender,
  selectEChartsRender,
} from "../../../visualization/echartsRenderState";
import { getResponsiveGeometry } from "../../../visualization/responsiveLayout";
import EChartsErrorBoundary from "./EChartsErrorBoundary";
import EChartsRenderer from "./EChartsRenderer";
import KpiChartSegment from "./KpiChartSegment";
import KpiMode from "./KpiMode";
import TableContainer from "./TableView/TableContainer";

function RenderUnavailable() {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-default-500">
      Chart data is unavailable
    </div>
  );
}

function KpiChartLayout({ chart, children, detailScale, editMode }) {
  const containerRef = useRef(null);
  const [shallow, setShallow] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const updateLayout = () => {
      const geometry = getResponsiveGeometry(container.clientWidth, container.clientHeight);
      setShallow(geometry.height === "shallow");
    };
    const observer = new ResizeObserver(updateLayout);
    observer.observe(container);
    updateLayout();
    return () => observer.disconnect();
  }, []);

  const metrics = chart.render?.metadata?.metrics || chart.render?.configuration?.items || [];
  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 w-full flex-col"
      style={{ gap: Math.round(4 * detailScale) }}
    >
      {metrics.length > 0 && (
        <KpiChartSegment
          chart={chart}
          compact={shallow}
          detailScale={detailScale}
          editMode={editMode}
        />
      )}
      <div className="min-h-0 flex-1">
        {children}
      </div>
    </div>
  );
}

KpiChartLayout.propTypes = {
  chart: PropTypes.object.isRequired,
  children: PropTypes.node.isRequired,
  detailScale: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,
};

function ChartRenderer({
  chart,
  compactAxes = false,
  detailScale = 1,
  editMode = false,
  embedded = false,
  height = 300,
  loading = false,
  redraw = false,
  redrawComplete = () => {},
  renderer = "canvas",
  theme = null,
}) {
  const implementation = getClientPresetImplementation(chart.type);
  const lastEChartsRenderRef = useRef(null);
  const fallback = useMemo(() => <RenderUnavailable />, []);

  if (implementation === "native-table") {
    return (
      <TableContainer
        tabularData={chart.render?.configuration || {}}
        datasets={chart.ChartDatasetConfigs}
        defaultRowsPerPage={chart.defaultRowsPerPage}
        editMode={editMode}
        embedded={embedded}
        height={height}
      />
    );
  }

  if (implementation === "native-metric") {
    return <KpiMode chart={chart} editMode={editMode} height={height} />;
  }

  if (implementation === "native-markdown") {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none overflow-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {chart.render?.configuration?.content || chart.content || ""}
        </ReactMarkdown>
      </div>
    );
  }

  if (implementation !== "echarts" || !isReadyPreset(chart.type)) {
    return fallback;
  }

  const currentRender = isCompatibleEChartsRender(chart.type, chart.render)
    ? { ...chart.render, type: chart.type }
    : null;
  if (currentRender) lastEChartsRenderRef.current = currentRender;
  const effectiveRender = selectEChartsRender({
    loading: loading || chart.loading,
    previous: lastEChartsRenderRef.current,
    render: chart.render,
    type: chart.type,
  });

  if (!effectiveRender) {
    if (loading || chart.loading) {
      return (
        <div className="flex h-full w-full items-center justify-center" aria-label="Updating chart">
          <div className="h-2/3 w-2/3 animate-pulse rounded-2xl bg-default-100" />
        </div>
      );
    }
    return fallback;
  }

  const chartBody = (
    <EChartsErrorBoundary
      key={`${chart.id || "preview"}:${effectiveRender.type}`}
      fallback={fallback}
    >
      <EChartsRenderer
        ariaLabel={chart.name || "Chart"}
        compactAxes={compactAxes}
        detailScale={detailScale}
        option={effectiveRender.configuration}
        redraw={redraw}
        redrawComplete={redrawComplete}
        renderer={renderer}
        theme={theme}
      />
    </EChartsErrorBoundary>
  );

  if (chart.mode === "kpichart" && hasPresetCapability(chart.type, "kpiOverlay")) {
    return (
      <KpiChartLayout chart={chart} detailScale={detailScale} editMode={editMode}>
        {chartBody}
      </KpiChartLayout>
    );
  }

  return chartBody;
}

ChartRenderer.propTypes = {
  chart: PropTypes.object.isRequired,
  compactAxes: PropTypes.bool,
  detailScale: PropTypes.number,
  editMode: PropTypes.bool,
  embedded: PropTypes.bool,
  height: PropTypes.number,
  loading: PropTypes.bool,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
  renderer: PropTypes.oneOf(["canvas", "svg"]),
  theme: PropTypes.oneOf(["light", "dark"]),
};

export default ChartRenderer;
