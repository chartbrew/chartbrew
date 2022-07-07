const jwt = require("jsonwebtoken");

const db = require("../models/models");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports = async (req, res, next) => {
  const token = req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : "";
  const requestedOwner = req.params.id || req.body.id || req.query.id;
  if (!requestedOwner) return res.status(401).send("Unauthorized access.");

  if (token) {
    try {
      const blacklisted = await db.TokenBlacklist.findOne({ where: { token } });
      if (blacklisted) return res.status(401).send("Unauthorized access.");
    } catch (e) { /** */ }

    return jwt.verify(token, settings.secret, (err, decoded) => {
      if (err) return res.status(401).send("Unauthorized access.");

      return db.User.findByPk(decoded.id).then((user) => {
        if (!user) return res.status(400).send("Could not process your user information. Try again later.");
        if (user.id === parseInt(requestedOwner, 10)) {
          req.decoded = decoded;
          req.token = token;
          return next();
        } else {
          return res.status(401).send("Unauthorized access!");
        }
      }).catch((error) => { return res.status(400).send(error); });
    });
  } else {
    return res.status(401).send("Token is missing.");
  }
};
