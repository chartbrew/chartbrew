import React, { useState } from "react";
import PropTypes from "prop-types";
import { Button, Chip, CircularProgress } from "@heroui/react";
import { LuRefreshCw } from "react-icons/lu";

import LineChart from "../../Chart/components/LineChart";
import BarChart from "../../Chart/components/BarChart";
import RadarChart from "../../Chart/components/RadarChart";
import DoughnutChart from "../../Chart/components/DoughnutChart";
import PolarChart from "../../Chart/components/PolarChart";
import PieChart from "../../Chart/components/PieChart";
import MatrixChart from "../../Chart/components/MatrixChart";
import TableContainer from "../../Chart/components/TableView/TableContainer";
import KpiMode from "../../Chart/components/KpiMode";
import GaugeChart from "../../Chart/components/GaugeChart";

function V2ChartCanvas({ chart, loading, onRefresh, datasetName, datasetNames }) {
  const [redraw, setRedraw] = useState(false);

  const _onRefresh = async () => {
    setRedraw(true);
    await onRefresh();
  };

  const _renderChart = () => {
    if (!chart?.chartData) {
      return (
        <div className="flex min-h-[360px] items-center justify-center text-sm text-default-500">
          Configure the question to generate a preview.
        </div>
      );
    }

    if (chart.type === "line") {
      return <LineChart chart={chart} redraw={redraw} redrawComplete={() => setRedraw(false)} />;
    }

    if (chart.type === "bar") {
      return <BarChart chart={chart} redraw={redraw} redrawComplete={() => setRedraw(false)} />;
    }

    if (chart.type === "radar") {
      return <RadarChart chart={chart} redraw={redraw} redrawComplete={() => setRedraw(false)} />;
    }

    if (chart.type === "pie") {
      return <PieChart chart={chart} redraw={redraw} redrawComplete={() => setRedraw(false)} />;
    }

    if (chart.type === "doughnut") {
      return <DoughnutChart chart={chart} redraw={redraw} redrawComplete={() => setRedraw(false)} />;
    }

    if (chart.type === "polar") {
      return <PolarChart chart={chart} redraw={redraw} redrawComplete={() => setRedraw(false)} />;
    }

    if (chart.type === "matrix") {
      return <MatrixChart chart={chart} redraw={redraw} redrawComplete={() => setRedraw(false)} />;
    }

    if (chart.type === "table") {
      return (
        <div className="h-full">
          <TableContainer
            tabularData={chart.chartData}
            datasets={chart.ChartDatasetConfigs}
            defaultRowsPerPage={chart.defaultRowsPerPage}
          />
        </div>
      );
    }

    if (chart.type === "kpi" || chart.type === "avg") {
      return <KpiMode chart={chart} redraw={redraw} redrawComplete={() => setRedraw(false)} />;
    }

    if (chart.type === "gauge") {
      return <GaugeChart chart={chart} redraw={redraw} redrawComplete={() => setRedraw(false)} />;
    }

    return (
      <div className="flex min-h-[360px] items-center justify-center text-sm text-default-500">
        This chart type is not available in the V2 builder yet.
      </div>
    );
  };

  return (
    <div className="bg-content1 rounded-lg border-1 border-divider p-4">
      <div className="flex flex-row items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Chart preview</div>
          <div className="mt-2 text-3xl font-semibold font-tw">{chart?.name || "Untitled chart"}</div>
          <div className="text-sm text-default-500">
            {datasetName || "Dataset preview"}
          </div>
          {Array.isArray(datasetNames) && datasetNames.length > 1 && (
            <div className="mt-3 flex flex-row flex-wrap gap-2">
              {datasetNames.map((name) => (
                <Chip key={name} variant="bordered" size="sm">
                  {name}
                </Chip>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="flat"
          color="primary"
          size="sm"
          onPress={_onRefresh}
          isLoading={loading}
          startContent={!loading ? <LuRefreshCw /> : null}
        >
          Refresh preview
        </Button>
      </div>

      <div className="mt-4 min-h-[360px]">
        {loading && !chart?.chartData ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <CircularProgress aria-label="Loading preview" />
          </div>
        ) : (
          <div className="flex flex-col min-h-[360px]">
            {_renderChart()}
          </div>
        )}
      </div>
    </div>
  );
}

V2ChartCanvas.propTypes = {
  chart: PropTypes.object,
  datasetName: PropTypes.string,
  datasetNames: PropTypes.arrayOf(PropTypes.string),
  loading: PropTypes.bool,
  onRefresh: PropTypes.func,
};

V2ChartCanvas.defaultProps = {
  chart: null,
  datasetName: "",
  datasetNames: [],
  loading: false,
  onRefresh: async () => {},
};

export default V2ChartCanvas;
