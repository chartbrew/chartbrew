const request = require("./safeRequest");

const settings = require("../settings");

module.exports = (projectId, charts, authorization) => {
  return Promise.all(charts.map((chart) => {
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
      followRedirect: false,
    };

    return request(updateOpt, { allowPrivateHost: true, source: "chart_refresh" });
  }));
};
