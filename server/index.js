const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const methodOverride = require("method-override");
const { urlencoded, json } = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const _ = require("lodash");
const { OneAccount } = require("oneaccount-express");
const morgan = require("morgan");
const helmet = require("helmet");
const fs = require("fs");
const busboy = require("connect-busboy");

const settings = process.env.NODE_ENV === "production" ? require("./settings") : require("./settings-dev");
const routes = require("./api");
const updateChartsCron = require("./modules/updateChartsCron");
const cleanChartCache = require("./modules/CleanChartCache");
const cleanAuthCache = require("./modules/CleanAuthCache");
const AuthCacheController = require("./controllers/AuthCacheController");

const authCache = new AuthCacheController();

// set up folders
fs.mkdir(".cache", () => {});
fs.mkdir("uploads", () => {});

const app = express();
app.settings = settings;

app.use(busboy());
if (process.env.NODE_ENV !== "production") {
  app.set("trust proxy", true);
  app.use(morgan("dev"));
}
app.use(cookieParser());
app.use(urlencoded({ extended: true }));
app.use(json());
app.use(methodOverride("X-HTTP-Method-Override"));
app.use(helmet());
app.use(cors());
app.use(new OneAccount({
  engine: {
    set: (k, v) => {
      authCache.set(k, v);
    },
    get: async (k) => {
      const v = await authCache.get(k); authCache.delete(k); return v;
    }
  },
  callbackURL: "/oneaccountauth"
}));
//---------------------------------------

app.get("/", (req, res) => {
  return res.send("Welcome to chartBrew server API");
});

app.use("/uploads", express.static("uploads"));

// Load the routes
_.each(routes, (controller, route) => {
  app.use(route, controller(app));
});

const port = process.env.PORT || app.settings.port || 4019;
app.listen(port, app.settings.api, () => {
  // Check if this is the main cluster and run the cron jobs if it is
  const isMainCluster = parseInt(process.env.NODE_APP_INSTANCE, 10) === 0;
  if (isMainCluster || !process.env.NODE_APP_INSTANCE) {
    // start CronJob, making sure the database is populated for the first time
    setTimeout(() => {
      updateChartsCron();
      cleanChartCache();
      cleanAuthCache();
    }, 5000);
  }

  console.log(`Running server on port ${port}`); // eslint-disable-line
});
