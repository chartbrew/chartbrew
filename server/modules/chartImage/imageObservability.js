function recordChartImageEvent(fields, logger) {
  const event = {
    chartId: fields.chartId || null,
    durationMs: Math.max(0, Math.round(Number(fields.durationMs) || 0)),
    errorCode: fields.errorCode || null,
    height: fields.height || null,
    layout: fields.layout || null,
    operationalCodes: Array.isArray(fields.operationalCodes)
      ? fields.operationalCodes.slice(0, 4)
      : [],
    outputBytes: Math.max(0, Number(fields.outputBytes) || 0),
    preset: fields.preset || null,
    projectId: fields.projectId || null,
    requestId: fields.requestId || null,
    success: Boolean(fields.success),
    teamId: fields.teamId || null,
    userId: fields.userId || null,
    width: fields.width || null,
  };
  if (logger) {
    logger(event);
  } else {
    console.info(JSON.stringify({ // oxlint-disable-line no-console
      event: "render",
      scope: "chart_image",
      ...event,
    }));
  }
  return event;
}

module.exports = {
  recordChartImageEvent,
};
