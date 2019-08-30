const User = require("../models/User");
const jwt = require("jsonwebtoken");
const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports = (req, res, next) => {
  const token = req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : "";
  const requestedOwner = req.params.id || req.body.id || req.query.id;
  if (!requestedOwner) return res.status(401).send("Unauthorized access.");

  if (token) {
    return jwt.verify(token, settings.secret, (err, decoded) => {
      if (err) return res.status(401).send("Unauthorized access.");

      return User.findByPk(decoded.id).then((user) => {
        if (!user) return res.status(400).send("Could not process your user information. Try again later.");
        if (user.id === parseInt(requestedOwner, 0)) {
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
