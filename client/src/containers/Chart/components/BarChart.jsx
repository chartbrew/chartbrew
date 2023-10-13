import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { semanticColors } from "@nextui-org/react";
import { cloneDeep } from "lodash";

import KpiChartSegment from "./KpiChartSegment";
import ChartErrorBoundary from "./ChartErrorBoundary";
import KpiMode from "./KpiMode";
import useThemeDetector from "../../../modules/useThemeDetector";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, BarElement, Title, Tooltip, Legend, Filler
);

function BarChart(props) {
  const {
    chart, redraw, redrawComplete, height, editMode,
  } = props;
  const [maxHeight, setMaxHeight] = React.useState(height);

  useEffect(() => {
    if (redraw) {
      setTimeout(() => {
        redrawComplete();
      }, 1000);
    }
  }, [redraw]);

  useEffect(() => {
    if (chart.mode === "kpichart" && chart.chartSize > 1) {
      setMaxHeight(height - 70);
    } else if (chart.mode === "kpichart" && chart.chartSize === 1) {
      setMaxHeight(height - 40);
    } else {
      setMaxHeight(height - 10);
    }
  }, []);

  const theme = useThemeDetector() ? "dark" : "light";

  const _getChartOptions = () => {
    // add any dynamic changes to the chartJS options here
    if (chart.chartData?.options) {
      const newOptions = cloneDeep(chart.chartData.options);
      if (newOptions.scales?.y?.grid) {
        newOptions.scales.y.grid.color = semanticColors[theme].content3.DEFAULT
      }
      if (newOptions.scales?.x?.grid) {
        newOptions.scales.x.grid.color = semanticColors[theme].content3.DEFAULT
      }
      if (newOptions.scales?.y?.ticks) {
        newOptions.scales.y.ticks.color = semanticColors[theme].foreground.DEFAULT;
      }
      if (newOptions.scales?.x?.ticks) {
        newOptions.scales.x.ticks.color = semanticColors[theme].foreground.DEFAULT;
      }
      if (newOptions.plugins?.legend?.labels) {
        newOptions.plugins.legend.labels.color = semanticColors[theme].foreground.DEFAULT;
      }

      return newOptions;
    }

    return chart.chartData?.options;
  };

  const _getDatalabelsOptions = () => {
    return {
      font: {
        weight: "bold",
        size: 10,
        family: "Inter",
        color: "white"
      },
      padding: 4,
      // backgroundColor(context) {
      //   if (context.dataset.backgroundColor === "transparent"
      //     || context.dataset.backgroundColor === "rgba(0,0,0,0)"
      //   ) {
      //     return context.dataset.borderColor;
      //   }
      //   return context.dataset.backgroundColor;
      // },
      borderRadius: 4,
      // color: theme.colors.accents5.value,
      formatter: Math.round,
    };
  };

  const _getChartData = () => {
    if (!chart?.chartData?.data?.datasets) return chart.chartData.data;

    const newChartData = cloneDeep(chart.chartData.data);

    newChartData?.datasets?.forEach((dataset, index) => {
      if (dataset?.datalabels && index === chart.chartData.data.datasets.length - 1) {
        newChartData.datasets[index].datalabels.color = semanticColors[theme].default[800];
      }
    });

    return newChartData;
  };

  return (
    <>
      {chart.mode === "kpi"
        && chart.chartData
        && chart.chartData.data
        && chart.chartData.data.datasets
        && (
          <KpiMode chart={chart} />
        )}

      {chart.mode !== "kpi" && chart.chartData && chart.chartData.data && (
        <div className={chart.mode === "kpi" ? "chart-kpi" : ""}>
          {chart.chartData.growth && chart.mode === "kpichart" && (
            <KpiChartSegment chart={chart} editMode={editMode} />
          )}
          {chart.chartData.data && chart.chartData.data.labels && (
            <div style={{ height: maxHeight }}>
              <ChartErrorBoundary>
                <Bar
                  data={_getChartData()}
                  options={{
                    ..._getChartOptions(),
                    plugins: {
                      ..._getChartOptions().plugins,
                      datalabels: chart.dataLabels && _getDatalabelsOptions(),
                    },
                  }}
                  height={maxHeight}
                  redraw={redraw}
                  responsive={false}
                  plugins={chart.dataLabels ? [ChartDataLabels] : []}
                />
              </ChartErrorBoundary>
            </div>
          )}
        </div>
      )}
    </>
  );
}

BarChart.defaultProps = {
  redraw: false,
  redrawComplete: () => {},
  height: 300,
  editMode: false,
};

BarChart.propTypes = {
  chart: PropTypes.object.isRequired,
  redraw: PropTypes.bool,
  redrawComplete: PropTypes.func,
  height: PropTypes.number,
  editMode: PropTypes.bool,
};

export default BarChart;
