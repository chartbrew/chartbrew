// set up the encryption keys first, then load .env file
const setUpEncryptionKeys = require("./modules/setUpEncryptionKeys"); // eslint-disable-line

setUpEncryptionKeys();

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const methodOverride = require("method-override");
const { urlencoded, json } = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const _ = require("lodash");
const morgan = require("morgan");
const helmet = require("helmet");
const fs = require("fs");
const busboy = require("connect-busboy");

const settings = process.env.NODE_ENV === "production" ? require("./settings") : require("./settings-dev");
const routes = require("./api");
const updateChartsCron = require("./modules/updateChartsCron");
const cleanChartCache = require("./modules/CleanChartCache");
const cleanAuthCache = require("./modules/CleanAuthCache");
const parseQueryParams = require("./middlewares/parseQueryParams");
const db = require("./models/models");
const packageJson = require("./package.json");
const cleanGhostChartsCron = require("./modules/cleanGhostChartsCron");
const { checkEncryptionKeys } = require("./modules/cbCrypto");

// check if the encryption keys are valid 32-byte hex strings
checkEncryptionKeys();

// set up folders
fs.mkdir(".cache", () => {});
fs.mkdir("uploads", () => {});

const app = express();
app.settings = settings;

app.set("trust proxy", 1);

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
//---------------------------------------

app.get("/", (req, res) => {
  return res.send("Welcome to chartBrew server API");
});

app.use("/uploads", express.static("uploads"));

// load middlewares
app.use(parseQueryParams);

// Load the routes
_.each(routes, (controller, route) => {
  app.use(route, controller(app));
});

const port = process.env.PORT || app.settings.port || 4019;

db.migrate()
  .then(async (data) => {
    if (data && data.length > 0) {
      console.info("Updated database schema to the latest version!"); // eslint-disable-line
    }

    // create an instance ID and record the current version
    try {
      const appData = await db.App.findAll();
      if (!appData || appData.length === 0) {
        db.App.create({ version: packageJson.version });
      } else if (appData && appData[0]) {
        db.App.update({ version: packageJson.version }, { where: { id: appData[0].id } });
      }
    } catch (e) {
      // continue
    }

    app.listen(port, app.settings.api, () => {
      // Check if this is the main cluster and run the cron jobs if it is
      const isMainCluster = parseInt(process.env.NODE_APP_INSTANCE, 10) === 0;
      if (isMainCluster || !process.env.NODE_APP_INSTANCE) {
        // start CronJob, making sure the database is populated for the first time
        setTimeout(() => {
          updateChartsCron();
          cleanChartCache();
          cleanAuthCache();
          cleanGhostChartsCron();
        }, 5000);
      }

      console.log(`Running server on port ${port}`); // eslint-disable-line
    });
  })
  .catch((err) => {
    console.error(err); // eslint-disable-line
    console.error("Migrations failed, could not run the server app."); // eslint-disable-line
  });
