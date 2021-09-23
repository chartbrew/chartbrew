const compareVersions = require("compare-versions");
const request = require("request-promise");

const db = require("../models/models");
const packageJson = require("../package.json");

module.exports = (app) => {
  // check for updates [no permission check needed]
  app.get("/update", async (req, res) => {
    const [appData] = await db.App.findAll();

    const updateOpt = {
      url: `${app.settings.chartbrewMainAPI}/telemetry/updates`,
      method: "POST",
      form: {
        instance_id: appData.id,
        version: packageJson.version,
      },
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "chartbrew-os",
      },
      json: true,
    };

    return request(updateOpt)
      .then((latestRelease) => {
        if (compareVersions(latestRelease.tag_name, packageJson.version) === 1) {
          return res.status(200).send(latestRelease);
        }

        return res.status(200).send({ upToDate: true });
      })
      .catch(() => {
        return res.status(200).send({ upToDate: true });
      });
  });

  return (req, res, next) => {
    next();
  };
};
