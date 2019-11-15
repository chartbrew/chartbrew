const LimitationController = require("../controllers/LimitationController");
const ProjectController = require("../controllers/ProjectController");
const constants = require("../constants");

const limitationController = new LimitationController();
const projectController = new ProjectController();

function canCreateProject(req, res, next) {
  return limitationController.canCreateProject(req.body.team_id)
    .then((canCreate) => {
      if (!canCreate) {
        return res.status(406).send({
          code: 406,
          limit: constants.CAN_CREATE_PROJECT,
          error: "The current plan does not allow the creation of more projects.",
        });
      }

      return next();
    });
}

function canCreateConnection(req, res, next) {
  return projectController.findById(req.params.project_id)
    .then((project) => {
      return limitationController.canCreateConnection(project.team_id, project.id);
    })
    .then((canCreate) => {
      if (!canCreate) {
        return res.status(406).send({
          code: 406,
          limit: constants.CAN_CREATE_CONNECTION,
          error: "The current plan does not allow the creation of more Connections",
        });
      }

      return next();
    });
}

function canCreateChart(req, res, next) {
  return projectController.findById(req.params.project_id)
    .then((project) => {
      return limitationController.canCreateChart(project.team_id, project.id);
    })
    .then((canCreate) => {
      if (!canCreate) {
        return res.status(406).send({
          code: 406,
          limit: constants.CAN_CREATE_CHART,
          error: "The plan does not allow the creation of more charts",
        });
      }

      return next();
    });
}

function canChangeAutoUpdate(req, res, next) {
  if (!req.body.autoUpdate) return next();

  return limitationController.canChangeAutoUpdate(req.params.id, req.body.autoUpdate)
    .then((canUpdate) => {
      if (!canUpdate) {
        return res.status(406).send({
          status: 406,
          limit: constants.CAN_CHANGE_AUTOUPDATE,
          error: "The current plan doesn't support this Auto Update change",
        });
      }

      return next();
    });
}

module.exports = {
  canCreateChart,
  canChangeAutoUpdate,
  canCreateConnection,
  canCreateProject,
};
