const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getValue(param) {
  if (param?.data && !Array.isArray(param.data) && param.data.value !== undefined) {
    return param.data.value;
  }
  if (!Array.isArray(param?.value)) return param?.value;

  const encodedIndexes = [
    ...(param.encode?.y || []),
    ...(param.encode?.x || []),
    ...(param.encode?.value || []),
  ];
  const valueIndex = encodedIndexes.find((index) => {
    return typeof param.value[index] === "number";
  });
  return valueIndex === undefined ? param.value.at(-1) : param.value[valueIndex];
}

function marker(color) {
  return `<span style="display:inline-block;width:7px;height:7px;border-radius:999px;`
    + `background:${escapeHtml(color || "#a1a1aa")};flex:none"></span>`;
}

function heading(text, color) {
  if (text === null || text === undefined || text === "") return "";
  return `<div style="color:${color};font-size:11px;font-weight:400;line-height:16px;`
    + `margin-bottom:3px;white-space:nowrap">${escapeHtml(text)}</div>`;
}

function row(label, value, color, textColor, mutedColor) {
  return `<div style="display:flex;align-items:center;gap:6px;min-width:112px;`
    + `font-size:11px;font-weight:400;line-height:16px">${marker(color)}`
    + `<span style="color:${mutedColor};font-weight:400;white-space:nowrap">`
    + `${escapeHtml(label)}</span><span style="color:${textColor};font-family:${MONO_FONT};`
    + `font-size:11px;font-weight:400;margin-left:auto;padding-left:8px;white-space:nowrap">`
    + `${escapeHtml(value)}</span></div>`;
}

function getMatrixHeading(param) {
  const data = param?.data || {};
  if (data.date) return data.date;
  if (data.columnLabel && data.rowLabel) return `${data.columnLabel} · ${data.rowLabel}`;
  return data.columnLabel || data.rowLabel || param?.name;
}

function escapeRichText(value) {
  return `${value ?? ""}`.replace(/[{}|]/g, "");
}

