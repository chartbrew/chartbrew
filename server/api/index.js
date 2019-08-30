const team = require("./TeamRoute");
const user = require("./UserRoute");
const project = require("./ProjectRoute");
const connection = require("./ConnectionRoute");
const chart = require("./ChartRoute");
const savedQuery = require("./SavedQueryRoute");
const apiRequest = require("./ApiRequestRoute");

module.exports = {
  team,
  user,
  project,
  connection,
  chart,
  savedQuery,
  apiRequest,
};
