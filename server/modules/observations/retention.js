const { Op } = require("sequelize");

const db = require("../../models/models");

const DAY_MS = 24 * 60 * 60 * 1000;

function parseRetentionNumber(value, fallback, minimum = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum) return fallback;
  return parsed;
}

function normalizeRetentionOptions(options = {}) {
  return {
    auditDays: parseRetentionNumber(options.auditDays, 90),
    batchSize: parseRetentionNumber(options.batchSize, 1000, 1),
    dryRun: Boolean(options.dryRun),
    evaluationDays: parseRetentionNumber(options.evaluationDays, 730),
    limit: options.limit === undefined
      ? null
      : parseRetentionNumber(options.limit, null, 1),
    maxRuntimeSeconds: parseRetentionNumber(options.maxRuntimeSeconds, 300, 1),
    rawSnapshotDays: parseRetentionNumber(options.rawSnapshotDays, 90),
    resolvedObservationDays: parseRetentionNumber(options.resolvedObservationDays, 365),
    rollupDays: parseRetentionNumber(options.rollupDays, 730),
  };
}

function cutoffDate(days, now = new Date()) {
  return new Date(now.getTime() - (days * DAY_MS));
}

function utcDayRange(date) {
  const start = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
  return {
    end: new Date(start.getTime() + DAY_MS - 1),
    start,
  };
}

async function countCategory(Model, where, dateField) {
  const [matched, oldest] = await Promise.all([
    Model.count({ where }),
    Model.findOne({
      attributes: [dateField],
      order: [[dateField, "ASC"], ["id", "ASC"]],
      where,
    }),
  ]);
  return {
    matched,
    oldest: oldest?.[dateField] || null,
  };
}

async function destroyInBatches({
  Model,
  batchSize,
  deadline,
  limit,
  transaction,
  where,
}) {
  let batches = 0;
  let deleted = 0;
  while (Date.now() < deadline) {
    const remaining = limit === null ? batchSize : limit - deleted;
    if (remaining <= 0) break;
    // oxlint-disable-next-line no-await-in-loop
    const rows = await Model.findAll({
      attributes: ["id"],
      limit: Math.min(batchSize, remaining),
      order: [["id", "ASC"]],
      where,
    });
    if (rows.length === 0) break;
    const ids = rows.map((row) => row.id);
    // oxlint-disable-next-line no-await-in-loop
    const count = await Model.destroy({
      transaction,
      where: { id: { [Op.in]: ids } },
    });
    deleted += count;
    batches += 1;
    if (count === 0 || rows.length < Math.min(batchSize, remaining)) break;
  }
  return { batches, deleted };
}

function groupRawSnapshots(snapshots) {
  return snapshots.reduce((groups, snapshot) => {
    const range = utcDayRange(snapshot.period_end);
    const key = [
      snapshot.monitor_id,
      snapshot.definition_fingerprint,
      range.start.toISOString(),
    ].join(":");
    const group = groups.get(key) || {
      completenessTotal: 0,
      count: 0,
      definitionFingerprint: snapshot.definition_fingerprint,
      monitorId: snapshot.monitor_id,
      range,
      sampleCount: 0,
      teamId: snapshot.team_id,
      valueTotal: 0,
    };
    const sampleCount = Math.max(Number(snapshot.sample_count) || 1, 1);
    group.completenessTotal += (Number(snapshot.completeness) || 0) * sampleCount;
    group.count += 1;
    group.sampleCount += sampleCount;
    group.valueTotal += Number(snapshot.value) * sampleCount;
    groups.set(key, group);
    return groups;
  }, new Map());
}

async function upsertDailyRollup(group, transaction) {
  const where = {
    definition_fingerprint: group.definitionFingerprint,
    granularity: "day",
    monitor_id: group.monitorId,
    period_end: group.range.end,
    period_start: group.range.start,
    rollup: "daily",
  };
  const [rollup, created] = await db.MetricSnapshot.findOrCreate({
    defaults: {
      completeness: group.completenessTotal / group.sampleCount,
      sample_count: group.sampleCount,
      team_id: group.teamId,
      value: group.valueTotal / group.sampleCount,
    },
    transaction,
    where,
  });
  if (!created) {
    const totalSamples = rollup.sample_count + group.sampleCount;
    await rollup.update({
      completeness: (
        (rollup.completeness * rollup.sample_count) + group.completenessTotal
      ) / totalSamples,
      sample_count: totalSamples,
      value: ((rollup.value * rollup.sample_count) + group.valueTotal) / totalSamples,
    }, { transaction });
  }
}

