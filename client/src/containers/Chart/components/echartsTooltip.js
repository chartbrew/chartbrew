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
  const rounded = Math.round(number * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

export function isDoughnutChart(option) {
  const series = option?.series;
  if (!Array.isArray(series) || series.length === 0) return false;
  if (series.some((item) => item?.type === "gauge")) return false;
  return series[0]?.type === "pie" && Array.isArray(series[0].radius);
}

export function buildDoughnutValueTitle(value) {
  const displayValue = typeof value === "number"
    ? value.toLocaleString()
    : escapeRichText(value);
  return `{value|${displayValue}}`;
}

export function buildDoughnutHoverTitle({ name, percent, value }) {
  const displayValue = typeof value === "number"
    ? value.toLocaleString()
    : escapeRichText(value);
  return `{label|${escapeRichText(name)}}\n{value|${displayValue}}\n{percent|${formatDoughnutPercent(percent)}}`;
}

export function getDoughnutSliceFromChart(instance, params) {
  const dataIndex = Number.isInteger(params?.dataIndex)
    ? params.dataIndex
    : params?.batch?.find((item) => Number.isInteger(item.dataIndex))?.dataIndex;
  const option = instance.getOption();
  const dataset = Array.isArray(option.dataset) ? option.dataset[0] : option.dataset;
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
    name: row?.category ?? row?.[1] ?? params?.name ?? params?.data?.category ?? "",
    percent: total > 0 ? (value / total) * 100 : 0,
    value,
  };
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

export function createEChartsTooltipFormatter(colors, { compact = false, doughnutNameOnly } = {}) {
  return (input) => {
    const params = (Array.isArray(input) ? input : [input]).filter(Boolean);
    if (params.length === 0) return "";

    const first = params[0];
    if (first.seriesType === "pie" && (`${first.seriesId || ""}`.endsWith("-ranges") || doughnutNameOnly)) {
      return heading(first.name, colors.text);
    }

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
      compact,
      doughnutNameOnly: isDoughnutChart(option),
    }),
    padding: compact ? [4, 6] : [7, 9],
    textStyle: {
      color: colors.text,
      fontSize: 11,
      fontWeight: 400,
    },
  };
}
