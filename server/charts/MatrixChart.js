class MatrixChart {
  constructor(chart, datasets, axisData, dateFormat, momentFn, startDate, endDate) {
    this.chart = chart;
    this.datasets = datasets;
    this.axisData = axisData;
    this.dateFormat = dateFormat;
    this.moment = momentFn;
    this.startDate = startDate; // Computed start date from AxisChart (respects currentEndDate)
    this.endDate = endDate; // Computed end date from AxisChart (respects currentEndDate)
  }

  getConfiguration() {
    // Only the first dataset (CDC) is rendered
    const firstConfig = this.chart.ChartDatasetConfigs?.[0] || {};
    const datasetColor = firstConfig?.datasetColor || "#3b82f6";

    // Process raw axisData to build matrix points
    const labels = this.axisData?.x || [];
    const values = (this.axisData.y && this.axisData.y[0]) || [];
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dataMap = new Map(); // Use Map to store data by date string

    // First pass: collect all data points
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      // Try strict with known format first
      let m = this.moment(label, this.dateFormat, true);
      // Fallbacks if label has no year (e.g., "May 20")
      if (!m || !m.isValid()) {
        const tryYearFormat = "YYYY MMM D";
        m = this.moment(`${this.moment().year()} ${label}`, tryYearFormat, false);
        if (!m.isValid()) {
          m = this.moment(label, "MMM D", false);
        }
      }
      if (!m || !m.isValid()) {
        continue; // eslint-disable-line no-continue
      }

      const dateOnly = m.format("YYYY-MM-DD");
      const vNum = Number(`${values[i]}`.toString().replace(/,/g, ""));
      const v = Number.isNaN(vNum) ? 0 : vNum;

      dataMap.set(dateOnly, v);
    }

    // Use computed date range from AxisChart (respects currentEndDate),
    // otherwise fall back to chart dates or data range
    let minDate;
    let maxDate;

    if (this.startDate && this.endDate) {
      // Use the computed dates passed from AxisChart
      minDate = this.startDate.clone();
      maxDate = this.endDate.clone();
    } else if (this.chart.startDate && this.chart.endDate) {
      // Fallback to chart's original dates
      minDate = this.moment(this.chart.startDate).startOf("day");
      maxDate = this.moment(this.chart.endDate).endOf("day");
    } else if (labels.length > 0) {
      // Fallback: use data range
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        let m = this.moment(label, this.dateFormat, true);
        if (!m || !m.isValid()) {
          const tryYearFormat = "YYYY MMM D";
          m = this.moment(`${this.moment().year()} ${label}`, tryYearFormat, false);
          if (!m.isValid()) {
            m = this.moment(label, "MMM D", false);
          }
        }
        if (!m || !m.isValid()) {
          continue; // eslint-disable-line no-continue
        }
        if (!minDate || m.isBefore(minDate)) minDate = m.clone();
        if (!maxDate || m.isAfter(maxDate)) maxDate = m.clone();
      }
    }

    // Second pass: fill in all dates in range with 0 for missing data
    const points = [];
    const weeksFound = {};

    if (minDate && maxDate) {
      const currentDate = minDate.clone();
      while (currentDate.isSameOrBefore(maxDate)) {
        const dateOnly = currentDate.format("YYYY-MM-DD");
        const isoWeekday = currentDate.isoWeekday(); // 1..7
        const yLabel = dayLabels[isoWeekday - 1];
        const v = dataMap.get(dateOnly) || 0; // Use 0 for missing dates

        points.push({
          x: dateOnly,
          y: yLabel,
          v,
          d: currentDate.format("MMM D")
        });

        const weekKey = `${currentDate.isoWeekYear()}-${currentDate.isoWeek()}`;
        weeksFound[weekKey] = true;

        currentDate.add(1, "day");
      }
    }

    // Compute value domain
    const numericValues = points.map((p) => p.v);
    const domainMin = numericValues.length ? Math.min(...numericValues) : 0;
    const domainMax = numericValues.length ? Math.max(...numericValues) : 1;

    const xCount = Object.keys(weeksFound).length || Math.max(1, Math.ceil(labels.length / 7));
    const yCount = 7;

    const dataset = {
      type: "matrix",
      label: firstConfig.legend || "Heatmap",
      data: points,
      // Store metadata for client-side scriptable functions
      _meta: {
        datasetColor,
        domainMin,
        domainMax,
        xCount,
        yCount,
      },
      borderWidth: 0,
      borderRadius: 4,
    };

    const data = { datasets: [dataset] };

    const options = {
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "time",
          position: "bottom",
          offset: true,
          time: {
            unit: "week",
            round: "week",
            isoWeekday: 1,
            displayFormats: { week: "MMM dd" },
          },
          border: {
            display: false, // Hide axis border line
          },
          grid: { display: false, drawBorder: false, tickLength: 0 },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            padding: 4,
            font: {
              family: "Inter",
              size: 10,
            },
          },
        },
        y: {
          type: "category",
          labels: ["Sun", "Sat", "Fri", "Thu", "Wed", "Tue", "Mon"], // Reversed order
          offset: true,
          position: "right",
          border: {
            display: false, // Hide axis border line
          },
          grid: { display: false, drawBorder: false, tickLength: 0 },
          ticks: {
            maxRotation: 0,
            autoSkip: false,
            padding: 4,
            font: {
              family: "Inter",
              size: 10,
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
        },
      },
      layout: {
        padding: {
          top: 10
        }
      }
    };

    // check how many ticks should the X Axis have
    let maxTicksLimit = 10;

    if (this.axisData.x.length) {
      switch (this.chart.xLabelTicks) {
        case "showAll":
          maxTicksLimit = this.axisData.x.length;
          break;
        case "half":
          maxTicksLimit = parseInt(this.axisData.x.length / 2, 10);
          break;
        case "third":
          maxTicksLimit = parseInt(this.axisData.x.length / 3, 10);
          break;
        case "fourth":
          maxTicksLimit = parseInt(this.axisData.x.length / 4, 10);
          break;
        default:
          if (this.chart.xLabelTicks && !Number.isNaN(parseInt(this.chart.xLabelTicks, 10))) {
            maxTicksLimit = parseInt(this.chart.xLabelTicks, 10);
          }
          break;
      }
    }

    options.scales.x.ticks.maxTicksLimit = maxTicksLimit;

    return { data, options };
  }
}

module.exports = MatrixChart;
