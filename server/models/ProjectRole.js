const db = require("../modules/dbConnection");
const Sequelize = require("sequelize");

const ProjectRole = db.define("ProjectRole", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: Sequelize.INTEGER,
    reference: {
      model: "User",
      key: "id",
      onDelete: "cascade",
    },
  },
  project_id: {
    type: Sequelize.INTEGER,
    reference: {
      model: "Project",
      key: "id",
      onDelete: "cascade",
    },
  },
  role: {
    type: Sequelize.STRING,
    defaultValue: "admin",
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
  }
}, {
  freezeTableName: true
});


module.exports = ProjectRole;
