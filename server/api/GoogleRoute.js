const ProjectController = require("../controllers/ProjectController");
const TeamController = require("../controllers/TeamController");
const ConnectionController = require("../controllers/ConnectionController");
const oauthController = require("../controllers/OAuthController");

const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");
const googleConnector = require("../modules/googleConnector");

module.exports = (app) => {
  const projectController = new ProjectController();
  const teamController = new TeamController();
  const connectionController = new ConnectionController();

  const url = "/project/:project_id/connection/:connection_id";

  const checkAccess = (req) => {
    let gProject;
    return projectController.findById(req.params.project_id)
      .then((project) => {
        gProject = project;

        if (req.params.connection_id) {
          return connectionController.findById(req.params.connection_id);
        }

        return teamController.getTeamRole(project.team_id, req.user.id);
      })
      .then((data) => {
        if (!req.params.connection_id) return Promise.resolve(data);

        if (data.project_id !== gProject.id) {
          return new Promise((resolve, reject) => reject(new Error(401)));
        }

        return teamController.getTeamRole(gProject.team_id, req.user.id);
      });
  };

  /*
  ** Route to get the Google authentication URL
  */
  app.get(`${url}/google/auth`, verifyToken, async (req, res) => {
    try {
      const teamRole = await checkAccess(req);
      const permission = accessControl.can(teamRole.role).createAny("connection");
      if (!permission.granted) {
        return res.status(401).send({ error: "Not authorized" });
      }

      return res.status(200).send({
        url: googleConnector.getAuthUrl(
          req.params.project_id, req.params.connection_id, req.query.type
        ),
      });
    } catch (e) {
      return res.status(400).send({ error: e });
    }
  });

  /*
  ** Route to authenticate a Google connection and save the refresh token
  */
  app.put(`${url}/google/auth`, verifyToken, async (req, res) => {
    const { code } = req.body;
    const teamRole = await checkAccess(req);
    const permission = accessControl.can(teamRole.role).createAny("connection");
    if (!permission.granted) {
      return res.status(401).send({ error: "Not authorized" });
    }

    let gConnection;
    return googleConnector.getToken(code)
      .then((data) => {
        return oauthController.create({
          team_id: teamRole.team_id,
          email: data.user.email,
          refreshToken: data.tokens.refresh_token,
          type: "google",
        });
      })
      .then((oauth) => {
        return connectionController.update(
          req.params.connection_id,
          { oauth_id: oauth.id }
        );
      })
      .then((connection) => {
        gConnection = connection;
        return projectController.findById(connection.project_id);
      })
      .then((project) => {
        return res.status(200).send({
          team_id: project.team_id,
          connection: gConnection,
        });
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // ---------------------------------------------

  /*
  ** Get GA fields metadata
  */
  app.get(`${url}/google/ga/metadata`, verifyToken, async (req, res) => {
    const teamRole = await checkAccess(req);
    const permission = accessControl.can(teamRole.role).createAny("connection");
    if (!permission.granted) {
      return res.status(401).send({ error: "Not authorized" });
    }

    const connection = await connectionController.findById(req.params.connection_id);
    const oauth = await oauthController.findById(connection.oauth_id);
    if (!oauth) return res.status(400).send("OAuth is not registered properly");

    return googleConnector.getMetadata(oauth.refreshToken)
      .then((metadata) => {
        return res.status(200).send(metadata);
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });

  return (req, res, next) => {
    next();
  };
};
