const { QueryTypes } = require("sequelize");

const db = require("../models");

module.exports.up = () => {
  return db.Team.findAll({
    include: [{ model: db.Project, attributes: ["id"] }], attributes: ["id"]
  })
    .then((teams) => {
      if (!teams || teams.length === 0) return Promise.resolve("done");
      const projectsObj = {};
      teams.map((team) => {
        if (!projectsObj[team.id]) projectsObj[team.id] = [];
        if (team.Projects && team.Projects.length > 0) {
          team.Projects.map((project) => {
            projectsObj[team.id].push(project.id);
            return project;
          });
        }
        return team;
      });

      const updatePromises = [];
      Object.keys(projectsObj).forEach((key) => {
        updatePromises.push(
          db.TeamRole.update({
            projects: projectsObj[key],
          }, {
            where: { team_id: key },
          })
        );
      });

      return Promise.all(updatePromises);
    });
};

module.exports.down = () => {
  return db.sequelize.query("UPDATE TeamRole SET projects = NULL WHERE 1", { type: QueryTypes.SELECT });
};
