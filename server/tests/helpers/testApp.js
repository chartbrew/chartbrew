import express from "express";
import { urlencoded, json } from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import methodOverride from "method-override";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// Import your existing modules - we'll need to adjust paths
import parseQueryParams from "../../middlewares/parseQueryParams.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export async function createTestApp() {
  const app = express();

  // Mimic production behavior: server/index.js sets app.settings = settings
  // In tests, NODE_ENV is not "production", so settings-dev is used.
  // settings-dev reads process.env at require-time (set defaults in tests/setup.js).
  // eslint-disable-next-line global-require
  const settings = require("../../settings-dev.js");
  app.settings = settings;

  // Basic middleware setup (mimicking your main app)
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(urlencoded({ extended: true }));
  app.set("query parser", "simple");
  app.use(json());
  app.use(methodOverride("X-HTTP-Method-Override"));
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  }));
  app.use(cors());

  // Basic health check route
  app.get("/", (req, res) => {
    return res.json({ message: "Chartbrew Test API", status: "ok" });
  });

  // Load middlewares
  app.use(parseQueryParams);

  return app;
}

export async function createTestAppWithUserRoutes() {
  const app = await createTestApp();

  // Mount User routes by executing the route module with the app instance.
  // This matches server/index.js behavior (routes register handlers on the app).
  // eslint-disable-next-line global-require
  const userRoute = require("../../api/UserRoute.js");
  userRoute(app);

  return app;
}
