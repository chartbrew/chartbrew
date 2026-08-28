const db = require("../models/models");
const userResponse = require("./userResponse");
const verifySessionToken = require("./verifySessionToken");

function sendAuthenticationFailure(handler, req, res, statusCode, body) {
  if (handler) return handler(req, res, statusCode);
  return res.status(statusCode).send(body);
}

async function verifyToken(req, res, next, failureHandler = null, options = {}) {
  const token = req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : "";
  if (token) {
    try {
      const blacklisted = await db.TokenBlacklist.findOne({ where: { token } });
      if (blacklisted) {
        return sendAuthenticationFailure(failureHandler, req, res, 401, "Unauthorized access.");
      }
    } catch (e) { /** */ }

    let decoded;
    try {
      decoded = verifySessionToken(token);
    } catch (err) {
      return sendAuthenticationFailure(failureHandler, req, res, 401, "Unauthorized access.");
    }

    if (!decoded?.id) {
      return sendAuthenticationFailure(failureHandler, req, res, 401, "Unauthorized access.");
    }

    if (options.validateToken) {
      try {
        const valid = await options.validateToken(decoded, token);
        if (!valid) {
          return sendAuthenticationFailure(failureHandler, req, res, 401, "Unauthorized access.");
        }
      } catch (_error) {
        return sendAuthenticationFailure(failureHandler, req, res, 401, "Unauthorized access.");
      }
    }

    return db.User.findOne({
      where: { id: decoded.id },
      include: [{
        model: db.User2fa,
        attributes: ["id", "method"],
        where: { isEnabled: true },
        required: false
      }, {
        model: db.PinnedDashboard,
        required: false,
      }]
    })
      .then((user) => {
        if (!user) {
          return sendAuthenticationFailure(
            failureHandler,
            req,
            res,
            400,
            "Could not process the request. Please try again."
          );
        }

        const userObj = userResponse(user);
        userObj.token = token;
        userObj.admin = user.admin;

        req.user = userObj;
        return next();
      })
      .catch((error) => {
        return sendAuthenticationFailure(failureHandler, req, res, 400, error);
      });
  } else {
    return sendAuthenticationFailure(failureHandler, req, res, 401, "Token is missing.");
  }
}

verifyToken.withErrorHandler = (handler, options = {}) => {
  return (req, res, next) => verifyToken(req, res, next, handler, options);
};

module.exports = verifyToken;
