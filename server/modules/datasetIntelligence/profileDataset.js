const { withAiUsageContext } = require("../ai/usage");
const db = require("../../models/models");
const { sanitizeSnippet } = require("../updateAudit");
const { getIntelligencePolicy } = require("../intelligence/policy");
const { buildDatasetProfile } = require("./buildProfileEvidence");
const { enrichProfile } = require("./enrichProfile");
const {
  buildProfileFingerprints,
  createFingerprint,
} = require("./profileFingerprint");
const {
  summarizeProfileData,
  summarizeSampleData,
} = require("./inferFieldSemantics");
const { mergeOverrides, sanitizeOverrides } = require("./mergeOverrides");
const { serializeProfile, validateProfile } = require("./profileSchema");
const { recordIntelligenceEvent } = require("./observability");

const pendingProfileRuns = new Map();

function isExpired(record) {
  return !record?.expires_at || new Date(record.expires_at).getTime() <= Date.now();
}

function getProfileResponse(record, policy) {
  return {
    dataset_id: record.dataset_id,
    status: record.status === "ready" && isExpired(record) ? "stale" : record.status,
    version: record.version,
    generated_at: record.generated_at,
    expires_at: record.expires_at,
    profile: record.profile
      ? serializeProfile(record.profile, { maxFields: policy.maxFields })
      : null,
    overrides: sanitizeOverrides(record.overrides, {
      maxFields: policy.maxFields,
    }),
  };
}

async function loadDatasetEvidence(datasetId, teamId) {
  const dataset = await db.Dataset.findOne({
    where: { id: datasetId, team_id: teamId },
    include: [{
      model: db.DataRequest,
      attributes: [
        "id", "connection_id", "method", "route", "query", "configuration",
        "conditions", "transform", "variables",
      ],
    }, {
      model: db.ChartDatasetConfig,
      attributes: [
        "id", "xAxis", "xAxisOperation", "yAxis", "yAxisOperation",
        "dateField", "conditions",
      ],
      required: false,
      include: [{
        model: db.Chart,
        attributes: [
          "id", "project_id", "name", "type", "timeInterval",
          "autoUpdate", "visualization",
        ],
        required: false,
        include: [{
          model: db.Project,
          attributes: ["id", "name", "ghost"],
          required: false,
        }],
      }, {
        model: db.Alert,
        attributes: ["id", "type", "active"],
        required: false,
      }],
    }],
  });

  if (!dataset) throw new Error("Dataset not found");
  dataset.ChartDatasetConfigs = (dataset.ChartDatasetConfigs || [])
    .filter((cdc) => !cdc.Chart?.Project?.ghost);
  return dataset;
}

