const rateLimit = require("express-rate-limit");

const DataRequestController = require("../controllers/DataRequestController");
const TeamController = require("../controllers/TeamController");
const verifyToken = require("../modules/verifyToken");
const DatasetController = require("../controllers/DatasetController");

const apiLimiter = (max = 10) => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max,
  });
};

module.exports = (app) => {
  const dataRequestController = new DataRequestController();
  const teamController = new TeamController();
  const datasetController = new DatasetController();

  const root = "/team/:team_id/datasets/:dataset_id/dataRequests";

  const checkPermissions = async (req, res, next) => {
    const { team_id } = req.params;

    // Fetch the TeamRole for the user
    const teamRole = await teamController.getTeamRole(team_id, req.user.id);

    if (!teamRole) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { role, projects } = teamRole;

    // Handle permissions for teamOwner and teamAdmin
    if (["teamOwner", "teamAdmin"].includes(role)) {
      return next();
    }

    if (role === "projectAdmin" || role === "projectEditor" || role === "projectViewer") {
      const connections = await datasetController.findByProjects(team_id, projects);
      if (!connections || connections.length === 0) {
        return res.status(404).json({ message: "No connections found" });
      }

      return next();
    }

    return res.status(403).json({ message: "Access denied" });
  };

  /*
  ** Route to create a new Data request
  */
  app.post(`${root}`, verifyToken, checkPermissions, (req, res) => {
    return dataRequestController.create(req.body)
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
  app.get(`${root}`, verifyToken, checkPermissions, (req, res) => {
    return dataRequestController.findByDataset(req.params.dataset_id)
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
  ** Route to get Data request by ID
  */
  app.get(`${root}/:id`, verifyToken, checkPermissions, (req, res) => {
    return dataRequestController.findById()
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
  app.put(`${root}/:id`, verifyToken, checkPermissions, (req, res) => {
    return dataRequestController.update(req.params.id, req.body)
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
  ** Route to delete a Data Request by ID
  */
  app.delete(`${root}/:id`, verifyToken, checkPermissions, (req, res) => {
    return dataRequestController.delete(req.params.id)
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
  app.post(`${root}/:id/request`, verifyToken, checkPermissions, (req, res) => {
    return dataRequestController.runRequest(
      req.params.id, req.params.chart_id, req.body.noSource, req.body.getCache, req.body.filters,
    )
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

        return res.status(400).json({ error: error.message });
      });
  });
  // -------------------------------------------------

  /*
  ** Route to ask AI a question
  */
  app.post(`${root}/:id/askAi`, verifyToken, checkPermissions, apiLimiter(10), (req, res) => {
    return dataRequestController.askAi(
      req.params.id,
      req.body.question,
      req.body.conversationHistory,
      req.body.currentQuery,
    )
      .then((aiResponse) => {
        return res.status(200).send(aiResponse);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // -------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
