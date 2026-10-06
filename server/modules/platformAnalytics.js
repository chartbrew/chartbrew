const { Op, col, fn, literal } = require("sequelize");

const db = require("../models/models");
const { chartColors, Colors } = require("../charts/colors");
const { VisualizationEngine } = require("../visualization/VisualizationEngine");

function renderAnalytics(mark, data, measures) {
  const result = new VisualizationEngine({
    chart: {
      name: "Requests",
      type: mark,
      displayLegend: mark !== "kpi" && measures.length > 1,
      includeZeros: false,
      timeInterval: "day",
      visualization: {
        version: 2,
        status: "ready",
        settings: {
          timeInterval: "day",
          missingValues: { policy: "gap" },
          legend: { visible: mark !== "kpi" && measures.length > 1 },
        },
        layers: measures.map(({ field, name, color, formula }) => ({
          id: field,
          bindingId: "requests",
          mark,
          name,
          style: { color, ...(mark === "line" ? { pointRadius: 3 } : {}) },
          encoding: {
            ...(mark !== "kpi" ? { time: { field: "root[].date", type: "temporal" } } : {}),
            value: {
              field: `root[].${field}`,
              type: "quantitative",
              aggregate: "none",
              ...(mark === "kpi" ? { formula } : {}),
              nullPolicy: "preserve",
            },
          },
        })),
      },
    },
    datasets: [{ data, options: { id: "requests" } }],
    timezone: "UTC",
  }).render();
  return { configuration: result.configuration };
}

async function getAiAnalytics(from, now, dates, teamId) {
  const quote = (name) => db.sequelize.getQueryInterface().queryGenerator.quoteIdentifier(name);
  const created = quote("createdAt");
  const day = literal(db.sequelize.getDialect() === "postgres"
    ? `DATE(${created} AT TIME ZONE 'UTC')` : `DATE(${created})`);
  const tokens = ["prompt_tokens", "completion_tokens", "total_tokens"];
  const rows = await db.AiUsage.findAll({
    attributes: [
      [day, "day"], "provider", "model", "usage_status",
      [fn("COUNT", col("id")), "count"],
      ...tokens.map((field) => [fn("SUM", col(field)), field]),
    ],
    where: {
      ...(teamId !== undefined ? { team_id: teamId } : {}),
      createdAt: { [Op.gte]: from, [Op.lt]: now },
      [Op.or]: [
        { usage_status: { [Op.in]: ["reported", "unknown", "pending"] } },
        { usage_status: "legacy", [Op.or]: tokens.map((field) => ({ [field]: { [Op.gt]: 0 } })) },
      ],
    },
    group: [day, "provider", "model", "usage_status"],
    raw: true,
  });
  const empty = { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, unknown: 0, pending: 0, legacy: 0 };
  const summary = { ...empty };
  const daily = dates.map((date) => ({ date, ...empty }));
  const byDay = new Map(daily.map((item) => [item.date.slice(0, 10), item]));
  const models = new Map();
  rows.forEach((row) => {
    const key = JSON.stringify([row.provider, row.model]);
    if (!models.has(key)) models.set(key, { provider: row.provider, model: row.model, ...empty });
    const totals = [summary, byDay.get(row.day), models.get(key)];
    totals.forEach((item) => {
      const count = Number(row.count);
      if (row.usage_status === "pending") {
        item.pending += count;
        return;
      }
      item.calls += count;
      if (row.usage_status === "unknown") {
        item.unknown += count;
        return;
      }
      if (row.usage_status === "legacy") item.legacy += count;
      tokens.forEach((field) => { item[field] += Number(row[field]); });
    });
  });
  const tokenMeasures = [
    { field: "prompt_tokens", name: "Input tokens", color: chartColors.blue.hex },
    { field: "completion_tokens", name: "Output tokens", color: chartColors.teal.hex },
  ];
  const calls = { field: "calls", name: "AI calls", color: chartColors.blue.hex };
  const tokenChart = renderAnalytics("bar", daily, tokenMeasures);
  const tokenOption = tokenChart.configuration;
  tokenOption.grid.top = 64;
  tokenOption.media.forEach(({ option }) => { option.grid.top = 64; });
  tokenOption.yAxis = tokenMeasures.map((measure, index) => ({
    ...tokenOption.yAxis,
    name: measure.name,
    nameTextStyle: { color: measure.color, align: index === 0 ? "left" : "right" },
    position: index === 0 ? "left" : "right",
    min: 0,
    axisLabel: { ...tokenOption.yAxis.axisLabel, color: measure.color },
    splitLine: { show: index === 0 },
  }));
  tokenOption.series[1].yAxisIndex = 1;

  return {
    summary,
    daily,
    models: [...models.values()].sort((a, b) => b.total_tokens - a.total_tokens || b.calls - a.calls || a.model.localeCompare(b.model)),
    metrics: renderAnalytics("kpi", [summary], [
      calls, { field: "total_tokens", name: "Total tokens" }, ...tokenMeasures,
    ]).configuration.items,
    charts: {
      tokens: tokenChart,
      calls: renderAnalytics("line", daily, [calls]),
    },
  };
}

