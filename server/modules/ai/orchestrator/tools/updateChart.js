const db = require("../../../../models/models");
const ChartController = require("../../../../controllers/ChartController");

async function updateChart(payload) {
  const {
    chart_id, dataset_id, spec, team_id,
    name, legend, type, subType, displayLegend, pointRadius,
    dataLabels, includeZeros, timeInterval, stacked, horizontal,
    xLabelTicks, showGrowth, invertGrowth, mode, maxValue, minValue, ranges,
    datasetColor, fillColor, fill, multiFill, excludedFields, sort, columnsOrder, maxRecords, goal
  } = payload;

  if (!chart_id) {
    throw new Error("chart_id is required to update a chart");
  }

  if (!team_id) {
    throw new Error("team_id is required to update a chart");
  }

  try {
    // Find the existing chart
    const chart = await db.Chart.findByPk(chart_id);
    if (!chart) {
      throw new Error("Chart not found");
    }

    // Verify team ownership through project
    const project = await db.Project.findByPk(chart.project_id);
    if (!project || project.team_id !== team_id) {
      throw new Error("Chart does not belong to the specified team");
    }

    // Provide default chart spec if not provided
    const defaultSpec = {
      displayLegend: true,
      pointRadius: 0,
      dataLabels: false,
      includeZeros: true,
      stacked: false,
      horizontal: false,
      xLabelTicks: "default",
      showGrowth: false,
      invertGrowth: false,
      mode: "chart",
    };

    const chartSpec = spec || defaultSpec;

    // Update chart fields (only if provided)
    const chartUpdates = {};
    if (name !== undefined) chartUpdates.name = name;
    if (type !== undefined) chartUpdates.type = type;
    if (subType !== undefined) chartUpdates.subType = subType;
    if (displayLegend !== undefined) chartUpdates.displayLegend = displayLegend;
    else if (chartSpec.displayLegend !== undefined) {
      chartUpdates.displayLegend = chartSpec.displayLegend;
    }
    if (pointRadius !== undefined) {
      chartUpdates.pointRadius = pointRadius;
    } else if (chartSpec.pointRadius !== undefined) {
      chartUpdates.pointRadius = chartSpec.pointRadius;
    }
    if (dataLabels !== undefined) {
      chartUpdates.dataLabels = dataLabels;
    } else if (chartSpec.dataLabels !== undefined) {
      chartUpdates.dataLabels = chartSpec.dataLabels;
    }
    if (includeZeros !== undefined) {
      chartUpdates.includeZeros = includeZeros;
    } else if (chartSpec.includeZeros !== undefined) {
      chartUpdates.includeZeros = chartSpec.includeZeros;
    }
    if (timeInterval !== undefined) {
      chartUpdates.timeInterval = timeInterval;
    } else if (chartSpec.timeInterval !== undefined) {
      chartUpdates.timeInterval = chartSpec.timeInterval;
    }

    if (stacked !== undefined) {
      chartUpdates.stacked = stacked;
    } else if (chartSpec.stacked !== undefined || chartSpec.options?.stacked !== undefined) {
      chartUpdates.stacked = chartSpec.stacked ?? chartSpec.options?.stacked ?? false;
    }

    if (horizontal !== undefined) {
      chartUpdates.horizontal = horizontal;
    } else if (chartSpec.horizontal !== undefined || chartSpec.options?.horizontal !== undefined) {
      chartUpdates.horizontal = horizontal
        ?? chartSpec.horizontal ?? chartSpec.options?.horizontal ?? false;
    }

    if (xLabelTicks !== undefined) {
      chartUpdates.xLabelTicks = xLabelTicks;
    } else if (chartSpec.xLabelTicks !== undefined) {
      chartUpdates.xLabelTicks = chartSpec.xLabelTicks;
    }

    if (showGrowth !== undefined) {
      chartUpdates.showGrowth = showGrowth;
    } else if (chartSpec.showGrowth !== undefined) chartUpdates.showGrowth = chartSpec.showGrowth;

    if (invertGrowth !== undefined) {
      chartUpdates.invertGrowth = invertGrowth;
    } else if (chartSpec.invertGrowth !== undefined) {
      chartUpdates.invertGrowth = chartSpec.invertGrowth;
    }

    if (mode !== undefined) {
      chartUpdates.mode = mode;
    } else if (chartSpec.mode !== undefined) {
      chartUpdates.mode = chartSpec.mode;
    }

    if (maxValue !== undefined) chartUpdates.maxValue = maxValue;
    else if (chartSpec.maxValue !== undefined) {
      chartUpdates.maxValue = chartSpec.maxValue;
    }

    if (minValue !== undefined) {
      chartUpdates.minValue = minValue;
    } else if (chartSpec.minValue !== undefined) {
      chartUpdates.minValue = chartSpec.minValue;
    }
    if (ranges !== undefined) {
      chartUpdates.ranges = ranges;
    } else if (chartSpec.ranges !== undefined) {
      chartUpdates.ranges = chartSpec.ranges;
    }

    if (Object.keys(chartUpdates).length > 0) {
      await db.Chart.update(chartUpdates, { where: { id: chart_id } });
    }

    // Find and update the chart dataset config (if dataset_id is provided)
    if (
      dataset_id
      || legend || datasetColor || fillColor || fill || multiFill
      || excludedFields || sort || columnsOrder || maxRecords || goal
      || pointRadius !== undefined || chartSpec.pointRadius !== undefined
    ) {
      const configWhere = { chart_id };
      if (dataset_id) {
        configWhere.dataset_id = dataset_id;
      }

      const chartDatasetConfig = await db.ChartDatasetConfig.findOne({
        where: configWhere
      });

      if (chartDatasetConfig) {
        const configUpdates = {};

        if (legend !== undefined) {
          configUpdates.legend = legend;
        } else if (chartSpec.title !== undefined) {
          configUpdates.legend = chartSpec.title;
        }

        if (datasetColor !== undefined) {
          configUpdates.datasetColor = datasetColor;
        } else if (chartSpec.datasetColor !== undefined) {
          configUpdates.datasetColor = chartSpec.datasetColor;
        } else if (chartSpec.options?.color !== undefined) {
          configUpdates.datasetColor = chartSpec.options.color;
        }

        if (fillColor !== undefined) {
          configUpdates.fillColor = fillColor;
        } else if (chartSpec.fillColor !== undefined) {
          configUpdates.fillColor = chartSpec.fillColor;
        }

        if (fill !== undefined) {
          configUpdates.fill = fill;
        } else if (chartSpec.fill !== undefined) {
          configUpdates.fill = chartSpec.fill;
        }

        if (multiFill !== undefined) {
          configUpdates.multiFill = multiFill;
        } else if (chartSpec.multiFill !== undefined) {
          configUpdates.multiFill = chartSpec.multiFill;
        }

        if (excludedFields !== undefined) {
          configUpdates.excludedFields = excludedFields;
        } else if (chartSpec.excludedFields !== undefined) {
          configUpdates.excludedFields = chartSpec.excludedFields;
        }

        if (sort !== undefined) {
          configUpdates.sort = sort;
        } else if (chartSpec.sort !== undefined) {
          configUpdates.sort = chartSpec.sort;
        }

        if (columnsOrder !== undefined) {
          configUpdates.columnsOrder = columnsOrder;
        } else if (chartSpec.columnsOrder !== undefined) {
          configUpdates.columnsOrder = chartSpec.columnsOrder;
        }

        if (maxRecords !== undefined) {
          configUpdates.maxRecords = maxRecords;
        } else if (chartSpec.maxRecords !== undefined) {
          configUpdates.maxRecords = chartSpec.maxRecords;
        }

        if (goal !== undefined) {
          configUpdates.goal = goal;
        } else if (chartSpec.goal !== undefined) {
          configUpdates.goal = chartSpec.goal;
        }

        if (chartSpec.formula !== undefined) {
          configUpdates.formula = chartSpec.formula;
        }

        if (pointRadius !== undefined) {
          configUpdates.pointRadius = pointRadius;
        } else if (chartSpec.pointRadius !== undefined) {
          configUpdates.pointRadius = chartSpec.pointRadius;
        }

        if (Object.keys(configUpdates).length > 0) {
          await db.ChartDatasetConfig.update(
            configUpdates, { where: { id: chartDatasetConfig.id } }
          );
        }
      }
    }

    // Run the chart update in the background
    try {
      const chartController = new ChartController();
      await chartController.updateChartData(chart_id, null, {});
    } catch {
      // Ignore background update errors
    }

    // Refresh the chart to get updated values
    const updatedChart = await db.Chart.findByPk(chart_id, {
      include: [{
        model: db.Project,
        attributes: ["id", "name"]
      }]
    });

    // Take a snapshot of the updated chart for visualization
    let snapshot = null;
    try {
      const chartController = new ChartController();
      snapshot = await chartController.takeSnapshot(updatedChart.id);
    } catch (snapshotError) {
      // Ignore snapshot errors - chart update was successful
      // eslint-disable-next-line no-console
      console.warn(`Failed to take snapshot for chart ${updatedChart.id}:`, snapshotError.message);
    }

    return {
      chart_id: updatedChart.id,
      name: updatedChart.name,
      type: updatedChart.type,
      project_id: updatedChart.project_id,
      dashboard_url: `${global.clientUrl}/${team_id}/${updatedChart.project_id}/dashboard`,
      chart_url: `${global.clientUrl}/${team_id}/${updatedChart.project_id}/chart/${updatedChart.id}/edit`,
      snapshot,
      updated_fields: {
        chart: Object.keys(chartUpdates),
        config: dataset_id || legend || datasetColor || fillColor || fill || multiFill || excludedFields || sort || columnsOrder || maxRecords || goal ? "chart_dataset_config" : null
      }
    };
  } catch (error) {
    throw new Error(`Chart update failed: ${error.message}`);
  }
}

module.exports = updateChart;
