const db = require("../modules/dbConnection");
const Sequelize = require("sequelize");

const Project = db.define("Project", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  team_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    reference: {
      model: "Team",
      key: "id",
      onDelete: "cascade",
    },
  },
  name: {
    type: Sequelize.STRING,
  },
  brewName: {
    type: Sequelize.STRING,
    unique: true,
  },
  dashboardTitle: {
    type: Sequelize.STRING,
  },
}, {
  freezeTableName: true
});

module.exports = Project;
