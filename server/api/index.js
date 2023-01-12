const team = require("./TeamRoute");
const user = require("./UserRoute");
const project = require("./ProjectRoute");
const connection = require("./ConnectionRoute");
const chart = require("./ChartRoute");
const savedQuery = require("./SavedQueryRoute");
const dataRequest = require("./DataRequestRoute");
const dataset = require("./DatasetRoute");
const template = require("./TemplateRoute");
const google = require("./GoogleRoute");
const update = require("./UpdateRoute");

module.exports = {
  team,
  user,
  project,
  connection,
  chart,
  savedQuery,
  dataRequest,
  dataset,
  template,
  google,
  update,
};
