const TeamController = require("../controllers/TeamController");
const ConnectionController = require("../controllers/ConnectionController");
const oauthController = require("../controllers/OAuthController");

const verifyToken = require("../modules/verifyToken");
const accessControl = require("../modules/accessControl");
const googleConnector = require("../modules/googleConnector");

module.exports = (app) => {
  const teamController = new TeamController();
  const connectionController = new ConnectionController();

  const url = "/team/:team_id/connections/:connection_id";

  const checkPermissions = (actionType = "readOwn") => {
    return async (req, res, next) => {
      const { team_id } = req.params;

      // Fetch the TeamRole for the user
      const teamRole = await teamController.getTeamRole(team_id, req.user.id);

      if (!teamRole) {
        return res.status(403).json({ message: "Access denied" });
      }

      const permission = accessControl.can(teamRole.role)[actionType]("connection");
      if (!permission.granted) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { role, projects } = teamRole;

      // Handle permissions for teamOwner and teamAdmin
      if (["teamOwner", "teamAdmin"].includes(role)) {
        req.user.isEditor = true;
        return next();
      }

      if (role === "projectAdmin" || role === "projectEditor" || role === "projectViewer") {
        const connections = await connectionController.findByProjects(team_id, projects);
        if (!connections || connections.length === 0) {
          return res.status(404).json({ message: "No connections found" });
        }

        return next();
      }

      return res.status(403).json({ message: "Access denied" });
    };
  };

  /*
  ** Route to get the Google authentication URL
  */
  app.get(`${url}/google/auth`, verifyToken, checkPermissions("createAny"), async (req, res) => {
    try {
      return res.status(200).send({
        url: googleConnector.getAuthUrl(
          req.params.team_id, req.params.connection_id, req.query.type
        ),
      });
    } catch (e) {
      return res.status(400).send({ error: e });
    }
  });

  /*
  ** Route to authenticate a Google connection and save the refresh token
  */
  app.put(`${url}/google/auth`, verifyToken, checkPermissions("createAny"), async (req, res) => {
    const { code } = req.body;

    return googleConnector.getToken(code)
      .then((data) => {
        return oauthController.create({
          team_id: req.params.team_id,
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
        return res.status(200).send({
          team_id: req.params.team_id,
          connection,
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
  app.get(`${url}/google/ga/metadata`, verifyToken, checkPermissions("createAny"), async (req, res) => {
    const { property_id } = req.query;

    if (!property_id) return res.status(400).send("Missing property_id");

    const connection = await connectionController.findById(req.params.connection_id);
    const oauth = await oauthController.findById(connection.oauth_id);
    if (!oauth) return res.status(400).send("OAuth is not registered properly");

    return googleConnector.getMetadata(oauth.refreshToken, property_id)
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
