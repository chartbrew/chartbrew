const request = require("request-promise");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports = (projectId, charts, authorization) => {
  charts.forEach((chart) => {
    const updateOpt = {
      url: `http://${settings.api}:${settings.port}/project/${projectId}/chart/${chart.id}/query`,
      method: "POST",
      headers: {
        authorization,
        accept: "application/json",
      },
      qs: {
        getCache: true,
      },
      json: true,
    };

    request(updateOpt);
  });
};
