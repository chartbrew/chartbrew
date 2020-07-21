const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const methodOverride = require("method-override");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const _ = require("lodash");
const { OneAccount } = require("oneaccount-express");

const settings = process.env.NODE_ENV === "production" ? require("./settings") : require("./settings-dev");
const routes = require("./api");
const updateChartsCron = require("./modules/updateChartsCron");
const cleanChartCache = require("./modules/CleanChartCache");
const cleanAuthCache = require("./modules/CleanAuthCache");
const AuthCacheController = require("./controllers/AuthCacheController");
const authCache = new AuthCacheController();

const app = express();
app.settings = settings;

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride("X-HTTP-Method-Override"));

app.use(cors());
app.use(new OneAccount({
  engine: {
    set: (k, v) => {
      authCache.set(k, v);
    },
    get: async (k) => {
      let v = await authCache.get(k); authCache.delete(k); return v;
    }
  },
  callbackURL: "/oneaccountauth"
}));
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
    cleanAuthCache();
  }, 3000);

  console.log(`Running server on port ${app.settings.port}`); // eslint-disable-line
});
