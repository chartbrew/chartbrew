const DigestController = require("../../../../controllers/DigestController");
const { getObservationAccess } = require("../../../observations/access");

async function listKpiReviews(payload) {
  const access = await getObservationAccess(payload.team_id, payload.user_id);
  const reviews = await new DigestController().list(access);
  return {
    items: reviews.slice(0, 10),
    truncated: reviews.length > 10,
  };
}

module.exports = listKpiReviews;
