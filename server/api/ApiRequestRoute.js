const ApiRequestController = require("../controllers/ApiRequestController");
const TeamController = require("../controllers/TeamController");
const ProjectController = require("../controllers/ProjectController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

module.exports = (app) => {
  const apiRequestController = new ApiRequestController();
  const teamController = new TeamController();
  const projectController = new ProjectController();
  const root = "/project/:project_id/chart/:chart_id/apiRequest";

  /*
  ** Route to create a new Api request
  */
  app.post(`${root}`, verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("apiRequest");
        if (!permission.granted) {
          throw new Error(401);
        }

        apiRequestController.create(req.body);
      })
      .then((apiRequest) => {
        return res.status(200).send(apiRequest);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }

        return res.status(400).send(error);
      });
  });
  // -------------------------------------------------

  /*
  ** Route to get Api request by ID
  */
  app.get(`${root}/:id`, verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("apiRequest");
        if (!permission.granted) {
          throw new Error(401);
        }

        return apiRequestController.findById();
      })
      .then((apiRequest) => {
        return res.status(200).send(apiRequest);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }

        return res.status(400).send(error);
      });
  });
  // -------------------------------------------------

  /*
  ** Route to update the apiRequest
  */
  app.put(`${root}/:id`, verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("apiRequest");
        if (!permission.granted) {
          throw new Error(401);
        }

        return apiRequestController.update(req.params.id, req.body);
      })
      .then((apiRequest) => {
        return res.status(200).send(apiRequest);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }

        return res.status(400).send(error);
      });
  });
  // -------------------------------------------------

  /*
  ** Route to get the api request by the chartId
  */
  app.get(`${root}`, verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("apiRequest");
        if (!permission.granted) {
          throw new Error(401);
        }

        return apiRequestController.findByChart(req.params.chart_id);
      })
      .then((apiRequest) => {
        return res.status(200).send(apiRequest);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).send({ error: "Not authorized" });
        }

        return res.status(400).send(error);
      });
  });
  // -------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
