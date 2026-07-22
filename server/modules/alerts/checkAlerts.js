const { add, isPast } = require("date-fns");
const request = require("request-promise");
const moment = require("moment");
const ChartController = require("../../controllers/ChartController");

const db = require("../../models/models");
const mail = require("../mail");
const {
  findThresholdMatches,
  getAlertSeries,
  getChartValue,
  isNumericAlertValue,
  makeAlertItem,
  removePreviouslyTriggeredItems,
} = require("./alertSeries");
const webhookAlerts = require("./webhookAlerts");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const fullApiUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_API_HOST : process.env.VITE_APP_API_HOST_DEV;

async function findAnomalyMatches(chart, series) {
  const dateFormat = getChartValue(chart, "dateFormat");
  if (!dateFormat) return [];

  const labels = getChartValue(chart, "chartData")?.data?.labels || [];
  const matches = await Promise.all(series.map(async (item) => {
    const values = Array.isArray(item.dataset?.data) ? item.dataset.data : [];
    const dataForAnomalies = { series: {} };

    values.forEach((value, index) => {
      if (!isNumericAlertValue(value) || labels[index] === undefined) return;
      const formattedLabel = moment(labels[index], dateFormat).format("YYYY-MM-DD");
      dataForAnomalies.series[formattedLabel] = Number(value);
    });

    if (Object.keys(dataForAnomalies.series).length <= 9) return [];

    const anomalyOpt = {
      url: "https://trends-api.depomo.com/anomalies",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
      },
      form: dataForAnomalies,
      json: true,
    };

    try {
      const anomalies = await request(anomalyOpt);
      return (anomalies?.anomalies || []).map((anomaly) => {
        return makeAlertItem(item, anomaly, "anomaly");
      });
    } catch (error) {
      return [];
    }
  }));

  return matches.flat();
}

function getThresholdText(alert) {
  const { value, lower, upper } = alert.rules;
  if (alert.type === "milestone") {
    return `You reached your milestone of ${value}!`;
  }
  if (alert.type === "threshold_above") {
    return `Chartbrew found some values above your threshold of ${value}.`;
  }
  if (alert.type === "threshold_below") {
    return `Chartbrew found some values below your threshold of ${value}.`;
  }
  if (alert.type === "threshold_between") {
    return `Chartbrew found some values between your thresholds of ${lower} and ${upper}.`;
  }
  if (alert.type === "threshold_outside") {
    return `Chartbrew found some values outside your thresholds of ${lower} and ${upper}.`;
  }
  if (alert.type === "anomaly") {
    return "Chartbrew detected unusual behavior in one or more series.";
  }
  return "Chartbrew found values that match your alert.";
}

async function processAlert(chart, alert, matches) {
  const alertsFound = removePreviouslyTriggeredItems(chart, alert, matches);
  if (alertsFound.length === 0) return false;

  const dashboardUrl = `${settings.client}/dashboard/${chart.project_id}`;
  const thresholdText = getThresholdText(alert);
  const chartController = new ChartController();

  let snapshotUrl = null;
  try {
    snapshotUrl = await chartController.takeSnapshot(chart.id);
    snapshotUrl = `${fullApiUrl}/${snapshotUrl}`;
  } catch (error) {
    console.log("Could not take snapshot", error); // oxlint-disable-line no-console
  }

  const notifications = [];
  if (alert.mediums?.email?.enabled) {
    notifications.push(mail.sendChartAlert({
      chartName: chart.name,
      recipients: alert.recipients,
      thresholdText,
      alerts: alertsFound,
      dashboardUrl,
      snapshotUrl,
    }));
  }

  try {
    if (alert.AlertIntegrations?.length > 0) {
      const integrations = await Promise.all(alert.AlertIntegrations
        .filter((integration) => integration.enabled)
        .map((integration) => {
          return db.Integration.findByPk(integration.integration_id);
        }));

      integrations.filter(Boolean).forEach((integration) => {
        if (integration.type === "webhook") {
          notifications.push(webhookAlerts.send({
            integration,
            chart,
            alertsFound,
            alert,
            snapshotUrl,
          }));
        }
      });
    }
  } catch (error) {
    console.log("Could not process integration alerts", error); // oxlint-disable-line no-console
  }

  const notificationResults = await Promise.allSettled(notifications);
  notificationResults.forEach((result) => {
    if (result.status === "rejected") {
      console.log("Could not send chart alert", result.reason); // oxlint-disable-line no-console
    }
  });

  if (alert.oneTime || alert.type === "milestone") {
    await db.Alert.update({ active: false }, { where: { id: alert.id } });
  }

  return db.AlertEvent.create({
    alert_id: alert.id,
    trigger: alertsFound,
  });
}

async function checkChartForAlerts(chart) {
  if (chart.type === "table") return null;

  const dbAlerts = await db.Alert.findAll({
    where: {
      chart_id: chart.id,
      active: true,
    },
    include: [{
      model: db.AlertEvent,
      as: "events",
    }, {
      model: db.AlertIntegration,
    }],
    order: [[{ model: db.AlertEvent, as: "events" }, "createdAt", "DESC"]]
  });

  if (dbAlerts.length === 0) return null;

  const alerts = dbAlerts.filter((alert) => {
    if (alert.events.length === 0) return true;
    const timeout = add(new Date(alert.events[0].createdAt), { seconds: alert.timeout });
    return isPast(timeout);
  });
  const chartDatasetConfigs = chart.ChartDatasetConfigs || [];
  const checks = [];

  chartDatasetConfigs.forEach((cdc, index) => {
    const datasetAlerts = alerts.filter((alert) => alert.cdc_id === cdc.id);
    if (datasetAlerts.length === 0) return;

    const series = getAlertSeries(chart, cdc.id, index);
    datasetAlerts.forEach((alert) => {
      checks.push((async () => {
        const matches = alert.type === "anomaly"
          ? await findAnomalyMatches(chart, series)
          : findThresholdMatches(chart, alert, series);
        if (matches.length > 0) await processAlert(chart, alert, matches);
      })());
    });
  });

  await Promise.all(checks);
  return null;
}

module.exports = {
  checkChartForAlerts,
};
