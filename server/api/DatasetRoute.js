const DatasetController = require("../controllers/DatasetController");
const TeamController = require("../controllers/TeamController");
const ProjectController = require("../controllers/ProjectController");
const ChartController = require("../controllers/ChartController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

module.exports = (app) => {
  const datasetController = new DatasetController();
  const projectController = new ProjectController();
  const teamController = new TeamController();
  const chartController = new ChartController();
  const root = "/project/:project_id/chart/:chart_id/dataset";

  const checkAccess = (req) => {
    let gChart;
    let gProject;
    return chartController.findById(req.params.chart_id)
      .then((chart) => {
        if (chart.project_id !== parseInt(req.params.project_id, 10)) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        gChart = chart;
        return projectController.findById(req.params.project_id);
      })
      .then((project) => {
        if (gChart.project_id !== project.id) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        gProject = project;

        if (req.params.id) {
          return datasetController.findById(req.params.id);
        }

        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((data) => {
        if (!req.params.id) {
          return Promise.resolve(data);
        }

        if (data.chart_id !== gChart.id) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return teamController.getTeamRole(gProject.team_id, req.user.id);
      });
  };

  /*
  ** Route to get a dataset by ID
  */
  app.get(`${root}/:id`, verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("dataset");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
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
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("dataset");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
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
  ** Route to get the datasets by Chart ID
  */
  app.get(`${root}`, verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("dataset");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
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
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("dataset");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
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
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).deleteAny("dataset");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
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

  /*
  ** Route to run the request attached to the dataset
  */
  app.get(`${root}/:id/request`, verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("dataset");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return datasetController.runRequest(
          req.params.id, req.params.chart_id, req.query.noSource, req.query.getCache
        );
      })
      .then((dataset) => {
        const newDataset = dataset;

        // reduce the size of the returned data. No point in showing thousands of objects
        if (typeof dataset.data === "object" && dataset.data instanceof Array) {
          newDataset.data = dataset.data.slice(0, 20);
        } else if (typeof dataset === "object") {
          const resultsKey = [];
          // console.log("dataset.data", dataset);
          Object.keys(dataset.data).forEach((key) => {
            if (dataset.data[key] instanceof Array) {
              resultsKey.push(key);
            }
          });

          if (resultsKey.length > 0) {
            resultsKey.forEach((resultKey) => {
              const slicedArray = dataset.data[resultKey].slice(0, 20);
              newDataset.data[resultKey] = slicedArray;
            });
          }
        }

        return res.status(200).send(newDataset);
      })
      .catch((err) => {
        if (err && err.message === "404") {
          return res.status(404).send((err && err.message) || err);
        }
        return res.status(400).send((err && err.message) || err);
      });
  });
  // ----------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
