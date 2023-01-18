const request = require("request-promise");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

function send(data) {
  const {
    integration, chart, alert, alertsFound,
  } = data;

  const dashboardUrl = `${settings.client}/project/${chart.project_id}`;

  // build the message for slack webhooks
  const { value, lower, upper } = alert.rules;
  let title = "";
  if (alert.type === "milestone") {
    title = `You reached your milestone of *${value}*!`;
  } else if (alert.type === "threshold_above") {
    title = `Chartbrew found some values above your threshold of *${value}*.`;
  } else if (alert.type === "threshold_below") {
    title = `Chartbrew found some values below your threshold of *${value}*.`;
  } else if (alert.type === "threshold_between") {
    title = `Chartbrew found some values between your thresholds of *${lower}* and *${upper}*.`;
  } else if (alert.type === "threshold_outside") {
    title = `Chartbrew found some values your thresholds of *${lower}* and *${upper}*.`;
  }

  const valueSections = [];
  alertsFound.forEach((a) => {
    valueSections.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${a.label}*: ${a.value}`,
      },
    });
  });

  const blocks = [{
    type: "section",
    text: {
      type: "mrkdwn",
      text: `:bell: Alert for *${chart.name}*`,
    },
  }, {
    type: "section",
    text: {
      type: "mrkdwn",
      text: title,
    },
  }, {
    type: "divider",
  },
  ...valueSections,
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": `<${dashboardUrl}|*View your dashboard*>`,
    }
  }];

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
      blocks: integration.config.slackMode ? blocks : [],
    }),
  };

  return request(options);
}

module.exports = {
  send,
};
