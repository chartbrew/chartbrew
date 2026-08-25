const team = require("./TeamRoute");
const user = require("./UserRoute");
const project = require("./ProjectRoute");
const connection = require("./ConnectionRoute");
const chart = require("./ChartRoute");
const savedQuery = require("./SavedQueryRoute");
const dataRequest = require("./DataRequestRoute");
const dataset = require("./DatasetRoute");
const template = require("./TemplateRoute");
const chartTemplate = require("./ChartTemplateRoute");
const google = require("./GoogleRoute");
const update = require("./UpdateRoute");
const integration = require("./IntegrationRoute");
const ai = require("./AiRoute");
const updateRun = require("./UpdateRunRoute");
const observation = require("./ObservationRoute");
const platform = require("./PlatformSettingsRoute");
const dataApi = require("./DataApiRoute");

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
  chartTemplate,
  google,
  update,
  updateRun,
  integration,
  ai,
  observation,
  platform,
  dataApi,
};
