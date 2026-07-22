const FONT_SIZE = 10;
const FONT_LINE_HEIGHT = 1.2;
const LABEL_PADDING = 4;
const LABEL_SAFETY_GAP = 2;

const getLabelValue = (context, meta) => {
  const valueAxis = meta?.vScale?.axis || (meta?.data?.[context.dataIndex]?.horizontal ? "x" : "y");
  const parsedValue = meta?.controller?.getParsed(context.dataIndex)?.[valueAxis];

  if (Number.isFinite(Number(parsedValue))) return Number(parsedValue);

  const rawValue = context.dataset?.data?.[context.dataIndex];
  return Number.isFinite(Number(rawValue)) ? Number(rawValue) : null;
};

const measureLabelWidth = (context, label) => {
  const canvasContext = context.chart?.ctx;
  if (!canvasContext?.measureText) return label.length * FONT_SIZE * 0.6;

  canvasContext.save();
  canvasContext.font = `${FONT_SIZE}px Inter`;
  const width = canvasContext.measureText(label).width;
  canvasContext.restore();
  return width;
};

export const getBarDataLabelDisplay = (context) => {
  const meta = context.chart?.getDatasetMeta?.(context.datasetIndex);
  const element = meta?.data?.[context.dataIndex];
  const value = getLabelValue(context, meta);
  const roundedValue = Math.round(value);

  if (!Number.isFinite(value) || roundedValue === 0 || !element) return false;

  const width = Math.abs(Number(element.width) || 0);
  const height = Math.abs(Number(element.height) || 0);
  const labelWidth = measureLabelWidth(context, String(roundedValue));
  const requiredWidth = labelWidth + (LABEL_PADDING * 2) + LABEL_SAFETY_GAP;
  const requiredHeight = (FONT_SIZE * FONT_LINE_HEIGHT) + (LABEL_PADDING * 2) + LABEL_SAFETY_GAP;

  if (width < requiredWidth || height < requiredHeight) return false;

  return true;
};
