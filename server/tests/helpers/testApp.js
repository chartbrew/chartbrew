import express from "express";
import { urlencoded, json } from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import methodOverride from "method-override";
import _ from "lodash";
import path from "path";
import { fileURLToPath } from "url";

// Import your existing modules - we'll need to adjust paths
import parseQueryParams from "../../middlewares/parseQueryParams.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createTestApp() {
  const app = express();

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

  // We'll dynamically load routes here when needed
  return app;
}

export async function createTestAppWithRoutes() {
  const app = await createTestApp();

  // Dynamically import routes (we'll need to convert them to ES modules or use require)
  try {
    // For now, we'll import the routes module
    // Note: This might need adjustment based on your route structure
    const routes = await import("../../api/index.js");

    // Load the routes
    _.each(routes.default || routes, (controller, route) => {
      app.use(route, controller(app));
    });
  } catch (error) {
    console.warn("Could not load routes:", error.message);
    // For initial testing, we'll proceed without routes
  }

  return app;
}
