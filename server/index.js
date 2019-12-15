require("dotenv").config();

const express = require("express");
const methodOverride = require("method-override");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const _ = require("lodash");

const settings = process.env.NODE_ENV === "production" ? require("./settings") : require("./settings-dev");
const routes = require("./api");
const updateChartsCron = require("./modules/updateChartsCron");
const cleanChartCache = require("./modules/CleanChartCache");

const app = express();
app.settings = settings;

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride("X-HTTP-Method-Override"));

app.use(cors());
//---------------------------------------


app.get("/", (req, res) => {
  return res.send("Welcome to chartBrew server API");
});

// Load the routes
_.each(routes, (controller, route) => {
  app.use(route, controller(app));
});

app.listen(app.settings.port, () => {
  // start CronJob, making sure the database is populated for the first time
  setTimeout(() => {
    updateChartsCron();
    cleanChartCache();
  }, 3000);

  console.log(`Running server on port ${app.settings.port}`); // eslint-disable-line
});
