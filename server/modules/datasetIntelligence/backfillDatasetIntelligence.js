const { Op } = require("sequelize");

const db = require("../../models/models");
const { getPlatformIntelligencePolicy } = require("../platformSettings/runtime");
const { profileDataset } = require("./profileDataset");

async function backfillDatasetIntelligence(
  { teamId, limit } = {},
  runProfileDataset = profileDataset
) {
  const hasTeamId = teamId !== undefined && teamId !== null && `${teamId}`.trim() !== "";
  const normalizedTeamId = hasTeamId ? Number(teamId) : null;
  if (hasTeamId && (!Number.isInteger(normalizedTeamId) || normalizedTeamId <= 0)) {
    throw new Error("teamId must be a positive integer");
  }
  const fallbackPolicy = getPlatformIntelligencePolicy().datasetIntelligence;
  const batchSize = Math.min(
    Math.max(Number.parseInt(limit, 10) || fallbackPolicy.backfillBatchSize, 1),
    fallbackPolicy.backfillBatchSize
  );
  const datasets = await db.Dataset.findAll({
    where: {
      draft: false,
      ...(normalizedTeamId ? { team_id: normalizedTeamId } : {}),
      [Op.or]: [
        { "$DatasetIntelligence.id$": null },
        { "$DatasetIntelligence.status$": { [Op.in]: ["pending", "stale", "failed"] } },
        { "$DatasetIntelligence.expires_at$": { [Op.lte]: new Date() } },
      ],
    },
    attributes: ["id", "team_id"],
    include: [{
      model: db.DatasetIntelligence,
      attributes: [],
      required: false,
    }],
    order: [["updatedAt", "DESC"]],
    limit: batchSize,
    subQuery: false,
  });
  const report = {
    attempted: datasets.length,
    ready: 0,
    disabled: 0,
    failed: 0,
  };

  const results = await Promise.all(datasets.map(async (dataset) => {
    try {
      return await runProfileDataset({
        datasetId: dataset.id,
        teamId: dataset.team_id,
        generationReason: "backfill",
      });
    } catch (error) {
      return { status: "failed" };
    }
  }));
  results.forEach((result) => {
    if (result.status === "disabled") report.disabled += 1;
    else if (result.status === "failed") report.failed += 1;
    else report.ready += 1;
  });

  return report;
}

module.exports = {
  backfillDatasetIntelligence,
};
