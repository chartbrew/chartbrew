export const createTooltipElement = () => {
  const tooltipEl = document.createElement("div");
  tooltipEl.id = "chartjs-tooltip";
  tooltipEl.className = "absolute pointer-events-none opacity-0 min-w-[120px] bg-white dark:bg-gray-800 rounded-lg shadow-md px-1 transition-all duration-150 ease-out z-[9999]";
  document.body.appendChild(tooltipEl);
  return tooltipEl;
};

export const formatTotal = (value) => {
  // You can implement your own formatting function here
  return typeof value === "number" ? value.toLocaleString() : value;
};

const createTooltipTextElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text == null ? "" : String(text);
  return element;
};

const parseTooltipBodyLine = (body, index) => {
  if (body && typeof body === "object") {
    return {
      category: body.category || `Series ${index + 1}`,
      value: body.value == null ? "" : String(body.value).trim(),
    };
  }

  if (typeof body === "string") {
    if (body.includes(":")) {
      const separatorIndex = body.indexOf(":");
      return {
        category: body.slice(0, separatorIndex).trim(),
        value: body.slice(separatorIndex + 1).trim(),
      };
    }

    return {
      category: `Series ${index + 1}`,
      value: body.trim(),
    };
  }

  return {
    category: `Series ${index + 1}`,
    value: body == null ? "" : String(body).trim(),
  };
};

export const formatValueWithFormula = (value, formula) => {
  if (typeof formula !== "string") return value;

  const openIndex = formula.indexOf("{");
  const closeIndex = formula.indexOf("}", openIndex + 1);
  if (openIndex === -1 || closeIndex === -1) return value;

  return `${formula.slice(0, openIndex)}${value ?? ""}${formula.slice(closeIndex + 1)}`;
};

export const getTooltipFormulas = (chart) => {
  const datasets = chart?.chartData?.data?.datasets || [];
  const layers = chart?.visualization?.layers || [];
  const runtimeSeries = chart?.chartData?.meta?.series || [];

  return Object.fromEntries(datasets.map((dataset, index) => {
    if (dataset.formula) return [index, dataset.formula];

    const layerId = dataset.layerId || runtimeSeries[index]?.layerId;
    const layer = layers.find((item) => item.id === layerId) || layers[index];
    const formula = layer?.encoding?.value?.formula
      || chart?.ChartDatasetConfigs?.[index]?.formula
      || null;
    return [index, formula];
  }));
};

export const formatTooltipBodyLine = (body, dataPoint, index, formula) => {
  const displayFormula = dataPoint?.dataset?.formula || formula;
  if (!displayFormula) return body;

  const parsedBody = parseTooltipBodyLine(body, index);
  return {
    category: dataPoint?.dataset?.label || parsedBody.category,
    value: formatValueWithFormula(dataPoint.formattedValue ?? parsedBody.value, displayFormula),
  };
};

export const generateTooltipContent = (titleLines, bodyLines, labelColors, isCategoryChart) => {
  const container = document.createElement("div");
  container.className = "py-1 px-1 z-50";

  titleLines.forEach((title) => {
    container.appendChild(
      createTooltipTextElement(
        "span",
        "font-medium text-gray-900 dark:text-gray-100 text-xs dark:border-gray-700 pb-1",
        title
      )
    );
  });

  bodyLines.forEach((body, i) => {
    if (!body) return;

    const colors = labelColors[i] || {};
    const { category, value } = parseTooltipBodyLine(body, i);
    const row = document.createElement("div");
    row.className = "flex w-full items-center gap-x-2";

    const dot = document.createElement("div");
    dot.className = "h-2 w-2 flex-none rounded-full";
    dot.style.backgroundColor = isCategoryChart ? colors.backgroundColor : colors.borderColor;

    const content = document.createElement("div");
    content.className = "flex w-full items-center justify-between gap-x-2 pr-1 text-xs";

    const categoryElement = createTooltipTextElement(
      "span",
      "text-gray-500 dark:text-gray-400",
      category
    );
    const valueElement = createTooltipTextElement(
      "span",
      "font-mono font-medium text-gray-700 dark:text-gray-300",
      formatTotal(value)
    );

    content.appendChild(categoryElement);
    content.appendChild(valueElement);
    row.appendChild(dot);
    row.appendChild(content);
    container.appendChild(row);
  });

  return container;
};