async function getAnalytics(days = "30", now = new Date(), teamId) {
  if (typeof days !== "string" || !["7", "30", "90"].includes(days)) {
    throw Object.assign(new Error("Choose 7, 30, or 90 days."), { statusCode: 400 });
  }

  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - Number(days) + 1);

  const quote = (name) => db.sequelize.getQueryInterface().queryGenerator.quoteIdentifier(name);
  const finished = quote("finishedAt");
  const started = quote("startedAt");
  const postgres = db.sequelize.getDialect() === "postgres";
  const day = literal(postgres ? `DATE(${finished} AT TIME ZONE 'UTC')` : `DATE(${finished})`);
  const elapsed = postgres
    ? `EXTRACT(EPOCH FROM (${finished} - ${started})) * 1000`
    : `TIMESTAMPDIFF(MICROSECOND, ${started}, ${finished}) / 1000`;
  const duration = literal(`CASE WHEN ${finished} >= ${started} THEN ${elapsed} ELSE NULL END`);
  const rows = await db.SourceExecution.findAll({
    attributes: [
      [day, "day"], "status",
      [fn("COUNT", col("id")), "count"],
      [fn("SUM", duration), "durationMs"],
      [fn("COUNT", duration), "timedCount"],
    ],
    where: {
      ...(teamId !== undefined ? { teamId } : {}),
      cacheHit: false,
      status: { [Op.in]: ["success", "failed"] },
      finishedAt: { [Op.gte]: from, [Op.lt]: now },
    },
    group: [day, "status"],
    raw: true,
  });

  const daily = Array.from({ length: Number(days) }, (_, index) => ({
    date: new Date(from.getTime() + index * 86400000).toISOString(),
    successful: 0,
    failed: 0,
    durationMs: 0,
    timedCount: 0,
  }));
  const byDay = new Map(daily.map((item) => [item.date.slice(0, 10), item]));
  const totals = { successful: 0, failed: 0, durationMs: 0, timedCount: 0 };
  rows.forEach((row) => {
    const field = row.status === "success" ? "successful" : "failed";
    const item = byDay.get(row.day);
    item[field] += Number(row.count);
    item.durationMs += Number(row.durationMs);
    item.timedCount += Number(row.timedCount);
    totals[field] += Number(row.count);
    totals.durationMs += Number(row.durationMs);
    totals.timedCount += Number(row.timedCount);
  });

  const meanSeconds = (item) => item.timedCount ? item.durationMs / item.timedCount / 1000 : null;
  const completed = totals.successful + totals.failed;
  const summary = {
    successful: totals.successful,
    failed: totals.failed,
    successRate: completed ? totals.successful / completed * 100 : null,
    meanSeconds: meanSeconds(totals),
  };
  const points = daily.map((item) => ({
    date: item.date,
    successful: item.successful,
    failed: item.failed,
    meanSeconds: meanSeconds(item),
  }));
  const outcomes = [
    { field: "successful", name: "Successful requests", color: chartColors.blue.hex },
    { field: "failed", name: "Failed requests", color: Colors.negative },
  ];
  const durationMeasure = { field: "meanSeconds", name: "Mean request time", color: chartColors.teal.hex, formula: "{val} s" };

  return {
    from: from.toISOString(),
    to: now.toISOString(),
    days: Number(days),
    summary,
    daily: points,
    metrics: renderAnalytics("kpi", [summary], [
      ...outcomes,
      { field: "successRate", name: "Success rate", formula: "{val}%" },
      durationMeasure,
    ]).configuration.items,
    charts: {
      outcomes: renderAnalytics("bar", points, outcomes),
      duration: renderAnalytics("line", points, [durationMeasure]),
    },
    ai: await getAiAnalytics(from, now, points.map((item) => item.date), teamId),
  };
}

function getPlatformAnalytics(days, now) {
  return getAnalytics(days, now);
}

async function getTeamAnalytics(teamId, days, now) {
  if (!Number.isSafeInteger(teamId) || teamId <= 0) {
    throw Object.assign(new Error("Choose a valid team."), { statusCode: 400 });
  }

  const analytics = await getAnalytics(days, now, teamId);
  delete analytics.ai.models;
  return analytics;
}

module.exports = { getPlatformAnalytics, getTeamAnalytics };
