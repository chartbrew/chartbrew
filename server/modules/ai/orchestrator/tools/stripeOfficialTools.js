const {
  requireSupportedSourceForConnection,
} = require("../sourceSupport");
const {
  normalizeTeamId,
  requireConnectionForTeam,
} = require("./teamScope");

async function getStripeOfficialSource({ connection_id, team_id }) {
  if (!team_id) {
    throw new Error("team_id is required");
  }
  if (!connection_id) {
    throw new Error("connection_id is required");
  }

  const normalizedTeamId = normalizeTeamId(team_id);
  const connection = await requireConnectionForTeam(connection_id, normalizedTeamId);
  const source = requireSupportedSourceForConnection(connection);

  if (source.id !== "stripeOfficial") {
    throw new Error("This tool only supports Stripe Official connections");
  }

  return { connection, source };
}

async function stripeOfficialPlanDataset(payload) {
  const { source } = await getStripeOfficialSource(payload);

  return source.backend.ai.planDataset({
    question: payload.question,
    overrides: payload.overrides || {},
  });
}

async function stripeOfficialValidateConfiguration(payload) {
  const { source } = await getStripeOfficialSource(payload);

  return source.backend.ai.validateConfiguration(payload.configuration);
}

async function stripeOfficialPreviewConfiguration(payload) {
  const { connection, source } = await getStripeOfficialSource(payload);

  return source.backend.ai.previewConfiguration({
    connection,
    configuration: payload.configuration,
    rowLimit: payload.row_limit,
  });
}

module.exports = {
  stripeOfficialPlanDataset,
  stripeOfficialPreviewConfiguration,
  stripeOfficialValidateConfiguration,
};
