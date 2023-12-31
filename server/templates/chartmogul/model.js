const request = require("request-promise");
const moment = require("moment");

const { chartColors } = require("../../charts/colors");
const builder = require("./builder");

const template = (token, key) => ({
  "Connections": [{
    "host": "https://api.chartmogul.com/v1",
    "dbName": null,
    "port": null,
    "username": null,
    "password": null,
    "options": [],
    "connectionString": "null",
    "authentication": {
      "type": "basic_auth",
      "user": token,
      "pass": key,
    },
    "firebaseServiceAccount": null,
    "name": "ChartMogul",
    "type": "api",
    "subType": "chartmogul",
    "active": true,
    "srv": false
  }],
  "Datasets": [{
    "td_id": 1,
    "fillColor": "rgba(0,0,0,0)",
    "patterns": [],
    "conditions": null,
    "fieldsSchema": {
      "root.entries[].date": "date",
      "root.entries[].mrr": "number",
      "root.entries[].mrr-new-business": "number",
      "root.entries[].mrr-expansion": "number",
      "root.entries[].mrr-contraction": "number",
      "root.entries[].mrr-churn": "number",
      "root.entries[].mrr-reactivation": "number"
    },
    "excludedFields": null,
    "query": null,
    "xAxis": "root.entries[].date",
    "xAxisOperation": null,
    "yAxis": "root.entries[].mrr",
    "yAxisOperation": "none",
    "dateField": "root.entries[].date",
    "datasetColor": chartColors.blue.rgb,
    "fill": false,
    "multiFill": false,
    "dateFormat": null,
    "legend": "MRR",
    "pointRadius": null,
    "formula": "${val / 100}",
    "DataRequests": [{
      "headers": {},
      "body": "null",
      "conditions": null,
      "method": "GET",
      "route": "/metrics/mrr?interval=day&start-date={{start_date}}&end-date={{end_date}}",
      "useGlobalHeaders": true,
      "query": null,
      "pagination": false,
      "items": "items",
      "itemsLimit": 100,
      "offset": "offset",
      "template": null
    }],
  }, {
    "td_id": 2,
    "fillColor": "rgba(0,0,0,0)",
    "patterns": [],
    "conditions": null,
    "fieldsSchema": {
      "root.entries[].date": "date",
      "root.entries[].arr": "number"
    },
    "excludedFields": null,
    "query": null,
    "xAxis": "root.entries[].date",
    "xAxisOperation": null,
    "yAxis": "root.entries[].arr",
    "yAxisOperation": "none",
    "dateField": "root.entries[].date",
    "datasetColor": chartColors.blue.rgb,
    "fill": false,
    "multiFill": false,
    "dateFormat": null,
    "legend": "ARR",
    "pointRadius": null,
    "formula": "${val / 100}",
    "DataRequests": [{
      "headers": {},
      "body": "null",
      "conditions": null,
      "method": "GET",
      "route": "/metrics/arr?interval=day&start-date={{start_date}}&end-date={{end_date}}",
      "useGlobalHeaders": true,
      "query": null,
      "pagination": false,
      "items": "items",
      "itemsLimit": 100,
      "offset": "offset",
      "template": null
    }],
  }, {
    "td_id": 3,
    "fillColor": "rgba(0,0,0,0)",
    "patterns": [],
    "conditions": null,
    "fieldsSchema": {
      "root.entries[].date": "date",
      "root.entries[].customer-churn-rate": "number"
    },
    "excludedFields": null,
    "query": null,
    "xAxis": "root.entries[].date",
    "xAxisOperation": null,
    "yAxis": "root.entries[].customer-churn-rate",
    "yAxisOperation": "none",
    "dateField": "root.entries[].date",
    "datasetColor": chartColors.blue.rgb,
    "fill": false,
    "multiFill": false,
    "dateFormat": null,
    "legend": "Customer Churn",
    "pointRadius": null,
    "formula": "{val}%",
    "DataRequests": [{
      "headers": {},
      "body": "null",
      "conditions": null,
      "method": "GET",
      "route": "/metrics/customer-churn-rate?start-date={{start_date}}&end-date={{end_date}}",
      "useGlobalHeaders": true,
      "query": null,
      "pagination": false,
      "items": "items",
      "itemsLimit": 100,
      "offset": "offset",
      "template": null
    }],
  }, {
    "td_id": 4,
    "fillColor": "rgba(0,0,0,0)",
    "patterns": [],
    "conditions": null,
    "fieldsSchema": {
      "root.entries[].date": "date",
      "root.entries[].mrr-churn-rate": "number"
    },
    "excludedFields": null,
    "query": null,
    "xAxis": "root.entries[].date",
    "xAxisOperation": null,
    "yAxis": "root.entries[].mrr-churn-rate",
    "yAxisOperation": "none",
    "dateField": "root.entries[].date",
    "datasetColor": chartColors.amber.rgb,
    "fill": false,
    "multiFill": false,
    "dateFormat": null,
    "legend": "NET MRR Churn",
    "pointRadius": null,
    "formula": "{val}%",
    "DataRequests": [{
      "headers": {},
      "body": "null",
      "conditions": null,
      "method": "GET",
      "route": "/metrics/mrr-churn-rate?start-date={{start_date}}&end-date={{end_date}}",
      "useGlobalHeaders": true,
      "query": null,
      "pagination": false,
      "items": "items",
      "itemsLimit": 100,
      "offset": "offset",
      "template": null
    }],
  }, {
    "td_id": 5,
    "fillColor": chartColors.blue.rgba(0.11),
    "patterns": [],
    "conditions": null,
    "fieldsSchema": {
      "root.entries[].date": "date",
      "root.entries[].customers": "number"
    },
    "excludedFields": null,
    "query": null,
    "xAxis": "root.entries[].date",
    "xAxisOperation": null,
    "yAxis": "root.entries[].customers",
    "yAxisOperation": "none",
    "dateField": "root.entries[].date",
    "datasetColor": chartColors.blue.rgb,
    "fill": true,
    "multiFill": false,
    "dateFormat": null,
    "legend": "Subscribers",
    "pointRadius": null,
    "formula": null,
    "DataRequests": [{
      "headers": {},
      "body": "null",
      "conditions": null,
      "method": "GET",
      "route": "/metrics/customer-count?interval=day&start-date={{start_date}}&end-date={{end_date}}",
      "useGlobalHeaders": true,
      "query": null,
      "pagination": false,
      "items": "items",
      "itemsLimit": 100,
      "offset": "offset",
      "template": null
    }],
  }, {
    "td_id": 6,
    "fillColor": "rgba(0,0,0,0)",
    "patterns": [],
    "conditions": [],
    "fieldsSchema": {
      "root.entries[].date": "date",
      "root.entries[].arpa": "number"
    },
    "excludedFields": null,
    "query": null,
    "xAxis": "root.entries[].date",
    "xAxisOperation": null,
    "yAxis": "root.entries[].arpa",
    "yAxisOperation": "none",
    "dateField": "root.entries[].date",
    "datasetColor": chartColors.blue.rgb,
    "fill": false,
    "multiFill": false,
    "dateFormat": null,
    "legend": "ARPA",
    "pointRadius": null,
    "formula": "${val / 100}",
    "DataRequests": [{
      "headers": {},
      "body": "null",
      "conditions": null,
      "method": "GET",
      "route": "/metrics/arpa?interval=day&start-date={{start_date}}&end-date={{end_date}}",
      "useGlobalHeaders": true,
      "query": null,
      "pagination": false,
      "items": "items",
      "itemsLimit": 100,
      "offset": "offset",
      "template": null
    }],
  }, {
    "td_id": 7,
    "fillColor": "rgba(0,0,0,0)",
    "patterns": [],
    "conditions": null,
    "fieldsSchema": {
      "root.entries[].date": "date",
      "root.entries[].mrr": "number",
      "root.entries[].mrr-new-business": "number",
      "root.entries[].mrr-expansion": "number",
      "root.entries[].mrr-contraction": "number",
      "root.entries[].mrr-churn": "number",
      "root.entries[].mrr-reactivation": "number"
    },
    "excludedFields": null,
    "query": null,
    "xAxis": "root.entries[].date",
    "xAxisOperation": null,
    "yAxis": "root.entries[].mrr",
    "yAxisOperation": "count",
    "dateField": "root.entries[].date",
    "datasetColor": chartColors.blue.rgb,
    "fill": false,
    "multiFill": false,
    "dateFormat": null,
    "legend": "MRR in cents",
    "pointRadius": null,
    "formula": null,
    "DataRequests": [{
      "headers": {},
      "body": "null",
      "conditions": null,
      "method": "GET",
      "route": "/metrics/mrr?interval=month&start-date={{start_date}}&end-date={{end_date}}",
      "useGlobalHeaders": true,
      "query": null,
      "pagination": false,
      "items": "items",
      "itemsLimit": 100,
      "offset": "offset",
      "template": null
    }],
  }],
  "Charts": [
    {
      "tid": 1,
      "name": "MRR",
      "type": "kpi",
      "subType": "lcTimeseries",
      "public": false,
      "chartSize": 1,
      "displayLegend": false,
      "pointRadius": null,
      "startDate": moment().subtract(3, "months").startOf("day"),
      "endDate": moment().endOf("day"),
      "includeZeros": true,
      "currentEndDate": true,
      "timeInterval": "month",
      "autoUpdate": 21600,
      "draft": false,
      "showGrowth": true,
      "layout": {
        "xxs": [0, 0, 2, 2], "xs": [0, 0, 6, 2], "sm": [0, 0, 3, 2], "md": [0, 0, 3, 2], "lg": [0, 0, 3, 2]
      },
      "ChartDatasetConfigs": [
        {
          "td_id": 1,
          "fillColor": "rgba(0,0,0,0)",
          "patterns": [],
          "conditions": null,
          "fieldsSchema": {
            "root.entries[].date": "date",
            "root.entries[].mrr": "number",
            "root.entries[].mrr-new-business": "number",
            "root.entries[].mrr-expansion": "number",
            "root.entries[].mrr-contraction": "number",
            "root.entries[].mrr-churn": "number",
            "root.entries[].mrr-reactivation": "number"
          },
          "excludedFields": null,
          "datasetColor": chartColors.blue.rgb,
          "fill": false,
          "multiFill": false,
          "dateFormat": null,
          "legend": "MRR",
          "pointRadius": null,
          "formula": "${val / 100}",
        }
      ]
    },
    {
      "tid": 2,
      "name": "MRR Evolution",
      "type": "line",
      "subType": "lcTimeseries",
      "public": false,
      "chartSize": 2,
      "displayLegend": false,
      "pointRadius": null,
      "startDate": moment().subtract(1, "year").startOf("day"),
      "endDate": moment().endOf("day"),
      "includeZeros": false,
      "currentEndDate": true,
      "timeInterval": "month",
      "autoUpdate": 21600,
      "draft": false,
      "mode": "kpichart",
      "showGrowth": true,
      "layout": {
        "xxs": [0, 4, 2, 2], "xs": [0, 4, 6, 2], "sm": [3, 0, 5, 2], "md": [3, 0, 4, 2], "lg": [3, 0, 5, 2]
      },
      "ChartDatasetConfigs": [
        {
          "td_id": 1,
          "fillColor": chartColors.blue.rgba(0.11),
          "patterns": [],
          "conditions": null,
          "fieldsSchema": {
            "root.entries[].date": "date",
            "root.entries[].mrr": "number",
            "root.entries[].mrr-new-business": "number",
            "root.entries[].mrr-expansion": "number",
            "root.entries[].mrr-contraction": "number",
            "root.entries[].mrr-churn": "number",
            "root.entries[].mrr-reactivation": "number"
          },
          "excludedFields": null,
          "datasetColor": chartColors.blue.rgb,
          "fill": false,
          "multiFill": false,
          "dateFormat": null,
          "legend": "MRR",
          "pointRadius": null,
          "formula": "{val / 100}",
        }
      ]
    },
    {
      "tid": 3,
      "name": "Anual Recurring Revenue",
      "type": "kpi",
      "subType": "lcTimeseries",
      "public": false,
      "chartSize": 1,
      "displayLegend": false,
      "pointRadius": null,
      "startDate": moment().subtract(1, "year").startOf("day"),
      "endDate": moment().endOf("day"),
      "includeZeros": true,
      "currentEndDate": true,
      "timeInterval": "month",
      "autoUpdate": 21600,
      "draft": false,
      "showGrowth": true,
      "layout": {
        "xxs": [0, 2, 2, 2], "xs": [0, 2, 6, 2], "sm": [0, 2, 3, 2], "md": [0, 2, 3, 2], "lg": [0, 2, 3, 2]
      },
      "ChartDatasetConfigs": [
        {
          "td_id": 2,
          "fillColor": "rgba(0,0,0,0)",
          "patterns": [],
          "conditions": null,
          "fieldsSchema": {
            "root.entries[].date": "date",
            "root.entries[].arr": "number"
          },
          "excludedFields": null,
          "datasetColor": chartColors.blue.rgb,
          "fill": false,
          "multiFill": false,
          "dateFormat": null,
          "legend": "ARR",
          "pointRadius": null,
          "formula": "${val / 100}",
        }
      ]
    },
    {
      "tid": 4,
      "name": "Churn Rate",
      "type": "kpi",
      "subType": "lcTimeseries",
      "public": false,
      "chartSize": 1,
      "displayLegend": false,
      "pointRadius": null,
      "startDate": moment().subtract(1, "year").startOf("day"),
      "endDate": moment().endOf("day"),
      "includeZeros": true,
      "currentEndDate": true,
      "timeInterval": "month",
      "autoUpdate": 21600,
      "draft": false,
      "layout": {
        "xxs": [0, 6, 2, 2], "xs": [0, 8, 6, 2], "sm": [0, 4, 3, 2], "md": [7, 0, 3, 2], "lg": [8, 0, 4, 2]
      },
      "ChartDatasetConfigs": [
        {
          "td_id": 3,
          "fillColor": "rgba(0,0,0,0)",
          "patterns": [],
          "conditions": null,
          "fieldsSchema": {
            "root.entries[].date": "date",
            "root.entries[].customer-churn-rate": "number"
          },
          "excludedFields": null,
          "datasetColor": chartColors.blue.rgb,
          "fill": false,
          "multiFill": false,
          "dateFormat": null,
          "legend": "Customer Churn",
          "pointRadius": null,
          "formula": "{val}%",
        },
        {
          "td_id": 4,
          "fillColor": "rgba(0,0,0,0)",
          "patterns": [],
          "conditions": null,
          "fieldsSchema": {
            "root.entries[].date": "date",
            "root.entries[].mrr-churn-rate": "number"
          },
          "excludedFields": null,
          "dateField": "root.entries[].date",
          "datasetColor": chartColors.amber.rgb,
          "fill": false,
          "multiFill": false,
          "dateFormat": null,
          "legend": "NET MRR Churn",
          "pointRadius": null,
          "formula": "{val}%",
        }
      ]
    },
    {
      "tid": 5,
      "name": "Subscribers",
      "type": "line",
      "subType": "lcTimeseries",
      "public": false,
      "chartSize": 2,
      "displayLegend": false,
      "pointRadius": null,
      "startDate": moment().subtract(1, "year").startOf("day"),
      "endDate": moment().endOf("day"),
      "includeZeros": true,
      "currentEndDate": true,
      "timeInterval": "month",
      "autoUpdate": 21600,
      "draft": false,
      "mode": "kpichart",
      "showGrowth": true,
      "layout": {
        "xxs": [0, 12, 2, 2], "xs": [0, 6, 6, 2], "sm": [3, 2, 5, 2], "md": [3, 2, 4, 2], "lg": [3, 2, 5, 2]
      },
      "ChartDatasetConfigs": [
        {
          "td_id": 5,
          "fillColor": chartColors.blue.rgba(0.11),
          "patterns": [],
          "conditions": null,
          "fieldsSchema": {
            "root.entries[].date": "date",
            "root.entries[].customers": "number"
          },
          "excludedFields": null,
          "datasetColor": chartColors.blue.rgb,
          "fill": true,
          "multiFill": false,
          "dateFormat": null,
          "legend": "Subscribers",
          "pointRadius": null,
          "formula": null,
        }
      ]
    },
    {
      "tid": 6,
      "name": "Avg Revenue Per Account",
      "type": "kpi",
      "subType": "lcTimeseries",
      "public": false,
      "chartSize": 1,
      "displayLegend": false,
      "pointRadius": null,
      "startDate": moment().subtract(1, "year").startOf("day"),
      "endDate": moment().endOf("day"),
      "includeZeros": true,
      "currentEndDate": true,
      "timeInterval": "month",
      "autoUpdate": 21600,
      "draft": false,
      "showGrowth": true,
      "layout": {
        "xxs": [0, 8, 2, 2], "xs": [0, 10, 6, 2], "sm": [3, 4, 3, 2], "md": [7, 2, 3, 2], "lg": [8, 2, 3, 2]
      },
      "ChartDatasetConfigs": [
        {
          "td_id": 6,
          "fillColor": "rgba(0,0,0,0)",
          "patterns": [],
          "conditions": [],
          "fieldsSchema": {
            "root.entries[].date": "date",
            "root.entries[].arpa": "number"
          },
          "excludedFields": null,
          "datasetColor": chartColors.blue.rgb,
          "fill": false,
          "multiFill": false,
          "dateFormat": null,
          "legend": "ARPA",
          "pointRadius": null,
          "formula": "${val / 100}",
        }
      ]
    },
    {
      "tid": 7,
      "name": "MRR Breakdown in last 6 months",
      "type": "table",
      "subType": "timeseries",
      "public": false,
      "chartSize": 3,
      "displayLegend": false,
      "pointRadius": null,
      "startDate": moment().subtract(6, "months").startOf(),
      "endDate": moment().endOf("day"),
      "includeZeros": true,
      "currentEndDate": true,
      "timeInterval": "day",
      "autoUpdate": 21600,
      "draft": false,
      "mode": "chart",
      "layout": {
        "xxs": [0, 10, 2, 2], "xs": [0, 12, 6, 2], "sm": [0, 6, 8, 3], "md": [0, 4, 7, 3], "lg": [0, 4, 7, 3]
      },
      "ChartDatasetConfigs": [
        {
          "td_id": 7,
          "fillColor": "rgba(0,0,0,0)",
          "patterns": [],
          "conditions": null,
          "fieldsSchema": {
            "root.entries[].date": "date",
            "root.entries[].mrr": "number",
            "root.entries[].mrr-new-business": "number",
            "root.entries[].mrr-expansion": "number",
            "root.entries[].mrr-contraction": "number",
            "root.entries[].mrr-churn": "number",
            "root.entries[].mrr-reactivation": "number"
          },
          "excludedFields": null,
          "datasetColor": chartColors.blue.rgb,
          "fill": false,
          "multiFill": false,
          "dateFormat": null,
          "legend": "MRR in cents",
          "pointRadius": null,
          "formula": null,
        }
      ]
    },
  ],
});

module.exports.template = template;

module.exports.build = async (teamId, projectId, {
  token, key, charts, connection_id,
}, dashboardOrder) => {
  if ((!token || !key) && !connection_id) return Promise.reject("Missing required authentication arguments");

  let checkErrored = false;
  if (!connection_id) {
    const checkOpt = {
      url: `https://api.chartmogul.com/v1/metrics/all?interval=month&start-date=${moment().subtract(6, "month").startOf("month").format("YYYY-MM-DD")}&end-date=${moment().endOf("month").format("YYYY-MM-DD")}`,
      method: "GET",
      auth: {
        user: token,
        pass: key,
      },
      headers: {
        accept: "application/json",
      },
      json: true,
    };

    try {
      const checkAuth = await request(checkOpt); // eslint-disable-line
    } catch (e) {
      checkErrored = true;
    }
  }

  if (!connection_id && checkErrored) {
    return Promise.reject(new Error("Request cannot be authenticated"));
  }

  return builder(teamId, projectId, token, key, dashboardOrder, template, charts, connection_id)
    .catch((err) => {
      if (err && err.message) {
        return Promise.reject(err.message);
      }
      return Promise.reject(err);
    });
};
