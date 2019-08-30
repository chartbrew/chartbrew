const db = require("../modules/dbConnection");
const Sequelize = require("sequelize");

const Project = db.define("SavedQuery", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  project_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    reference: {
      model: "Project",
      key: "id",
      onDelete: "cascade",
    },
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    reference: {
      model: "User",
      key: "id",
      onDelete: "cascade",
    },
  },
  summary: {
    type: Sequelize.STRING,
  },
  query: {
    type: Sequelize.TEXT,
  },
  type: {
    type: Sequelize.STRING,
  },
}, {
  freezeTableName: true
});

module.exports = Project;