export function formatDoughnutPercent(percent) {
  const number = Number(percent);
  if (!Number.isFinite(number)) return "";
  const rounded = Math.round(number * 100) / 100;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function isCategoryPieChart(option) {
  const series = option?.series;
  if (!Array.isArray(series) || series.length === 0) return false;
  if (series.some((item) => item?.type === "gauge")) return false;
  return series.some((item) => item?.type === "pie"
    && !`${item.id || ""}`.endsWith("-ranges"));
}

export function isDoughnutChart(option) {
  if (!isCategoryPieChart(option)) return false;
  return option.series.some((item) => item?.type === "pie" && Array.isArray(item.radius));
}

export function buildDoughnutValueTitle(value) {
  const displayValue = typeof value === "number"
    ? value.toLocaleString()
    : escapeRichText(value);
  return `{value|${displayValue}}`;
}

export function buildDoughnutHoverTitle({ formattedPercent, formattedValue, name, percent, value }) {
  const displayValue = formattedValue || (typeof value === "number"
    ? value.toLocaleString()
    : escapeRichText(value));
  return `{marker|●} {label|${escapeRichText(name)}}\n{value|${escapeRichText(displayValue)}}\n{percent|${escapeRichText(formattedPercent || formatDoughnutPercent(percent))}}`;
}

export function getDoughnutSliceFromChart(instance, params) {
  const dataIndex = Number.isInteger(params?.dataIndex)
    ? params.dataIndex
    : params?.batch?.find((item) => Number.isInteger(item.dataIndex))?.dataIndex;
  const seriesIndex = Number.isInteger(params?.seriesIndex)
    ? params.seriesIndex
    : params?.batch?.find((item) => Number.isInteger(item.seriesIndex))?.seriesIndex || 0;
  const option = instance.getOption();
  const series = Array.isArray(option.series) ? option.series[seriesIndex] : option.series;
  const datasetIndex = Number(series?.datasetIndex) || 0;
  const dataset = Array.isArray(option.dataset) ? option.dataset[datasetIndex] : option.dataset;
  const source = dataset?.source;
  const row = Number.isInteger(dataIndex) && Array.isArray(source) ? source[dataIndex] : null;
  const rawValue = row?.value
    ?? (Array.isArray(row) ? row[2] : undefined)
    ?? params?.data?.value
    ?? (typeof params?.value === "number" ? params.value : undefined);
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return null;
  const total = Array.isArray(source)
    ? source.reduce((sum, item) => sum + (Number(item?.value ?? item?.[2]) || 0), 0)
    : 0;
  return {
    ...(params?.color || option.color?.[dataIndex % (option.color?.length || 1)] ? {
      color: params?.color || option.color?.[dataIndex % (option.color?.length || 1)],
    } : {}),
    ...(row?.formattedValue ? { formattedValue: row.formattedValue } : {}),
    ...(row?.formattedPercent ? { formattedPercent: row.formattedPercent } : {}),
    name: row?.category ?? row?.[1] ?? params?.name ?? params?.data?.category ?? "",
    percent: total > 0 ? (value / total) * 100 : 0,
    value,
  };
}

export function getCategoryBreakdownItems(option) {
  const series = Array.isArray(option?.series) ? option.series : [];
  const datasets = Array.isArray(option?.dataset) ? option.dataset : [option?.dataset];
  const colors = Array.isArray(option?.color) ? option.color : [];

  return series.flatMap((item, seriesIndex) => {
    if (item?.type !== "pie" || `${item.id || ""}`.endsWith("-ranges")) return [];
    const dataset = datasets[Number(item.datasetIndex) || 0];
    const source = Array.isArray(dataset?.source) ? dataset.source : [];
    const total = source.reduce((sum, row) => {
      return sum + (Number(row?.value ?? row?.[2]) || 0);
    }, 0);

    return source.map((row, dataIndex) => {
      const value = Number(row?.value ?? row?.[2]) || 0;
      const name = row?.category ?? row?.[1] ?? "";
      return {
        color: row?.itemStyle?.color || colors[dataIndex % Math.max(1, colors.length)] || "#a1a1aa",
        dataIndex,
        formattedPercent: row?.formattedPercent || formatDoughnutPercent(
          total > 0 ? (value / total) * 100 : 0
        ),
        formattedValue: row?.formattedValue || value.toLocaleString(),
        key: `${seriesIndex}:${dataIndex}`,
        name: `${name}`,
        seriesIndex,
        value,
      };
    });
  });
}

function trimLabel(value, maxLength = 18) {
  const label = `${value ?? ""}`;
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

function categoryLine(param, colors) {
  const value = param?.data?.formattedValue ?? getValue(param);
  const percent = param?.data?.formattedPercent ?? formatDoughnutPercent(param?.percent);
  return `<div style="display:flex;align-items:center;gap:5px;font-size:11px;`
    + `font-weight:400;line-height:16px;white-space:nowrap">${marker(param.color)}`
    + `<span style="color:${colors.muted}">${escapeHtml(trimLabel(param.name))}:</span>`
    + `<span style="color:${colors.text};font-family:${MONO_FONT}">${escapeHtml(value)}</span>`
    + `<span style="color:${colors.muted};font-family:${MONO_FONT}">${escapeHtml(percent)}</span></div>`;
}

function categoryMetricRow(label, value, colors) {
  return `<div style="display:flex;align-items:center;gap:6px;min-width:112px;`
    + `font-size:11px;font-weight:400;line-height:16px">`
    + `<span style="color:${colors.muted};font-weight:400;white-space:nowrap">`
    + `${escapeHtml(label)}</span><span style="color:${colors.text};font-family:${MONO_FONT};`
    + `font-size:11px;font-weight:400;margin-left:auto;padding-left:8px;white-space:nowrap">`
    + `${escapeHtml(value)}</span></div>`;
}

function categoryTooltip(param, colors, compact) {
  if (compact) return categoryLine(param, colors);
  const value = param?.data?.formattedValue ?? getValue(param);
  const percent = param?.data?.formattedPercent ?? formatDoughnutPercent(param.percent);
  const title = `<div style="display:flex;align-items:center;gap:5px;color:${colors.text};`
    + `font-size:11px;font-weight:400;line-height:16px;margin-bottom:3px;white-space:nowrap">`
    + `${marker(param.color)}${escapeHtml(param.name)}</div>`;
  return title
    + categoryMetricRow("Value", value, colors)
    + categoryMetricRow("Percent", percent, colors);
}

function compactLine(title, items, textColor, mutedColor) {
  const values = items.map((param) => {
    const value = `<span style="color:${textColor};font-family:${MONO_FONT}">${escapeHtml(getValue(param))}</span>`;
    if (items.length === 1) return value;
    return `<span style="display:inline-flex;align-items:center;gap:4px">${marker(param.color)}${value}</span>`;
  }).join("<span style=\"padding:0 4px\">·</span>");
  const prefix = title
    ? `<span style="color:${mutedColor}">${escapeHtml(title)}: </span>`
    : "";
  return `<div style="font-size:11px;font-weight:400;line-height:16px;`
    + `white-space:nowrap">${prefix}${values}</div>`;
}

export function createEChartsTooltipFormatter(colors, { category = false, compact = false } = {}) {
  return (input) => {
    const params = (Array.isArray(input) ? input : [input]).filter(Boolean);
    if (params.length === 0) return "";

    const first = params[0];
    if (first.seriesType === "pie" && `${first.seriesId || ""}`.endsWith("-ranges")) {
      return heading(first.name, colors.text);
    }
    if (category && first.seriesType === "pie") return categoryTooltip(first, colors, compact);

    const isMatrix = first.seriesType === "heatmap";
    const title = isMatrix
      ? getMatrixHeading(first)
      : first.axisValueLabel ?? first.name;
    const items = isMatrix ? [first] : params;
    if (compact) return compactLine(title, items, colors.text, colors.muted);

    return heading(title, colors.text) + items.map((param) => row(
      param.seriesName || "Value",
      getValue(param),
      param.color,
      colors.text,
      colors.muted
    )).join("");
  };
}

export function getEChartsTooltipOption(option, colors, { compact = false } = {}) {
  return {
    ...(option.tooltip || {}),
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    confine: true,
    enterable: false,
    extraCssText: `border-radius:8px;box-shadow:${colors.shadow};`,
    formatter: createEChartsTooltipFormatter(colors, {
      category: isCategoryPieChart(option),
      compact,
    }),
    padding: compact ? [4, 6] : [7, 9],
    textStyle: {
      color: colors.text,
      fontSize: 11,
      fontWeight: 400,
    },
  };
}
