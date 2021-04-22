const request = require("request-promise");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

module.exports = (projectId, charts, authorization) => {
  charts.forEach((chart) => {
    const updateOpt = {
      url: `http://${settings.api}:${settings.port}/project/${projectId}/chart/${chart.id}`,
      method: "GET",
      headers: {
        authorization,
        accept: "application/json",
      },
      json: true,
    };
    request(updateOpt);
  });
};