async function rollupRawSnapshots(options, cutoff, deadline) {
  let batches = 0;
  let deleted = 0;
  let rolledUp = 0;
  while (Date.now() < deadline) {
    const remaining = options.limit === null ? options.batchSize : options.limit - deleted;
    if (remaining <= 0) break;
    // oxlint-disable-next-line no-await-in-loop
    const snapshots = await db.MetricSnapshot.findAll({
      limit: Math.min(options.batchSize, remaining),
      order: [["period_end", "ASC"], ["id", "ASC"]],
      where: {
        period_end: { [Op.lt]: cutoff },
        rollup: { [Op.ne]: "daily" },
      },
    });
    if (snapshots.length === 0) break;
    const groups = groupRawSnapshots(snapshots);
    // oxlint-disable-next-line no-await-in-loop
    await db.sequelize.transaction(async (transaction) => {
      for (const group of groups.values()) {
        // oxlint-disable-next-line no-await-in-loop
        await upsertDailyRollup(group, transaction);
      }
      await db.MetricSnapshot.destroy({
        transaction,
        where: { id: { [Op.in]: snapshots.map((snapshot) => snapshot.id) } },
      });
    });
    deleted += snapshots.length;
    rolledUp += groups.size;
    batches += 1;
    if (snapshots.length < Math.min(options.batchSize, remaining)) break;
  }
  return { batches, deleted, rolledUp };
}

async function cleanupObservationData(rawOptions = {}) {
  if (!db.MetricEvaluation || !db.MetricSnapshot || !db.Observation || !db.ObservationAudit) {
    return { disabled: true };
  }
  const options = normalizeRetentionOptions(rawOptions);
  const now = rawOptions.now || new Date();
  const cutoffs = {
    audits: cutoffDate(options.auditDays, now),
    evaluations: cutoffDate(options.evaluationDays, now),
    rawSnapshots: cutoffDate(options.rawSnapshotDays, now),
    resolvedObservations: cutoffDate(options.resolvedObservationDays, now),
    rollups: cutoffDate(options.rollupDays, now),
  };
  const where = {
    audits: { createdAt: { [Op.lt]: cutoffs.audits } },
    evaluations: { current_period_end: { [Op.lt]: cutoffs.evaluations } },
    rawSnapshots: {
      period_end: { [Op.lt]: cutoffs.rawSnapshots },
      rollup: { [Op.ne]: "daily" },
    },
    resolvedObservations: {
      resolved_at: { [Op.lt]: cutoffs.resolvedObservations },
      status: "resolved",
    },
    rollups: {
      period_end: { [Op.lt]: cutoffs.rollups },
      rollup: "daily",
    },
  };
  if (options.dryRun) {
    return {
      audits: options.auditDays === 0
        ? { disabled: true }
        : await countCategory(db.ObservationAudit, where.audits, "createdAt"),
      dryRun: true,
      evaluations: options.evaluationDays === 0
        ? { disabled: true }
        : await countCategory(db.MetricEvaluation, where.evaluations, "current_period_end"),
      rawSnapshots: options.rawSnapshotDays === 0
        ? { disabled: true }
        : await countCategory(db.MetricSnapshot, where.rawSnapshots, "period_end"),
      resolvedObservations: options.resolvedObservationDays === 0
        ? { disabled: true }
        : await countCategory(db.Observation, where.resolvedObservations, "resolved_at"),
      rollups: options.rollupDays === 0
        ? { disabled: true }
        : await countCategory(db.MetricSnapshot, where.rollups, "period_end"),
    };
  }

  const startedAt = Date.now();
  const deadline = startedAt + (options.maxRuntimeSeconds * 1000);
  const report = {};
  if (options.rawSnapshotDays !== 0) {
    report.rawSnapshots = await rollupRawSnapshots(
      options,
      cutoffs.rawSnapshots,
      deadline,
    );
  } else {
    report.rawSnapshots = { disabled: true };
  }
  const categories = [
    ["evaluations", db.MetricEvaluation, where.evaluations, options.evaluationDays],
    ["rollups", db.MetricSnapshot, where.rollups, options.rollupDays],
    ["audits", db.ObservationAudit, where.audits, options.auditDays],
    [
      "resolvedObservations",
      db.Observation,
      where.resolvedObservations,
      options.resolvedObservationDays,
    ],
  ];
  for (const [name, Model, categoryWhere, days] of categories) {
    if (days === 0) {
      report[name] = { disabled: true };
    } else {
      // oxlint-disable-next-line no-await-in-loop
      report[name] = await destroyInBatches({
        Model,
        batchSize: options.batchSize,
        deadline,
        limit: options.limit,
        where: categoryWhere,
      });
    }
  }
  report.runtimeMs = Date.now() - startedAt;
  return report;
}

module.exports = {
  cleanupObservationData,
  cutoffDate,
  groupRawSnapshots,
  normalizeRetentionOptions,
  utcDayRange,
};