export const tooltipPlugin = {
  enabled: false,
  external: function(context) {
    let tooltipEl = document.getElementById("chartjs-tooltip");

    // Create element on first render
    if (!tooltipEl) {
      tooltipEl = createTooltipElement();
    }

    // Hide if no tooltip
    const tooltipModel = context.tooltip;
    if (tooltipModel.opacity === 0) {
      tooltipEl.style.opacity = "0";
      return;
    }

    // Set Text
    if (tooltipModel.body) {
      const titleLines = tooltipModel.title || [];
      const bodyLines = tooltipModel.body.map((body, index) => {
        const dataPoint = tooltipModel.dataPoints?.[index];
        const formula = context.tooltip.options.formulas?.[dataPoint?.datasetIndex];
        return formatTooltipBodyLine(body.lines[0], dataPoint, index, formula);
      });
      const isCategoryChart = context.tooltip.options.isCategoryChart;
      tooltipEl.replaceChildren(
        generateTooltipContent(titleLines, bodyLines, tooltipModel.labelColors, isCategoryChart)
      );
    }

    // Get window dimensions
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Get positions
    const position = context.chart.canvas.getBoundingClientRect();
    const tooltipWidth = tooltipEl.offsetWidth;
    const tooltipHeight = tooltipEl.offsetHeight;
    
    const cursorX = position.left + window.pageXOffset + tooltipModel.caretX;
    const cursorY = position.top + window.pageYOffset + tooltipModel.caretY;

    // Position tooltip with transition
    tooltipEl.style.transition = "all 150ms ease-out";

    // Check chart type
    const chartType = context.chart.config.type;
    const isCircularChart = ["pie", "doughnut", "polarArea", "radar"].includes(chartType);
    const isHorizontalBar = chartType === "bar" && context.chart.options.indexAxis === "y";

    const spacing = 15;

    if (isCircularChart) {
      // For circular charts (pie, doughnut, polar, radar), position relative to cursor
      const spaceBelow = windowHeight - (cursorY + tooltipHeight + spacing);
      const spaceRight = windowWidth - (cursorX + tooltipWidth + spacing);

      if (spaceBelow > 0 && spaceRight > 0) {
        // Enough space below and right - position to bottom right
        tooltipEl.style.left = (cursorX + spacing) + "px";
        tooltipEl.style.top = (cursorY + spacing) + "px";
      } else if (spaceBelow > 0) {
        // Only space below - position to bottom left
        tooltipEl.style.left = (cursorX - tooltipWidth - spacing) + "px";
        tooltipEl.style.top = (cursorY + spacing) + "px";
      } else if (spaceRight > 0) {
        // Only space right - position to top right
        tooltipEl.style.left = (cursorX + spacing) + "px";
        tooltipEl.style.top = (cursorY - tooltipHeight - spacing) + "px";
      } else {
        // Position to top left
        tooltipEl.style.left = (cursorX - tooltipWidth - spacing) + "px";
        tooltipEl.style.top = (cursorY - tooltipHeight - spacing) + "px";
      }
      tooltipEl.style.transform = "translateZ(0)";
    } else if (isHorizontalBar) {
      // For horizontal bar charts, position tooltip above/below the cursor
      const spaceBelow = windowHeight - (cursorY + tooltipHeight + spacing);
      
      tooltipEl.style.left = cursorX + "px";
      tooltipEl.style.transform = "translateX(-50%) translateZ(0)";
      
      if (spaceBelow > 0) {
        tooltipEl.style.top = (cursorY + spacing) + "px";
      } else {
        tooltipEl.style.top = (cursorY - tooltipHeight - spacing) + "px";
      }
    } else {
      // For vertical bar charts and line charts, position tooltip left/right of cursor
      const spaceOnRight = windowWidth - (cursorX + tooltipWidth + spacing);
      
      if (spaceOnRight > 0) {
        tooltipEl.style.left = (cursorX + spacing) + "px";
        tooltipEl.style.transform = "translateY(-50%) translateZ(0)";
      } else {
        tooltipEl.style.left = (cursorX - tooltipWidth - spacing) + "px";
        tooltipEl.style.transform = "translateY(-50%) translateZ(0)";
      }
      
      tooltipEl.style.top = cursorY + "px";
    }
    
    // Add a small delay before showing the tooltip
    requestAnimationFrame(() => {
      tooltipEl.style.opacity = "1";
    });
  }
}; 
