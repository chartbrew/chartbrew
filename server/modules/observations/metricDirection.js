const DESIRED_DIRECTIONS = new Set(["higher", "lower", "neutral"]);

function normalizeDesiredDirection(value) {
  return DESIRED_DIRECTIONS.has(value) ? value : "neutral";
}

function getObservationImpact(desiredDirection, changeDirection) {
  const desired = normalizeDesiredDirection(desiredDirection);
  if (desired === "neutral") return "neutral";
  if (changeDirection !== "increase" && changeDirection !== "decrease") return "neutral";
  if (desired === "higher") return changeDirection === "increase" ? "positive" : "negative";
  return changeDirection === "decrease" ? "positive" : "negative";
}

module.exports = {
  DESIRED_DIRECTIONS,
  getObservationImpact,
  normalizeDesiredDirection,
};
