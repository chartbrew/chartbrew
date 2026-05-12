const {
  sourcePlanDataset,
  sourcePreviewConfiguration,
  sourceValidateConfiguration,
} = require("./sourceTools");

async function stripeOfficialPlanDataset(payload) {
  return sourcePlanDataset({ ...payload, source_id: "stripeOfficial" });
}

async function stripeOfficialValidateConfiguration(payload) {
  return sourceValidateConfiguration({ ...payload, source_id: "stripeOfficial" });
}

async function stripeOfficialPreviewConfiguration(payload) {
  return sourcePreviewConfiguration({ ...payload, source_id: "stripeOfficial" });
}

module.exports = {
  stripeOfficialPlanDataset,
  stripeOfficialPreviewConfiguration,
  stripeOfficialValidateConfiguration,
};
