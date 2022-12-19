const db = require("../models/models");
const mail = require("./mail");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

function processAlert(chart, alert, alertsFound) {
  const {
    rules, mediums, recipients, type
  } = alert;
  const {
    value, lower, upper
  } = rules;

  const dashboardUrl = `${settings.client}/project/${chart.project_id}`;

  let thresholdText = "";
  if (type === "milestone") {
    thresholdText = `You reached your milestone of ${value}:`;
  } else if (type === "threshold_above") {
    thresholdText = `The following values were found above your threshold of ${value}:`;
  } else if (type === "threshold_below") {
    thresholdText = `The following values were found below your threshold of ${value}:`;
  } else if (type === "threshold_between") {
    thresholdText = `The following values were found between your thresholds of ${lower} and ${upper}:`;
  } else if (type === "threshold_outside") {
    thresholdText = `The following values were found outside your thresholds of ${lower} and ${upper}:`;
  }

  const stringAlerts = [];
  Object.keys(mediums).forEach((medium) => {
    const mediumData = mediums[medium];

    if (medium === "email" && mediumData.enabled) {
      alertsFound.forEach((a) => {
        stringAlerts.push(`${a.label}: ${a.value}`);
      });

      mail.sendChartAlert({
        chartName: chart.name,
        recipients,
        thresholdText,
        alerts: stringAlerts,
        dashboardUrl,
      });
    }
  });

  // deactivate alert if required
  if (alert.oneTime || alert.type === "milestone") {
    db.Alert.update({
      active: false,
    }, {
      where: { id: alert.id },
    });
  }

  // create an alert event
  return db.AlertEvent.create({
    alert_id: alert.id,
    trigger: alertsFound,
  });
}

async function checkChartForAlerts(chart) {
  const alerts = await db.Alert.findAll({
    where: {
      chart_id: chart.id,
      active: true,
    },
  });

  if (alerts.length === 0) {
    return null;
  }

  const { chartData, Datasets } = chart;

  Datasets.forEach((dataset, index) => {
    const chartDataset = chartData.data.datasets[index];
    const datasetAlerts = alerts.filter((alert) => alert.dataset_id === dataset.id);

    if (datasetAlerts.length > 0) {
      datasetAlerts.forEach((alert) => {
        const { rules, type } = alert;
        const { value, lower, upper } = rules;

        if (type === "milestone" && chartDataset.data) {
          // find potential alerts
          const alertsFound = [];
          chartDataset.data.forEach((d, i) => {
            if (d >= value) {
              alertsFound.push({
                label: chartData.data.labels[i],
                value: d,
              });
            }
          });

          if (alertsFound.length > 0) {
            processAlert(chart, alert, alertsFound);
          }
        } else if (type === "threshold_above" && chartDataset.data) {
          // find potential alerts
          const alertsFound = [];
          chartDataset.data.forEach((d, i) => {
            if (d > value) {
              alertsFound.push({
                label: chartData.data.labels[i],
                value: d,
              });
            }
          });

          if (alertsFound.length > 0) {
            processAlert(chart, alert, alertsFound);
          }
        } else if (type === "threshold_below" && chartDataset.data) {
          // find potential alerts
          const alertsFound = [];
          chartDataset.data.forEach((d, i) => {
            if (d < value) {
              alertsFound.push({
                label: chartData.data.labels[i],
                value: d,
              });
            }
          });

          if (alertsFound.length > 0) {
            processAlert(chart, alert, alertsFound);
          }
        } else if (type === "threshold_between" && chartDataset.data) {
          // find potential alerts
          const alertsFound = [];
          chartDataset.data.forEach((d, i) => {
            if (d > lower && d < upper) {
              alertsFound.push({
                label: chartData.data.labels[i],
                value: d,
              });
            }
          });

          if (alertsFound.length > 0) {
            processAlert(chart, alert, alertsFound);
          }
        } else if (type === "threshold_outside" && chartDataset.data) {
          // find potential alerts
          const alertsFound = [];
          chartDataset.data.forEach((d, i) => {
            if (d < lower || d > upper) {
              alertsFound.push({
                label: chartData.data.labels[i],
                value: d,
              });
            }
          });

          if (alertsFound.length > 0) {
            processAlert(chart, alert, alertsFound);
          }
        }
      });
    }
  });

  return null;
}

module.exports = {
  checkChartForAlerts,
};
