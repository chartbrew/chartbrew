const team = require("./Team");
const project = require("./Project");
const user = require("./User");
const teamRole = require("./TeamRole");
const projectRole = require("./ProjectRole");
const connection = require("./Connection");
const chart = require("./Chart");
const dataset = require("./Dataset");
const teamInvintation = require("./TeamInvintation");
const savedQuery = require("./SavedQuery");
const apiRequest = require("./ApiRequest");

// create the database relations
team.hasMany(project, { foreignKey: "team_id" });
team.hasMany(teamRole, { foreignKey: "team_id" });
team.hasMany(teamInvintation, { foreignKey: "team_id" });

user.hasMany(teamRole, { foreignKey: "user_id" });
user.hasMany(projectRole, { foreignKey: "user_id" });
user.hasMany(teamInvintation, { foreignKey: "user_id" });

project.hasMany(projectRole, { foreignKey: "project_id" });
project.hasMany(connection, { foreignKey: "project_id" });
project.hasMany(chart, { foreignKey: "project_id" });
project.belongsTo(team, { foreignKey: "team_id" });

chart.hasMany(dataset, { foreignKey: "chart_id" });
chart.hasOne(apiRequest, { foreignKey: "chart_id" });

teamRole.belongsTo(user, { foreignKey: "user_id" });
teamRole.belongsTo(team, { foreignKey: "team_id" });

teamInvintation.belongsTo(team, { foreignKey: "team_id" });

savedQuery.belongsTo(user, { foreignKey: "user_id" });
savedQuery.belongsTo(project, { foreignKey: "project_id" });

apiRequest.belongsTo(chart, { foreignKey: "chart_id" });

module.exports = {
  team,
  project,
  user,
  teamRole,
  projectRole,
  connection,
  chart,
  teamInvintation,
  dataset,
  apiRequest,
};