async function generateDatasetProfile({
  datasetId,
  teamId,
  sampleData,
  sampleSummary,
  force = false,
  generationReason = force ? "manual_refresh" : "lazy",
  throwOnFailure = false,
  policy: suppliedPolicy,
}) {
  const startedAt = Date.now();
  const resolvedPolicy = suppliedPolicy || await getIntelligencePolicy({ teamId });
  const policy = resolvedPolicy.datasetIntelligence;
  if (!policy.enabled) {
    return { dataset_id: datasetId, status: "disabled", profile: null };
  }

  const existing = await db.DatasetIntelligence.findOne({
    where: { dataset_id: datasetId, team_id: teamId },
  });

  try {
    const dataset = await loadDatasetEvidence(datasetId, teamId);
    const providedSampleSummary = sampleSummary || (
      sampleData !== undefined
        ? summarizeSampleData(sampleData, policy.maxSampleRows, policy.maxFields)
        : null
    );
    const effectiveSampleSummary = providedSampleSummary || (
      Object.keys(dataset.fieldsSchema || {}).length === 0
        ? summarizeProfileData(existing?.profile, policy.maxFields)
        : null
    );
    const sampleFingerprint = effectiveSampleSummary
      ? createFingerprint(effectiveSampleSummary)
      : null;
    const { profile: generatedProfile, fingerprintUsages } = buildDatasetProfile({
      dataset,
      sampleSummary: effectiveSampleSummary,
      policy,
    });
    if (!providedSampleSummary && effectiveSampleSummary) {
      generatedProfile.provenance.sampleGeneratedAt = (
        existing?.profile?.provenance?.sampleGeneratedAt || null
      );
    }
    const fingerprints = buildProfileFingerprints({
      dataset,
      dataRequests: dataset.DataRequests || [],
      usages: fingerprintUsages,
    });

    if (!force
      && existing?.status === "ready"
      && existing.fingerprint === fingerprints.fingerprint
      && (existing.profile?.provenance?.sampleFingerprint || null) === sampleFingerprint
      && !isExpired(existing)
    ) {
      recordIntelligenceEvent("generation_skipped", {
        datasetId,
        teamId,
        generationReason,
        durationMs: Date.now() - startedAt,
        profileStatus: "ready",
        status: "unchanged",
      });
      return getProfileResponse(existing, policy);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + policy.profileTtlHours * 60 * 60 * 1000);
    const currentOverrides = existing?.overrides || {};
    let profile = {
      ...generatedProfile,
      provenance: {
        ...generatedProfile.provenance,
        schemaFingerprint: fingerprints.schemaFingerprint,
        definitionFingerprint: fingerprints.definitionFingerprint,
        usageFingerprint: fingerprints.usageFingerprint,
        sampleFingerprint,
      },
    };

    if (policy.llmEnrichment) {
      try {
        profile = await withAiUsageContext({ teamId, activity: "background" }, () => enrichProfile(profile));
      } catch (error) {
        profile.quality.warnings.push({ code: "enrichment_unavailable" });
      }
    }

    const merged = mergeOverrides(profile, currentOverrides, {
      maxFields: policy.maxFields,
    });
    if (merged.orphanedFields.length > 0) {
      merged.profile.quality.warnings.push({
        code: "orphaned_overrides",
        count: merged.orphanedFields.length,
      });
    }
    validateProfile(merged.profile);

    const values = {
      team_id: teamId,
      version: merged.profile.version,
      status: "ready",
      fingerprint: fingerprints.fingerprint,
      profile: merged.profile,
      overrides: merged.overrides,
      generated_at: now,
      expires_at: expiresAt,
      last_error: null,
    };
    let savedRecord;
    if (existing) {
      savedRecord = await existing.update(values);
    } else {
      savedRecord = await db.DatasetIntelligence.create({
        dataset_id: datasetId,
        ...values,
      });
    }
    recordIntelligenceEvent("generation_completed", {
      datasetId,
      teamId,
      generationReason,
      durationMs: Date.now() - startedAt,
      fieldCount: Object.keys(merged.profile.fields || {}).length,
      sampleCount: merged.profile.quality?.rowCountSampled || 0,
      enriched: Boolean(merged.profile.provenance?.llmEnriched),
      profileStatus: "ready",
      status: "completed",
    });
    return getProfileResponse(savedRecord, policy);
  } catch (error) {
    const lastError = sanitizeSnippet(error?.message || error, 500);
    if (existing) {
      await existing.update({
        status: "failed",
        last_error: lastError,
      });
      recordIntelligenceEvent("generation_failed", {
        datasetId,
        teamId,
        generationReason,
        durationMs: Date.now() - startedAt,
        profileStatus: "failed",
        status: "failed",
      });
      if (throwOnFailure) throw error;
      return getProfileResponse(existing, policy);
    }

    await db.DatasetIntelligence.create({
      dataset_id: datasetId,
      team_id: teamId,
      version: 1,
      status: "failed",
      last_error: lastError,
    });
    recordIntelligenceEvent("generation_failed", {
      datasetId,
      teamId,
      generationReason,
      durationMs: Date.now() - startedAt,
      profileStatus: "failed",
      status: "failed",
    });
    throw error;
  }
}

function profileDataset(options) {
  const key = `${options.teamId}:${options.datasetId}`;
  if (pendingProfileRuns.has(key)) return pendingProfileRuns.get(key);

  const pending = generateDatasetProfile(options)
    .finally(() => pendingProfileRuns.delete(key));
  pendingProfileRuns.set(key, pending);
  return pending;
}

async function getDatasetIntelligenceRecord({ datasetId, teamId }) {
  const policy = (await getIntelligencePolicy({ teamId })).datasetIntelligence;
  if (!policy.enabled) return { dataset_id: datasetId, status: "disabled", profile: null };

  const record = await db.DatasetIntelligence.findOne({
    where: { dataset_id: datasetId, team_id: teamId },
  });
  if (!record) return { dataset_id: datasetId, status: "missing", profile: null };

  return getProfileResponse(record, policy);
}

module.exports = {
  getDatasetIntelligenceRecord,
  getProfileResponse,
  pendingProfileRuns,
  isExpired,
  loadDatasetEvidence,
  profileDataset,
};
