const request = require("request-promise");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

function send(data) {
  const {
    integration, chart, alert, alertsFound,
  } = data;

  const dashboardUrl = `${settings.client}/project/${chart.project_id}`;

  const options = {
    url: integration.config.url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chart: chart.name,
      alert: {
        type: alert.type,
        rules: alert.rules,
      },
      alertsFound,
      dashboardUrl,
    }),
  };

  return request(options);
}

module.exports = {
  send,
};
