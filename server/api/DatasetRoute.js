const DatasetController = require("../controllers/DatasetController");
const TeamController = require("../controllers/TeamController");
const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");

module.exports = (app) => {
  const datasetController = new DatasetController();
  const teamController = new TeamController();
  const root = "/team/:team_id/datasets";

  const checkPermissions = (actionType = "readOwn") => {
    return async (req, res, next) => {
      const { team_id } = req.params;

      // Fetch the TeamRole for the user
      const teamRole = await teamController.getTeamRole(team_id, req.user.id);

      if (!teamRole) {
        return res.status(403).json({ message: "Access denied" });
      }

      let permission;
      if ((teamRole.role === "projectAdmin" || teamRole.role === "projectEditor") && actionType.indexOf("Any") > -1) {
        permission = accessControl.can(teamRole.role)[actionType.replace("Any", "Own")]("dataset");
      } else {
        permission = accessControl.can(teamRole.role)[actionType]("dataset");
      }

      if (!permission.granted) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { role, projects } = teamRole;

      // Handle permissions for teamOwner and teamAdmin
      if (["teamOwner", "teamAdmin"].includes(role)) {
        return next();
      }

      if (role === "projectAdmin" || role === "projectEditor" || role === "projectViewer") {
        const datasets = await datasetController.findByProjects(team_id, projects);
        if (!datasets || datasets.length === 0) {
          return res.status(404).json({ message: "No datasets found" });
        }

        // save the projects in the user object
        req.user.projects = projects;

        return next();
      }

      return res.status(403).json({ message: "Access denied" });
    };
  };

  /*
  ** Route to get all datasets
  */
  app.get(root, verifyToken, checkPermissions("readOwn"), (req, res) => {
    return datasetController.findByTeam(req.params.team_id)
      .then((datasets) => {
        if (req.user.projects) {
          const filteredDatasets = datasets.filter((dataset) => {
            if (!dataset.project_ids) return false;
            return dataset.project_ids.some((project_id) => {
              return req.user.projects.includes(project_id);
            });
          });

          return res.status(200).send(filteredDatasets);
        }
        return res.status(200).send(datasets);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });

  /*
  ** Route to get a dataset by ID
  */
  app.get(`${root}/:dataset_id`, verifyToken, checkPermissions("readOwn"), (req, res) => {
    return datasetController.findById(req.params.dataset_id)
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
  app.post(root, verifyToken, checkPermissions("createAny"), (req, res) => {
    if (req.user.projects) {
      req.body.project_ids = req.user.projects;
    }

    return datasetController.create(req.body)
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
  ** Route to quickly create a dataset with all its data requests in one go
  */
  app.post(`${root}/quick-create`, verifyToken, checkPermissions("createAny"), (req, res) => {
    if (req.user.projects) {
      req.body.project_ids = req.user.projects;
    }

    // Ensure team_id matches the route parameter
    req.body.team_id = req.params.team_id;
    req.body.xAxis = req.body.xAxis || req.body.dimension;
    req.body.yAxis = req.body.yAxis || req.body.metric;
    req.body.yAxisOperation = req.body.yAxisOperation || req.body.metricOperation;

    return datasetController.createWithDataRequests(req.body)
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
  ** Route to duplicate a dataset
  */
  app.post(`${root}/:dataset_id/duplicate`, verifyToken, checkPermissions("createAny"), (req, res) => {
    return datasetController.duplicateDataset(req.params.dataset_id, req.body.name)
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
  app.get(`${root}`, verifyToken, checkPermissions("readyAny"), (req, res) => {
    return datasetController.findByChart(req.params.chart_id)
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
  app.put(`${root}/:dataset_id`, verifyToken, checkPermissions("updateAny"), (req, res) => {
    return datasetController.update(req.params.dataset_id, req.body)
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
  ** Route to delete all draft datasets
  */
  app.delete(`${root}/drafts`, verifyToken, checkPermissions("deleteAny"), (req, res) => {
    return datasetController.removeDrafts(req.params.team_id)
      .then((result) => {
        return res.status(200).send(result);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------------

  /*
  ** Route to delete a dataset
  */
  app.delete(`${root}/:dataset_id`, verifyToken, checkPermissions("deleteAny"), (req, res) => {
    return datasetController.remove(req.params.dataset_id)
      .then((result) => {
        return res.status(200).send(result);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------------

  /*
  ** [DEPRECATED] Route to run the request attached to the dataset
  */
  app.get(`${root}/:dataset_id/request`, verifyToken, checkPermissions("readAny"), (req, res) => {
    return datasetController.runRequest(
      req.params.dataset_id, req.params.chart_id, req.query.noSource, req.query.getCache
    )
      .then((dataset) => {
        const newDataset = dataset;
        if (newDataset?.data) {
          const { data } = newDataset;
          if (typeof data === "object" && data instanceof Array) {
            newDataset.data = data.slice(0, 20);
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
                newDataset.data[resultKey] = slicedArray;
              });
            }
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

  /*
  ** [NEW] Route to run the request attached to the dataset
  */
  app.post(`${root}/:dataset_id/request`, verifyToken, checkPermissions("readAny"), (req, res) => {
    return datasetController.runRequest({
      dataset_id: req.params.dataset_id,
      chart_id: req.body.chart_id,
      noSource: req.body.noSource,
      getCache: req.body.getCache,
      variables: req.body.variables,
    })
      .then((dataset) => {
        const newDataset = dataset;
        if (newDataset?.data) {
          const { data } = newDataset;
          if (typeof data === "object" && data instanceof Array) {
            newDataset.data = data.slice(0, 20);
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
                newDataset.data[resultKey] = slicedArray;
              });
            }
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

  /*
  ** Route to get the charts associated with the dataset
  */
  app.get(`${root}/:dataset_id/charts`, verifyToken, checkPermissions("readAny"), (req, res) => {
    return datasetController.findRelatedCharts(req.params.dataset_id)
      .then((charts) => {
        return res.status(200).send(charts);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // ----------------------------------------------------

  /*
** Route to create a new variable binding
*/
  app.post(`${root}/:id/variableBindings`, verifyToken, checkPermissions("updateAny"), (req, res) => {
    return datasetController.createVariableBinding(
      req.params.id,
      req.body,
    )
      .then((variableBinding) => {
        return res.status(200).send(variableBinding);
      });
  });
  // -------------------------------------------------

  /*
  ** Route to update a variable binding
  */
  app.put(`${root}/:id/variableBindings/:variable_id`, verifyToken, checkPermissions("updateAny"), (req, res) => {
    return datasetController.updateVariableBinding(
      req.params.id,
      req.params.variable_id,
      req.body,
    )
      .then((variableBinding) => {
        return res.status(200).send(variableBinding);
      });
  });
  // -------------------------------------------------

  return (req, res, next) => {
    next();
  };
};
