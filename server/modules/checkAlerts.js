const db = require("../models/models");
const mail = require("./mail");

function processAlert(chart, alert, alertsFound) {
  const { rules, mediums, recipients } = alert;
  const {
    type, value, lower, upper
  } = rules;

  let thresholdText = "";
  if (type === "threshhold_above") {
    thresholdText = `The following values were found above your threshold of ${value}:`;
  } else if (type === "threshhold_below") {
    thresholdText = `The following values were found below your threshold of ${value}:`;
  } else if (type === "threshhold_between") {
    thresholdText = `The following values were found outside your threshold of ${lower} and ${upper}:`;
  } else if (type === "threshhold_outside") {
    thresholdText = `The following values were found outside your threshold of ${lower} and ${upper}:`;
  }

  Object.keys(mediums).forEach((medium) => {
    const mediumData = mediums[medium];

    if (medium === "email" && mediumData.enabled) {
      let body = `
      ${thresholdText}`;

      alertsFound.forEach((a) => {
        body += `
        ${a.label}: ${a.value}`;
      });

      mail.sendChartAlert({
        chartName: chart.name,
        recipients,
        body,
      });
    }
  });
}

async function checkChart(chart) {
  const alerts = await db.Alert.findAll({
    where: {
      chart_id: chart.id,
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
        const { value } = rules;

        if (type === "threshold_above") {
          if (chartDataset.data[chartDataset.data.length - 1] > value) {
            // Send alert
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
        }
      });
    }
  });

  return null;
}

module.exports = {
  checkChart,
};
