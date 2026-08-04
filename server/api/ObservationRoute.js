const rateLimit = require("express-rate-limit");

const HomeController = require("../controllers/HomeController");
const DigestController = require("../controllers/DigestController");
const MonitorController = require("../controllers/MonitorController");
const ObservationController = require("../controllers/ObservationController");
const verifyToken = require("../modules/verifyToken");
const { getObservationAccess } = require("../modules/observations/access");

const apiLimiter = rateLimit({
  limit: 100,
  windowMs: 60 * 1000,
});

const testDigestLimiter = rateLimit({
  keyGenerator: (req) => `${req.user.id}:${req.params.team_id}`,
  legacyHeaders: false,
  limit: 3,
  standardHeaders: true,
  windowMs: 60 * 60 * 1000,
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime?.getTime?.() || (Date.now() + (60 * 60 * 1000));
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
    const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    res.set("Retry-After", `${retryAfterSeconds}`);
    return res.status(429).send({
      code: "SUMMARY_TEST_RATE_LIMITED",
      error: `You have sent too many test summaries. Try again in ${retryAfterMinutes} minutes.`,
      retryAfterSeconds,
    });
  },
});

function sendError(res, error) {
  return res.status(error.statusCode || 500).send({
    error: error.message || "The request could not be completed",
  });
}

function checkAccess() {
  return async (req, res, next) => {
    try {
      req.observationAccess = await getObservationAccess(req.params.team_id, req.user.id);
      return next();
    } catch (error) {
      return sendError(res, error);
    }
  };
}

module.exports = (app) => {
  const homeController = new HomeController();
  const digestController = new DigestController();
  const monitorController = new MonitorController();
  const observationController = new ObservationController();
  const routeAccess = [apiLimiter, verifyToken, checkAccess()];

  app.get("/team/:team_id/home", ...routeAccess, async (req, res) => {
    try {
      return res.send(await homeController.getHome(req.observationAccess));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/team/:team_id/activity", ...routeAccess, async (req, res) => {
    try {
      return res.send(await homeController.getActivity(req.observationAccess, req.query));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/team/:team_id/data-health", ...routeAccess, async (req, res) => {
    try {
      return res.send(await homeController.getDataHealth(req.observationAccess));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/team/:team_id/alerts", ...routeAccess, async (req, res) => {
    try {
      return res.send(await homeController.getAlerts(req.observationAccess));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/team/:team_id/observations", ...routeAccess, async (req, res) => {
    try {
      return res.send(await observationController.list(req.observationAccess, req.query));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/team/:team_id/observations/:observation_id", ...routeAccess, async (req, res) => {
    try {
      return res.send(await observationController.detail(
        req.observationAccess,
        req.params.observation_id
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.put("/team/:team_id/observations/:observation_id/preference", ...routeAccess, async (req, res) => {
    try {
      return res.send(await observationController.updatePreference(
        req.observationAccess,
        req.params.observation_id,
        req.body
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/team/:team_id/observations/:observation_id/feedback", ...routeAccess, async (req, res) => {
    try {
      return res.send(await observationController.feedback(
        req.observationAccess,
        req.params.observation_id,
        req.body
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/team/:team_id/observations/:observation_id/resolve", ...routeAccess, async (req, res) => {
    try {
      return res.send(await observationController.setResolved(
        req.observationAccess,
        req.params.observation_id,
        true
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/team/:team_id/observations/:observation_id/reopen", ...routeAccess, async (req, res) => {
    try {
      return res.send(await observationController.setResolved(
        req.observationAccess,
        req.params.observation_id,
        false
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/team/:team_id/observations/:observation_id/investigate", ...routeAccess, async (req, res) => {
    try {
      return res.send(await observationController.investigate(
        req.observationAccess,
        req.params.observation_id
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/team/:team_id/observations/:observation_id/drivers", ...routeAccess, async (req, res) => {
    try {
      return res.send(await observationController.drivers(
        req.observationAccess,
        req.params.observation_id
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/team/:team_id/monitors", ...routeAccess, async (req, res) => {
    try {
      return res.send(await monitorController.list(req.observationAccess));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/team/:team_id/charts/:chart_id/monitor-options", ...routeAccess, async (req, res) => {
    try {
      return res.send(await monitorController.options(
        req.observationAccess,
        req.params.chart_id
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/team/:team_id/record-count-options", ...routeAccess, async (req, res) => {
    try {
      return res.send(await monitorController.recordCountOptions(req.observationAccess));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/team/:team_id/record-count-monitors", ...routeAccess, async (req, res) => {
    try {
      return res.status(201).send(await monitorController.createRecordCount(
        req.observationAccess,
        req.body
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/team/:team_id/monitors", ...routeAccess, async (req, res) => {
    try {
      return res.status(201).send(await monitorController.create(
        req.observationAccess,
        req.body,
        req.user
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.put("/team/:team_id/monitors/:monitor_id", ...routeAccess, async (req, res) => {
    try {
      return res.send(await monitorController.update(
        req.observationAccess,
        req.params.monitor_id,
        req.body
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.delete("/team/:team_id/monitors/:monitor_id", ...routeAccess, async (req, res) => {
    try {
      return res.send(await monitorController.remove(
        req.observationAccess,
        req.params.monitor_id
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/team/:team_id/monitors/:monitor_id/refresh", ...routeAccess, async (req, res) => {
    try {
      return res.send(await monitorController.refresh(
        req.observationAccess,
        req.params.monitor_id,
        req.user
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/team/:team_id/observation-digests", ...routeAccess, async (req, res) => {
    try {
      return res.send(await digestController.list(req.observationAccess));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/team/:team_id/observation-digests/options", ...routeAccess, async (req, res) => {
    try {
      return res.send(await digestController.options(req.observationAccess));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/team/:team_id/observation-digests/preview", ...routeAccess, async (req, res) => {
    try {
      return res.send(await digestController.preview(req.observationAccess, req.body));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/team/:team_id/observation-digests", ...routeAccess, async (req, res) => {
    try {
      return res.status(201).send(await digestController.create(
        req.observationAccess,
        req.body,
      ));
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.put(
    "/team/:team_id/observation-digests/:subscription_id",
    ...routeAccess,
    async (req, res) => {
      try {
        return res.send(await digestController.update(
          req.observationAccess,
          req.params.subscription_id,
          req.body,
        ));
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  app.delete(
    "/team/:team_id/observation-digests/:subscription_id",
    ...routeAccess,
    async (req, res) => {
      try {
        return res.send(await digestController.remove(
          req.observationAccess,
          req.params.subscription_id,
        ));
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  app.post(
    "/team/:team_id/observation-digests/:subscription_id/send-test",
    ...routeAccess,
    testDigestLimiter,
    async (req, res) => {
      try {
        return res.send(await digestController.sendTest(
          req.observationAccess,
          req.params.subscription_id,
        ));
      } catch (error) {
        return sendError(res, error);
      }
    },
  );

  return (req, res, next) => next();
};
