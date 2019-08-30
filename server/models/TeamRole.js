const db = require("../modules/dbConnection");
const Sequelize = require("sequelize");

const TeamRole = db.define("TeamRole", {
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
  team_id: {
    type: Sequelize.INTEGER,
    reference: {
      model: "Team",
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


module.exports = TeamRole;
