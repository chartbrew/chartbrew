const db = require("../modules/dbConnection");
const Sequelize = require("sequelize");

const Team = db.define("Team", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.literal("CURRENT_TIMESTAMP")
  }
}, {
  freezeTableName: true
});


module.exports = Team;
