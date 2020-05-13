const DatasetController = require("../controllers/DatasetController");
const TeamController = require("../controllers/TeamController");
const ProjectController = require("../controllers/ProjectController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

module.exports = (app) => {
  const datasetController = new DatasetController();
  const projectController = new ProjectController();
  const teamController = new TeamController();
  const root = "/project/:project_id/chart/:chart_id/dataset";

  /*
  ** Route to get a dataset by ID
  */
  app.get(`${root}/:id`, verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("dataset");
        if (!permission.granted) {
          throw new Error(401);
        }

        return datasetController.findById(req.params.id);
      })
      .then((dataset) => {
        return res.status(200).send(dataset);
      })
      .catch((err) => {
        if (err && err.message && err.message === "401") {
          return res.status(401).send(err);
        }

        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------------

  /*
  ** Route to create a new dataset
  */
  app.post(root, verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("dataset");
        if (!permission.granted) {
          throw new Error(401);
        }

        return datasetController.create(req.body);
      })
      .then((dataset) => {
        return res.status(200).send(dataset);
      })
      .catch((err) => {
        if (err && err.message && err.message === "401") {
          return res.status(401).send(err);
        }

        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------------

  /*
  ** Route to get a dataset by Chart ID
  */
  app.get(`${root}`, verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("dataset");
        if (!permission.granted) {
          throw new Error(401);
        }

        return datasetController.findByChart(req.params.chart_id);
      })
      .then((dataset) => {
        return res.status(200).send(dataset);
      })
      .catch((err) => {
        if (err && err.message && err.message === "401") {
          return res.status(401).send(err);
        }

        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------------

  /*
  ** Route to update a dataset
  */
  app.put(`${root}/:id`, verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("dataset");
        if (!permission.granted) {
          throw new Error(401);
        }

        return datasetController.update(req.params.id, req.body);
      })
      .then((dataset) => {
        return res.status(200).send(dataset);
      })
      .catch((err) => {
        if (err && err.message && err.message === "401") {
          return res.status(401).send(err);
        }

        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------------

  /*
  ** Route to delete a dataset
  */
  app.delete(`${root}/:id`, verifyToken, (req, res) => {
    return projectController.findById(req.params.project_id)
      .then((project) => {
        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).deleteAny("dataset");
        if (!permission.granted) {
          throw new Error(401);
        }
        return datasetController.remove(req.params.id);
      })
      .then((result) => {
        return res.status(200).send(result);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
