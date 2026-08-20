import React, { useMemo, useRef } from "react";
import PropTypes from "prop-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getClientPresetImplementation, isReadyPreset } from "../../../visualization/presetRegistry";
import {
  isCompatibleEChartsRender,
  selectEChartsRender,
} from "../../../visualization/echartsRenderState";
import BarChart from "./BarChart";
import DoughnutChart from "./DoughnutChart";
import EChartsErrorBoundary from "./EChartsErrorBoundary";
import EChartsRenderer from "./EChartsRenderer";
import GaugeChart from "./GaugeChart";
import KpiChartSegment from "./KpiChartSegment";
import KpiMode from "./KpiMode";
import LineChart from "./LineChart";
import MatrixChart from "./MatrixChart";
import PieChart from "./PieChart";
import PolarChart from "./PolarChart";
import RadarChart from "./RadarChart";
import TableContainer from "./TableView/TableContainer";

const LEGACY_COMPONENTS = {
  line: LineChart,
  area: LineChart,
  bar: BarChart,
  pie: PieChart,
  doughnut: DoughnutChart,
  radar: RadarChart,
  polar: PolarChart,
  matrix: MatrixChart,
  gauge: GaugeChart,
};

function LegacyGraphicalRenderer({ chart, ...props }) {
  const Component = LEGACY_COMPONENTS[chart.type];
  if (!Component) return null;
  const fallbackChart = chart.type === "area" ? { ...chart, type: "line" } : chart;
  return <Component chart={fallbackChart} {...props} />;
}

LegacyGraphicalRenderer.propTypes = {
  chart: PropTypes.object.isRequired,
};

function ChartRenderer({
  chart,
  editMode,
  embedded,
  height,
  loading,
  redraw,
  redrawComplete,
}) {
  const implementation = getClientPresetImplementation(chart.type);
  const lastEChartsRenderRef = useRef(null);
  const fallback = useMemo(() => (
    <LegacyGraphicalRenderer
      chart={chart}
      editMode={editMode}
      embedded={embedded}
      height={height}
      redraw={redraw}
      redrawComplete={redrawComplete}
    />
  ), [chart, editMode, embedded, height, redraw, redrawComplete]);

  if (implementation === "native-table") {
    return (
      <TableContainer
        tabularData={chart.chartData}
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
      key={`${chart.id || "preview"}:${effectiveRender.updatedAt || "runtime"}:${effectiveRender.type}`}
      fallback={fallback}
    >
      <EChartsRenderer
        ariaLabel={chart.name || "Chart"}
        option={effectiveRender.configuration}
        redraw={redraw}
        redrawComplete={redrawComplete}
      />
    </EChartsErrorBoundary>
  );

  if (chart.mode === "kpichart") {
    return (
      <div className="h-full pb-2">
        {chart.chartData?.growth && <KpiChartSegment chart={chart} editMode={editMode} />}
        <div className="h-full pb-[50px]">{chartBody}</div>
      </div>
    );
  }

  return chartBody;
}

ChartRenderer.defaultProps = {
  editMode: false,
  embedded: false,
  height: 300,
  loading: false,
  redraw: false,
  redrawComplete: () => {},
};

ChartRenderer.propTypes = {
  chart: PropTypes.object.isRequired,
  editMode: PropTypes.bool,
  embedded: PropTypes.bool,
  height: PropTypes.number,
  loading: PropTypes.bool,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
};

export default ChartRenderer;
