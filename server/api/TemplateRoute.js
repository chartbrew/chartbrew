const verifyToken = require("../modules/verifyToken");
const templates = require("../templates/index");
const accessControl = require("../modules/accessControl");

const TeamController = require("../controllers/TeamController");
const ProjectController = require("../controllers/ProjectController");
const templateController = require("../controllers/TemplateController");

const url = "/team/:team_id/template";

module.exports = (app) => {
  const teamController = new TeamController();
  const projectController = new ProjectController();

  const checkAccess = (req, level, model) => {
    return teamController.getTeamRole(req.params.team_id, req.user.id)
      .then((teamRole) => {
        const permission = accessControl.can(teamRole.role)[level](model);
        if (!permission.granted) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return teamRole;
      });
  };

  const formatError = (error, res) => {
    if (error.message === "401") {
      return res.status(401).send({ error: "Not authorized" });
    }
    if (error.message === "404") {
      return res.status(404).send({ error: "Not Found" });
    }
    return res.status(400).send(error);
  };

  /*
  ** Route to get all the templates from a team
  */
  app.get(`${url}`, verifyToken, async (req, res) => {
    try {
      await checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    return templateController.find({ team_id: req.params.team_id })
      .then((templates) => {
        return res.status(200).send(templates);
      })
      .catch((err) => {
        return formatError(err, res);
      });
  });
  // -------------------------------------

  /*
  ** Route to get a community template configuration
  */
  app.get(`${url}/community/:template`, verifyToken, async (req, res) => {
    try {
      await checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    return res.status(200).send(templates[req.params.template].template());
  });
  // -------------------------------------

  /*
  ** Route to get a custom template configuration
  */
  app.get(`${url}/custom/:template_id`, verifyToken, async (req, res) => {
    let teamRole;
    try {
      teamRole = await checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    return templateController.findById(req.params.template_id)
      .then((template) => {
        // first, check if the template is part of the owner's team
        if (template.team_id !== teamRole.team_id) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return res.status(200).send(template);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // -------------------------------------

  /*
  ** Route to update a template
  */
  app.put(`${url}/:template_id`, verifyToken, async (req, res) => {
    let teamRole;
    try {
      teamRole = await checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    return templateController.findById(req.params.template_id)
      .then((template) => {
        // first, check if the template is part of the owner's team
        if (template.team_id !== teamRole.team_id) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return templateController.update(req.params.template_id, req.body);
      })
      .catch((err) => {
        return formatError(err, res);
      });
  });
  // -------------------------------------

  /*
  ** Route to delete a template
  */
  app.delete(`${url}/:template_id`, verifyToken, async (req, res) => {
    let teamRole;
    try {
      teamRole = await checkAccess(req, "deleteAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    return templateController.findById(req.params.template_id)
      .then((template) => {
        // first, check if the template is part of the owner's team
        if (template.team_id !== teamRole.team_id) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return templateController.delete(req.params.template_id, req.body);
      })
      .then(() => {
        return res.status(200).send({ success: true });
      })
      .catch((err) => {
        return formatError(err, res);
      });
  });
  // -------------------------------------

  /*
  ** Route to create a template with a model
  */
  app.post(`${url}`, verifyToken, async (req, res) => {
    let teamRole;
    try {
      teamRole = await checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    const data = req.body;

    if (req.body.project_id) {
      try {
        const project = await projectController.findById(req.body.project_id);
        // if the project is not in the same team, return unauthorized error
        if (project.team_id !== teamRole.team_id) return formatError(new Error(401), res);

        data.model = await templateController.getDashboardModel(req.body.project_id);
      } catch (error) {
        return formatError(error, res);
      }
    }

    return templateController.create(req.params.team_id, data)
      .then((template) => {
        return res.status(200).send(template);
      })
      .catch((err) => {
        return formatError(err, res);
      });
  });
  // -------------------------------------

  /*
  ** Route to create a template from a project and get the generation JSON
  */
  app.get(`${url}/generate/:project_id`, verifyToken, (req, res) => {
    try {
      checkAccess(req, "updateAny", "chart");
    } catch (error) {
      return formatError(error, res);
    }

    return templateController.getDashboardModel(req.params.project_id)
      .then((template) => {
        return res.status(200).send(template);
      })
      .catch((err) => {
        return formatError(err, res);
      });
  });
  // -------------------------------------

  return (req, res, next) => {
    next();
  };
};
