const DataRequestController = require("../controllers/DataRequestController");
const TeamController = require("../controllers/TeamController");
const ProjectController = require("../controllers/ProjectController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");
const ChartController = require("../controllers/ChartController");
const DatasetController = require("../controllers/DatasetController");

module.exports = (app) => {
  const dataRequestController = new DataRequestController();
  const teamController = new TeamController();
  const projectController = new ProjectController();
  const chartController = new ChartController();
  const datasetController = new DatasetController();

  const root = "/project/:project_id/chart/:chart_id/dataRequest";

  const checkAccess = (req) => {
    let gProject;
    let gChart;
    return projectController.findById(req.params.project_id)
      .then((project) => {
        gProject = project;

        return chartController.findById(req.params.chart_id);
      })
      .then((chart) => {
        if (chart.project_id !== gProject.id) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }
        gChart = chart;

        if (req.params.id) {
          return dataRequestController.findById(req.params.id);
        }

        return teamController.getTeamRole(gProject.team_id, req.user.id);
      })
      .then((data) => {
        if (!req.params.id) return Promise.resolve(data);

        return datasetController.findById(data.dataset_id);
      })
      .then((data) => {
        if (!req.params.id) return Promise.resolve(data);

        if (data.chart_id !== gChart.id) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return teamController.getTeamRole(gProject.team_id, req.user.id);
      });
  };

  /*
  ** Route to create a new Data request
  */
  app.post(`${root}`, verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).createAny("dataRequest");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return dataRequestController.create(req.body);
      })
      .then((dataRequest) => {
        return res.status(200).send(dataRequest);
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
  ** Route to get Data request by ID
  */
  app.get(`${root}/:id`, verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("dataRequest");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return dataRequestController.findById();
      })
      .then((dataRequest) => {
        return res.status(200).send(dataRequest);
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
  ** Route to update the dataRequest
  */
  app.put(`${root}/:id`, verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("dataRequest");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return dataRequestController.update(req.params.id, req.body);
      })
      .then((dataRequest) => {
        return res.status(200).send(dataRequest);
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
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("dataRequest");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return dataRequestController.findByChart(req.params.chart_id);
      })
      .then((dataRequest) => {
        return res.status(200).send(dataRequest);
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
  ** Route to get a Data Request by dataset ID
  */
  app.get(`${root}/dataset/:datasetId`, verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).readAny("dataRequest");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return dataRequestController.findByDataset(req.params.datasetId);
      })
      .then((dataRequests) => {
        return res.status(200).send(dataRequests);
      })
      .catch((error) => {
        if (error && error.message === "404") {
          return res.status(404).send(error);
        }

        return res.status(400).send(error);
      });
  });
  // -------------------------------------------------

  /*
  ** Route to delete a Data Request by ID
  */
  app.delete(`${root}/:id`, verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).deleteAny("dataRequest");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return dataRequestController.delete(req.params.id);
      })
      .then((dataRequest) => {
        return res.status(200).send(dataRequest);
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
  ** Route to run a request
  */
  app.post(`${root}/:id/request`, verifyToken, (req, res) => {
    return checkAccess(req)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role).updateAny("dataRequest");
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return dataRequestController.runRequest(
          req.params.id, req.params.chart_id, req.body.noSource, req.body.getCache
        );
      })
      .then((dataRequest) => {
        const newDataRequest = dataRequest;
        // reduce the size of the returned data. No point in showing thousands of objects
        if (newDataRequest?.dataRequest?.responseData?.data) {
          const { data } = newDataRequest.dataRequest.responseData;
          if (typeof data === "object" && data instanceof Array) {
            newDataRequest.dataRequest.responseData.data = data.slice(0, 20);
          } else if (typeof data === "object") {
            const resultsKey = [];
            Object.keys(data).forEach((key) => {
              if (data[key] instanceof Array) {
                resultsKey.push(key);
              }
            });

            if (resultsKey.length > 0) {
              resultsKey.forEach((resultKey) => {
                const slicedArray = data[resultKey].slice(0, 20);
                newDataRequest.dataRequest.responseData.data[resultKey] = slicedArray;
              });
            }
          }
        }
        return res.status(200).send(newDataRequest);
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
