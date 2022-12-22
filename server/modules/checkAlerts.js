const { add, isPast } = require("date-fns");

const db = require("../models/models");
const mail = require("./mail");

const settings = process.env.NODE_ENV === "production" ? require("../settings") : require("../settings-dev");

function processAlert(chart, alert, alerts) {
  const {
    rules, mediums, recipients, type
  } = alert;
  const {
    value, lower, upper
  } = rules;

  let alertsFound = alerts;

  // for timeseries alerts, check if the alert has occured before
  if (chart.getDataValue("isTimeseries") && alert.events && alert.events.length > 0) {
    const lastEvent = alert.events[0];

    if (lastEvent.trigger && lastEvent.trigger.length > 0) {
      const eventItems = lastEvent.trigger.map((item) => item.label);
      // find the index of the first event item
      const firstEventIndex = alertsFound.indexOf((item) => item.label === eventItems[0]);
      // remove all alerts before the first event item
      alertsFound = alertsFound.slice(firstEventIndex);
      // remove alerts that have already been sent
      alertsFound = alertsFound.filter((item) => !eventItems.includes(item.label));
    }
  }

  if (alertsFound.length === 0) {
    return false;
  }

  const dashboardUrl = `${settings.client}/project/${chart.project_id}`;

  let thresholdText = "";
  if (type === "milestone") {
    thresholdText = `You reached your milestone of ${value}!`;
  } else if (type === "threshold_above") {
    thresholdText = `Chartbrew found some values above your threshold of ${value}.`;
  } else if (type === "threshold_below") {
    thresholdText = `Chartbrew found some values below your threshold of ${value}.`;
  } else if (type === "threshold_between") {
    thresholdText = `Chartbrew found some values between your thresholds of ${lower} and ${upper}.`;
  } else if (type === "threshold_outside") {
    thresholdText = `Chartbrew found some values your thresholds of ${lower} and ${upper}.`;
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
  const dbAlerts = await db.Alert.findAll({
    where: {
      chart_id: chart.id,
      active: true,
    },
    include: [{
      model: db.AlertEvent,
      as: "events",
    }],
    order: [[{ model: db.AlertEvent, as: "events" }, "createdAt", "DESC"]]
  });

  if (dbAlerts.length === 0) {
    return null;
  }

  // filter alerts based on the time of the last event
  const alerts = dbAlerts.filter((alert) => {
    if (alert.events.length === 0) {
      return true;
    }

    const lastEvent = alert.events[0];
    const timeout = add(new Date(lastEvent.createdAt), { seconds: alert.timeout });
    return isPast(timeout);
  });

  const { chartData, Datasets } = chart;

  Datasets.forEach((dataset, index) => {
    const chartDataset = chartData.data.datasets[index];
    const datasetAlerts = alerts.filter((alert) => alert.dataset_id === dataset.id);

    if (datasetAlerts.length > 0) {
      datasetAlerts.forEach((alert) => {
        let dataItems = chartDataset.data;
        if (chart.getDataValue("isTimeseries") && alert.events.length === 0) {
          dataItems = [chartDataset.data[chartDataset.data.length - 1]];
        }
        const { rules, type } = alert;
        const { value, lower, upper } = rules;

        if (type === "milestone" && dataItems) {
          // find potential alerts
          const alertsFound = [];
          dataItems.forEach((d, i) => {
            const labelIndex = dataItems.length === 1 ? chartData.data.labels.length - 1 : i;
            if (d >= value) {
              alertsFound.push({
                label: chartData.data.labels[labelIndex],
                value: d,
              });
            }
          });

          if (alertsFound.length > 0) {
            processAlert(chart, alert, alertsFound);
          }
        } else if (type === "threshold_above" && dataItems) {
          // find potential alerts
          const alertsFound = [];
          dataItems.forEach((d, i) => {
            const labelIndex = dataItems.length === 1 ? chartData.data.labels.length - 1 : i;
            if (d > value) {
              alertsFound.push({
                label: chartData.data.labels[labelIndex],
                value: d,
              });
            }
          });

          if (alertsFound.length > 0) {
            processAlert(chart, alert, alertsFound);
          }
        } else if (type === "threshold_below" && dataItems) {
          // find potential alerts
          const alertsFound = [];
          dataItems.forEach((d, i) => {
            const labelIndex = dataItems.length === 1 ? chartData.data.labels.length - 1 : i;
            if (d < value) {
              alertsFound.push({
                label: chartData.data.labels[labelIndex],
                value: d,
              });
            }
          });

          if (alertsFound.length > 0) {
            processAlert(chart, alert, alertsFound);
          }
        } else if (type === "threshold_between" && dataItems) {
          // find potential alerts
          const alertsFound = [];
          dataItems.forEach((d, i) => {
            const labelIndex = dataItems.length === 1 ? chartData.data.labels.length - 1 : i;
            if (d > lower && d < upper) {
              alertsFound.push({
                label: chartData.data.labels[labelIndex],
                value: d,
              });
            }
          });

          if (alertsFound.length > 0) {
            processAlert(chart, alert, alertsFound);
          }
        } else if (type === "threshold_outside" && dataItems) {
          // find potential alerts
          const alertsFound = [];
          dataItems.forEach((d, i) => {
            const labelIndex = dataItems.length === 1 ? chartData.data.labels.length - 1 : i;
            if (d < lower || d > upper) {
              alertsFound.push({
                label: chartData.data.labels[labelIndex],
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
