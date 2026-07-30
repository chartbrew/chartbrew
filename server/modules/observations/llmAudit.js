const crypto = require("crypto");
const OpenAI = require("openai");
const { col, fn, Op } = require("sequelize");

const db = require("../../models/models");
const { getObservationPolicy } = require("./policy");

const AUDIT_VERSION = "observation-audit-v1";
const ALLOWED_REASON_CODES = new Set([
  "clear_baseline",
  "insufficient_context",
  "material_change",
  "possible_noise",
  "weak_baseline",
]);
const ALLOWED_FEATURES = new Set([
  "completeness",
  "importance",
  "magnitudeScore",
  "relativeMagnitude",
  "robustDeviation",
]);

function getAuditClient() {
  const apiKey = process.env.NODE_ENV === "production"
    ? process.env.CB_OPENAI_API_KEY
    : process.env.CB_OPENAI_API_KEY_DEV;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function deterministicSample(fingerprint, rate) {
  const prefix = crypto.createHash("sha256").update(fingerprint).digest("hex").slice(0, 8);
  return Number.parseInt(prefix, 16) / 0xffffffff < rate;
}

function buildAuditEvidence(payload) {
  return {
    aggregate: payload.aggregate || "unknown",
    baselinePolicy: payload.baselinePolicy,
    completeness: payload.features?.completeness,
    deterministicPublished: Boolean(payload.published),
    deterministicReason: payload.reason || null,
    direction: payload.direction || null,
    features: Object.fromEntries(Object.entries(payload.features || {}).filter(([key, value]) => (
      ALLOWED_FEATURES.has(key) && Number.isFinite(Number(value))
    ))),
    relativeDelta: Number.isFinite(Number(payload.relativeDelta))
      ? Number(payload.relativeDelta)
      : null,
    sampleCount: Number(payload.sampleCount) || 0,
    unit: payload.unit || "number",
  };
}

function validateAuditVerdict(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid audit response");
  if (typeof value.relevant !== "boolean" || typeof value.evidenceSupported !== "boolean") {
    throw new Error("Invalid audit response");
  }
  const relevanceScore = Number(value.relevanceScore);
  if (!Number.isFinite(relevanceScore) || relevanceScore < 0 || relevanceScore > 1) {
    throw new Error("Invalid audit score");
  }
  const reasonCodes = Array.isArray(value.reasonCodes)
    ? value.reasonCodes.filter((code) => ALLOWED_REASON_CODES.has(code)).slice(0, 5)
    : [];
  const suggestedWeightChanges = Array.isArray(value.suggestedWeightChanges)
    ? value.suggestedWeightChanges.filter((item) => (
      ALLOWED_FEATURES.has(item?.feature)
      && ["decrease", "increase"].includes(item?.direction)
      && typeof item?.rationale === "string"
    )).slice(0, 5).map((item) => ({
      direction: item.direction,
      feature: item.feature,
      rationale: item.rationale.slice(0, 300),
    }))
    : [];
  return {
    evidenceSupported: value.evidenceSupported,
    reasonCodes,
    relevanceScore,
    relevant: value.relevant,
    suggestedWeightChanges,
  };
}

async function hasAuditBudget(teamId, policy) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [auditCount, usage] = await Promise.all([
    db.ObservationAudit.count({
      where: { createdAt: { [Op.gte]: startOfDay }, team_id: teamId },
    }),
    db.AiUsage.findOne({
      attributes: [[fn("SUM", col("total_tokens")), "tokens"]],
      raw: true,
      where: {
        createdAt: { [Op.gte]: startOfDay },
        purpose: "observation_audit",
        team_id: teamId,
      },
    }),
  ]);
  return auditCount < policy.llmAuditDailyLimit
    && (Number(usage?.tokens) || 0) < policy.llmAuditDailyTokenLimit;
}

async function auditCandidate(payload) {
  const policy = getObservationPolicy();
  if (policy.llmAuditMode === "off" || policy.llmAuditMode === "manual") {
    return { skipped: "disabled" };
  }
  if (policy.llmAuditMode === "shadow_published" && !payload.published) {
    return { skipped: "not_published" };
  }
  if (
    policy.llmAuditMode === "shadow_sample"
    && !deterministicSample(payload.candidateFingerprint, policy.llmAuditSampleRate)
  ) {
    return { skipped: "not_sampled" };
  }
  if (!await hasAuditBudget(payload.teamId, policy)) return { skipped: "budget" };
  const client = getAuditClient();
  if (!client) return { skipped: "not_configured" };

  const model = process.env.CB_OBSERVATIONS_LLM_AUDIT_MODEL || "gpt-5.4-nano";
  const featureVector = buildAuditEvidence(payload);
  const startedAt = Date.now();
  const response = await client.responses.create({
    input: [{
      content: [{
        text: JSON.stringify(featureVector),
        type: "input_text",
      }],
      role: "user",
    }],
    instructions: "Audit whether this deterministic metric-change candidate is likely useful. Judge only the supplied features. Do not infer causes or missing business context.",
    model,
    text: {
      format: {
        name: "observation_audit",
        schema: {
          additionalProperties: false,
          properties: {
            evidenceSupported: { type: "boolean" },
            reasonCodes: {
              items: { enum: [...ALLOWED_REASON_CODES], type: "string" },
              type: "array",
            },
            relevanceScore: { maximum: 1, minimum: 0, type: "number" },
            relevant: { type: "boolean" },
            suggestedWeightChanges: {
              items: {
                additionalProperties: false,
                properties: {
                  direction: { enum: ["increase", "decrease"], type: "string" },
                  feature: { enum: [...ALLOWED_FEATURES], type: "string" },
                  rationale: { maxLength: 300, type: "string" },
                },
                required: ["feature", "direction", "rationale"],
                type: "object",
              },
              type: "array",
            },
          },
          required: [
            "relevant",
            "relevanceScore",
            "evidenceSupported",
            "reasonCodes",
            "suggestedWeightChanges",
          ],
          type: "object",
        },
        strict: true,
        type: "json_schema",
      },
      verbosity: "low",
    },
  });
  const verdict = validateAuditVerdict(JSON.parse(response.output_text));
  const usage = await db.AiUsage.create({
    completion_tokens: response.usage?.output_tokens || 0,
    conversation_id: null,
    cost_micros: 0,
    elapsed_ms: Date.now() - startedAt,
    model,
    prompt_tokens: response.usage?.input_tokens || 0,
    purpose: "observation_audit",
    team_id: payload.teamId,
    total_tokens: response.usage?.total_tokens || 0,
  });
  await db.ObservationAudit.create({
    audit_mode: policy.llmAuditMode,
    audit_version: AUDIT_VERSION,
    candidate_fingerprint: payload.candidateFingerprint,
    feature_vector: featureVector,
    model,
    observation_id: payload.observationId || null,
    team_id: payload.teamId,
    usage_id: usage.id,
    verdict,
  });
  return { audited: true };
}

module.exports = {
  ALLOWED_FEATURES,
  ALLOWED_REASON_CODES,
  AUDIT_VERSION,
  auditCandidate,
  buildAuditEvidence,
  deterministicSample,
  validateAuditVerdict,
};
