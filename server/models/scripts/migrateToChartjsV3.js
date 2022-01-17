const db = require("../models");
const tooltipsStyle = require("../../charts/tooltipsStyle");
const getContrastYIQ = require("../../modules/getContrastYIQ");

module.exports.up = () => {
  return db.Chart.findAll({
    attributes: ["id", "chartData", "mode", "type"],
  })
    .then((charts) => {
      const updatePromises = [];
      charts.forEach((chart) => {
        if (chart.chartData && chart.chartData.options && chart.chartData.data) {
          const newChartData = { ...chart.chartData };

          // KPI Line chart
          if (chart.type === "line" && chart.mode === "kpi") {
            newChartData.options.plugins = {
              tooltip: {
                enabled: false,
              },
              legend: {
                display: false,
              },
            };

            if (!newChartData.options.scales) newChartData.options.scales = {};
            newChartData.options.scales.y = {
              display: false,
            };
            newChartData.options.scales.x = {
              display: false,
            };
          } else if (chart.type === "line") { // Line Chart
            newChartData.options.interaction = {
              intersect: false,
              mode: "index",
            };
            newChartData.options.plugins = {
              legend: newChartData.options.legend,
              tooltip: tooltipsStyle,
            };

            if (!newChartData.options.scales) newChartData.options.scales = {};

            if (newChartData.options.scales.xAxes && newChartData.options.scales.yAxes
              && newChartData.options.scales.xAxes[0] && newChartData.options.scales.yAxes[0]
            ) {
              newChartData.options.scales.y = {
                ...newChartData.options.scales.yAxes[0].ticks,
                ticks: {
                  maxTicksLimit: newChartData.options.scales.yAxes[0].maxTicksLimit,
                  precision: newChartData.options.scales.yAxes[0].precision,
                  font: {
                    family: "Inter",
                  },
                },
              };

              newChartData.options.scales.x = {
                ...newChartData.options.scales.xAxes[0].ticks,
                ticks: {
                  maxTicksLimit: newChartData.options.scales.xAxes[0].maxTicksLimit,
                  precision: 0,
                  font: {
                    family: "Inter",
                  },
                },
              };

              if (newChartData.options.scales.yAxes[0].ticks
                && newChartData.options.scales.yAxes[0].ticks.min
              ) {
                newChartData.options.scales.y.min = newChartData.options.scales.yAxes[0].ticks.min;
              }
              if (newChartData.options.scales.yAxes[0].ticks
                && newChartData.options.scales.yAxes[0].ticks.max
              ) {
                newChartData.options.scales.y.max = newChartData.options.scales.yAxes[0].ticks.max;
              }
            }
          } else if (chart.type !== "line" && chart.mode === "kpi" && chart.type !== "table") {
            if (!newChartData.options.scales) newChartData.options.scales = {};
            newChartData.options.scales.y = {
              stacked: newChartData.options.scales.yAxes
                && newChartData.options.scales.yAxes[0]
                && newChartData.options.scales.yAxes[0].stacked,
              display: false,
            };
            newChartData.options.scales.x = {
              stacked: newChartData.options.scales.xAxes
                && newChartData.options.scales.xAxes[0]
                && newChartData.options.scales.xAxes[0].stacked,
              display: false,
            };
            newChartData.options.plugins = {
              tooltip: {
                enabled: false,
              },
              legend: {
                display: false,
              },
            };
          } else if (chart.type !== "line" && chart.type !== "table") {
            newChartData.options.interaction = {
              intersect: false,
              mode: "index",
            };
            newChartData.options.plugins = {
              tooltip: tooltipsStyle,
              legend: {
                display: newChartData.options.legend && newChartData.options.legend.display,
              },
            };

            if (newChartData.options.scales.xAxes && newChartData.options.scales.yAxes
              && newChartData.options.scales.xAxes[0] && newChartData.options.scales.yAxes[0]
            ) {
              newChartData.options.scales.y = {
                ...newChartData.options.scales.yAxes[0].ticks,
                stacked: newChartData.options.scales.yAxes[0].stacked,
                ticks: {
                  maxTicksLimit: newChartData.options.scales.yAxes[0].maxTicksLimit,
                  precision: 0,
                  font: {
                    family: "Inter",
                  },
                },
                display: chart.type === "bar",
              };
              newChartData.options.scales.x = {
                ...newChartData.options.scales.xAxes[0].ticks,
                stacked: newChartData.options.scales.xAxes[0].stacked,
                ticks: {
                  maxTicksLimit: newChartData.options.scales.xAxes[0],
                  precision: 0,
                  font: {
                    family: "Inter",
                  },
                },
                display: chart.type === "bar",
              };

              if (newChartData.options.scales.yAxes[0].ticks
                && newChartData.options.scales.yAxes[0].ticks.min
              ) {
                newChartData.options.scales.y.min = newChartData.options.scales.yAxes[0].ticks.min;
              }
              if (newChartData.options.scales.yAxes[0].ticks
                && newChartData.options.scales.yAxes[0].ticks.max
              ) {
                newChartData.options.scales.y.max = newChartData.options.scales.yAxes[0].ticks.max;
              }
            }
          }

          // edit the datalabels for pie, doughnut, radar, polar
          if (chart.type === "pie" || chart.type === "radar" || chart.type === "polar" || chart.type === "doughnut") {
            const newDatasets = chart.chartData.data.datasets.map((dataset) => {
              const formattedDataset = dataset;
              if (dataset.backgroundColor !== null
                && typeof dataset.backgroundColor === "object"
                && dataset.backgroundColor instanceof Array
              ) {
                formattedDataset.datalabels = {
                  color: dataset.backgroundColor.map((color) => getContrastYIQ(color)),
                  display: "auto",
                };
              } else {
                formattedDataset.datalabels = {
                  color: getContrastYIQ(dataset.backgroundColor),
                  display: "auto",
                };
              }

              return formattedDataset;
            });

            newChartData.data.datasets = newDatasets;
          }

          updatePromises.push(
            db.Chart.update({
              chartData: newChartData,
            }, {
              where: { id: chart.id }
            })
          );
        }
      });

      return Promise.all(updatePromises);
    })
    .then((results) => {
      return results;
    })
    .catch(() => {
      return new Promise((resolve) => resolve("done"));
    });
};
