const jwt = require("jsonwebtoken");
const request = require("request");
const rateLimit = require("express-rate-limit");

const UserController = require("../controllers/UserController");
const TeamController = require("../controllers/TeamController");
const verifyUser = require("../modules/verifyUser");
const verifyToken = require("../modules/verifyToken");
const userResponse = require("../modules/userResponse");

const apiLimiter = (max = 10) => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max,
  });
};

module.exports = (app) => {
  const userController = new UserController();
  const teamController = new TeamController();

  const tokenizeUser = ((user, res) => {
    const userToken = {
      id: user.id,
      email: user.email,
    };
    jwt.sign(userToken, app.settings.encryptionKey, {
      expiresIn: 2592000 // a month
    }, (err, token) => {
      if (err) return res.status(400).send(err);
      const tokenizedResponse = userResponse(user);
      tokenizedResponse.token = token;
      return res.status(200).send(tokenizedResponse);
    });
  });

  /*
  ** [MASTER] Route to get all the users
  */
  app.get("/user", verifyToken, (req, res) => {
    if (!req.user.admin) {
      return res.status(401).send({ error: "Not Authorized" });
    }

    return userController.findAll()
      .then((users) => {
        return res.status(200).send(users);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to get the user by id
  */
  app.get("/user/:id", verifyUser, (req, res) => {
    userController.findById(req.params.id)
      .then((user) => {
        return res.status(200).send(userResponse(user));
      })
      .catch((error) => {
        if (error === "404") return res.status(404).send("The user is not found");
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route for creating a new user
  */
  app.post("/user", async (req, res) => {
    if (!req.body.email || !req.body.password) return res.status(400).send("no email or password");

    if (app.settings.signupRestricted === "1") {
      try {
        const areThereAnyUsers = await userController.areThereAnyUsers();
        if (areThereAnyUsers) {
          return res.status(401).send("Signups are restricted");
        }
      } catch (e) {
        // do nothing
      }
    }

    const icon = req.body.name.substring(0, 2);
    const userObj = {
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      active: false,
      icon: icon.toUpperCase(),
    };

    return userController.createUser(userObj)
      .then((newUser) => {
        return tokenizeUser(newUser, res);
      })
      .catch((error) => {
        if (error.message === "409") return res.status(409).send("The email is already used");
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to delete a user
  */
  app.delete("/user/:id", verifyToken, (req, res) => {
    if (req.user.id !== parseInt(req.params.id, 10)) return res.status(401).send("Unauthorised user");
    let user = {};
    return userController.findById(req.params.id)
      .then((foundUser) => {
        user = foundUser;
        const deletePromises = [];
        // delete the team if user is owner
        user.TeamRoles.forEach((teamRole) => {
          if (teamRole.role === "teamOwner") {
            deletePromises.push(teamController.deleteTeam(teamRole.team_id));
          }
        });

        return Promise.all(deletePromises);
      })
      .then(() => {
        return userController.deleteUser(user.id);
      })
      .then(() => {
        return res.status(200).send({});
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to process invitations
  */
  app.post("/user/invited", (req, res) => {
    if (!req.body.email || !req.body.password) return res.status(400).send("no email or password");

    const icon = req.body.name.substring(0, 2);

    const userObj = {
      email: req.body.email,
      password: req.body.password,
      name: req.body.name,
      icon: icon.toUpperCase(),
      active: true,
    };

    return userController.createUser(userObj)
      .then((newUser) => {
        return tokenizeUser(newUser, res);
      })
      .catch((error) => {
        if (error.message === "409") return res.status(409).send("The email is already used");
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to verify new users (not used atm)
  */
  app.get("/user/:id/verify", verifyUser, (req, res) => {
    return userController.update(req.params.id, { "active": true })
      .then((user) => {
        return res.status(200).send({
          id: user.id, name: user.name, active: user.active, token: req.token
        });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to login users
  */
  app.post("/user/login", apiLimiter(10), (req, res) => {
    if (!req.body.email || !req.body.password) return res.status(400).send("fields are missing");
    let user = {};
    return userController.login(req.body.email, req.body.password)
      .then((data) => {
        if (data?.method_id) {
          return data;
        }

        user = data;
        return userController.update(user.id, { lastLogin: new Date() });
      })
      .then((data) => {
        if (data?.method_id) {
          return res.status(200).json(data);
        }
        return tokenizeUser(user, res);
      })
      .catch((error) => {
        if (error.message === "401") {
          return res.status(401).json({ message: "The credentials are incorrect" });
        }

        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to relog users based on their tokens
  */
  app.post("/user/relog", verifyToken, (req, res) => {
    return userController.update(req.user.id, { lastLogin: new Date() })
      .then(() => {
        return res.status(200).send(req.user);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to modify users' fields
  */
  app.put("/user/:id", verifyUser, (req, res) => {
    if (!req.body || !req.params.id) return res.status(400).send("Missing fields");
    return userController.update(req.params.id, req.body)
      .then((user) => {
        return res.status(200).send(userResponse(user));
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to get all team invites for the user
  */
  app.get("/user/:id/teamInvites", verifyToken, (req, res) => {
    if (req.user.id !== parseInt(req.params.id, 10)) return res.status(401).send("unauthorised user");
    return userController.findById(req.params.id)
      .then((user) => {
        return userController.getTeamInvitesByUser(user.email);
      })
      .then((invites) => {
        return res.status(200).send(invites);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to send a new feedback email
  */
  app.post("/user/feedback", (req, res) => {
    let { from } = req.body;
    if (!from) from = "Anonymous";

    const message = {
      "from": { "email": "info@depomo.com" },
      "subject": `${from} left us a feedback - ${req.body.email}`,
      "personalizations": [{
        "to": [{ email: "info@depomo.com" }]
      }],
      "content": [
        {
          "type": "text/plain",
          "value": req.body.data
        }
      ]
    };

    const options = {
      method: "POST",
      url: `${app.settings.sendgridHost}/mail/send`,
      body: JSON.stringify(message),
      headers: {
        authorization: `Bearer ${app.settings.sendgridKey}`,
        "content-type": "application/json"
      }
    };

    return request(options, (err) => {
      if (err) return res.status(400).send(err);
      return res.status(200).send({});
    });
  });
  // --------------------------------------

  /*
  ** Route to request a password reset email
  */
  app.post("/user/password/reset", apiLimiter(10), (req, res) => {
    userController.requestPasswordReset(req.body.email);
    return res.status(200).send({ "success": true });
  });
  // --------------------------------------

  /*
  ** Route to change the password with a password reset link info
  */
  app.put("/user/password/change", apiLimiter(10), (req, res) => {
    return userController.changePassword(req.body)
      .then((result) => {
        return res.status(200).send(result);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to check if there are any users registered in the database
  */
  app.get("/app/users", (req, res) => {
    return userController.areThereAnyUsers()
      .then((result) => {
        return res.status(200).send({ areThereAnyUsers: result });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to request a new email verification email
  */
  app.post("/user/:id/email/verify", apiLimiter(10), verifyUser, (req, res) => {
    if (!req.body.email) return res.status(400).send("Missing fields");

    return userController.requestEmailUpdate(req.params.id, req.body.email)
      .then(() => {
        return res.status(200).send({ "success": true });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to update the email of a user with the verification link info
  */
  app.put("/user/:id/email/update", verifyUser, (req, res) => {
    if (!req.body.token) return res.status(400).send("Missing fields");
    return userController.updateEmail(req.params.id, req.body.token)
      .then((user) => {
        return res.status(200).send(userResponse(user));
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to set up 2FA app for a user
  */
  app.post("/user/:id/2fa/app", apiLimiter(5), verifyToken, (req, res) => {
    return userController.setup2faApp(req.user.id)
      .then((qrUrl) => {
        return res.status(200).send({ qrUrl });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to verify the 2FA app for a user
  */
  app.post("/user/:id/2fa/app/verify", apiLimiter(5), verifyToken, (req, res) => {
    return userController.verify2faApp(req.user.id, req.body)
      .then((backupCodes) => {
        return res.status(200).send({ backupCodes });
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to validate 2fa login method
  */
  app.post("/user/:id/2fa/:method_id/login", apiLimiter(5), (req, res) => {
    let user;
    return userController.validate2FaLogin(req.params.id, req.body.method_id, req.body.token)
      .then((data) => {
        user = data;
        return userController.update(user.id, { lastLogin: new Date() });
      })
      .then(() => {
        return tokenizeUser(user, res);
      })
      .catch((error) => {
        if (error.message === "401") return res.status(401).send("The credentials are incorrect");
        if (error.message === "404") return res.status(404).send("The email is not registreded");
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to get all 2fa methods for a user
  */
  app.get("/user/:id/2fa", verifyToken, (req, res) => {
    return userController.get2faMethods(req.user.id)
      .then((methods) => {
        return res.status(200).send(methods);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  });
  // --------------------------------------

  /*
  ** Route to remove a 2fa method
  */
  app.delete("/user/:id/2fa/:method_id", verifyToken, (req, res) => {
    return userController.remove2faMethod(req.user.id, req.params.method_id, req.body.password)
      .then((result) => {
        return res.status(200).send({ removed: result });
      })
      .catch((err) => {
        return res.status(400).send(err);
      });
  });
  // -------------------------------------

  return (req, res, next) => {
    next();
  };
};
