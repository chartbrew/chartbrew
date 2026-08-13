const rateLimit = require("express-rate-limit");

const PlatformSettingsController = require("../controllers/PlatformSettingsController");
const verifyToken = require("../modules/verifyToken");

const platformSettingsLimiter = rateLimit({
  legacyHeaders: false,
  limit: 30,
  standardHeaders: true,
  windowMs: 60 * 1000,
});

function requirePlatformAdmin(req, res, next) {
  if (req.user?.admin !== true) {
    return res.status(403).send({ error: "You do not have access to platform settings" });
  }
  return next();
}

function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).send({
    error: statusCode < 500 && error.message
      ? error.message
      : "The request could not be completed",
  });
}

module.exports = (app) => {
  const controller = new PlatformSettingsController();
  const access = [platformSettingsLimiter, verifyToken, requirePlatformAdmin];

  app.get("/platform/settings", ...access, async (req, res) => {
    try {
      return res.send(await controller.get());
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.put("/platform/settings", ...access, async (req, res) => {
    try {
      return res.send(await controller.update(req.user.id, req.body));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/platform/settings/reset", ...access, async (req, res) => {
    try {
      return res.send(await controller.reset(req.body));
    } catch (error) {
      return sendError(res, error);
    }
  });

  return (req, res, next) => next();
};
