const db = require("../models");

module.exports.up = () => {
  return db.TeamRole.update({ canExport: true }, { where: { role: ["owner", "admin"] } });
};
