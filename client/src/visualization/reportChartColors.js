export function applyReportChartColors(option, colors) {
  if (!colors) return option;
  const map = (value, transform) => Array.isArray(value) ? value.map(transform) : transform(value);
  const axis = (value) => ({
    ...value,
    axisLabel: { ...value?.axisLabel, color: colors.text },
    nameTextStyle: { ...value?.nameTextStyle, color: colors.mutedText },
    axisLine: { ...value?.axisLine, lineStyle: { ...value?.axisLine?.lineStyle, color: colors.border } },
    splitLine: { ...value?.splitLine, lineStyle: { ...value?.splitLine?.lineStyle, color: colors.border } },
  });
  const result = { ...option, textStyle: { ...option.textStyle, color: colors.text } };
  for (const key of ["xAxis", "yAxis", "radiusAxis", "angleAxis"]) {
    if (option[key]) result[key] = map(option[key], axis);
  }
  if (option.title) result.title = map(option.title, (title) => ({
    ...title, textStyle: { ...title.textStyle, color: colors.text },
    subtextStyle: { ...title.subtextStyle, color: colors.mutedText },
  }));
  if (option.legend) result.legend = map(option.legend, (legend) => ({
    ...legend, textStyle: { ...legend.textStyle, color: colors.text },
  }));
  return result;
}
