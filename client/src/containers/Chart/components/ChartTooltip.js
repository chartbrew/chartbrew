export const createTooltipElement = () => {
  const tooltipEl = document.createElement("div");
  tooltipEl.id = "chartjs-tooltip";
  tooltipEl.className = "absolute pointer-events-none opacity-0 min-w-[120px] bg-white dark:bg-gray-800 rounded-lg shadow-md px-1 transition-all duration-150 ease-out";
  document.body.appendChild(tooltipEl);
  return tooltipEl;
};

export const formatTotal = (value) => {
  // You can implement your own formatting function here
  return typeof value === "number" ? value.toLocaleString() : value;
};

export const generateTooltipContent = (titleLines, bodyLines, labelColors, isCategoryChart) => {
  let innerHtml = "<div class=\"py-1 px-1\">";
  
  // Add title (label)
  titleLines.forEach(title => {
    innerHtml += `<span class="font-medium text-gray-900 dark:text-gray-100 text-xs dark:border-gray-700 pb-1">${title}</span>`;
  });

  // Add all data points
  bodyLines.forEach((body, i) => {
    if (!body) return;
    
    const colors = labelColors[i];
    let category, value;

    // Handle different chart types and data formats
    if (typeof body === "string") {
      if (body.includes(":")) {
        [category, value] = body.split(":");
      } else {
        category = `Series ${i + 1}`;
        value = body;
      }
    } else {
      category = `Series ${i + 1}`;
      value = body;
    }
    
    // Trim whitespace from values
    category = (category || "").trim();
    value = (value || "").trim();
    
    // Use color based on chart type
    const colorStyle = isCategoryChart
      ? `background-color: ${colors.backgroundColor}`
      : `background-color: ${colors.borderColor}`;
    
    innerHtml += `
      <div class="flex w-full items-center gap-x-2">
        <div class="h-2 w-2 flex-none rounded-full" style="${colorStyle}"></div>
        <div class="flex w-full items-center justify-between gap-x-2 pr-1 text-xs">
          <span class="text-gray-500 dark:text-gray-400">${category}</span>
          <span class="font-mono font-medium text-gray-700 dark:text-gray-300">
            ${formatTotal(value)}
          </span>
        </div>
      </div>`;
  });
  
  innerHtml += "</div>";
  return innerHtml;
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
      const bodyLines = tooltipModel.body.map(b => b.lines[0]);
      const isCategoryChart = context.tooltip.options.isCategoryChart;
      tooltipEl.innerHTML = generateTooltipContent(titleLines, bodyLines, tooltipModel.labelColors, isCategoryChart);
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