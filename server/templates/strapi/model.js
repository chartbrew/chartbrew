const request = require("request-promise");
const moment = require("moment");

const builder = require("./builder");

const template = (templateData, dashboardOrder = 0) => {
  const {
    strapiToken, apiEndpoint, collection, strapiHost, createdField, updatedField,
  } = templateData || {};

  let formattedCreatedAt = createdField;
  let formattedUpdatedAt = updatedField;
  if (collection !== "users") {
    formattedCreatedAt = `attributes.${createdField}`;
    formattedUpdatedAt = `attributes.${updatedField}`;
  }

  return {
    "Connections": [
      {
        "host": `${strapiHost}/${apiEndpoint}`,
        "dbName": null,
        "port": null,
        "username": null,
        "password": null,
        "options": [],
        "connectionString": "null",
        "authentication": {
          "type": "bearer_token",
          "token": strapiToken,
        },
        "firebaseServiceAccount": null,
        "name": "Strapi API",
        "type": "api",
        "active": true,
        "srv": false
      }
    ],
    "Charts": [
      {
        "name": `Total ${collection}`,
        "type": "line",
        "subType": "AddTimeseries",
        "public": false,
        "shareable": false,
        "chartSize": 1,
        "dashboardOrder": dashboardOrder + 1,
        "displayLegend": false,
        "pointRadius": null,
        "startDate": null,
        "endDate": null,
        "includeZeros": true,
        "currentEndDate": false,
        "timeInterval": "month",
        "autoUpdate": 21600,
        "draft": false,
        "mode": "kpi",
        "maxValue": null,
        "minValue": null,
        "disabledExport": null,
        "onReport": false,
        "xLabelTicks": "default",
        "stacked": false,
        "showGrowth": true,
        "Datasets": [
          {
            "fillColor": "rgba(0,0,0,0)",
            "patterns": [],
            "conditions": null,
            "fieldsSchema": {},
            "excludedFields": null,
            "groups": null,
            "query": null,
            "xAxis": `root[].${formattedCreatedAt}`,
            "xAxisOperation": null,
            "yAxis": "root[].id",
            "yAxisOperation": "count",
            "dateField": `root[].${formattedCreatedAt}`,
            "datasetColor": "#50E3C2",
            "fill": false,
            "multiFill": false,
            "dateFormat": null,
            "legend": collection,
            "pointRadius": null,
            "formula": null,
            "groupBy": null,
            "sort": null,
            "DataRequest": {
              "headers": {},
              "body": "null",
              "conditions": null,
              "configuration": null,
              "method": "GET",
              "route": collection,
              "useGlobalHeaders": true,
              "query": null,
              "pagination": true,
              "items": "items",
              "itemsLimit": 10000,
              "offset": "pagination[page]",
              "paginationField": null,
              "template": "pages"
            },
          }
        ],
        "tid": 1
      },
      {
        "name": `${collection} in the last 30 days`,
        "type": "bar",
        "subType": "lcTimeseries",
        "public": false,
        "shareable": false,
        "chartSize": 3,
        "dashboardOrder": dashboardOrder + 2,
        "displayLegend": false,
        "pointRadius": null,
        "startDate": moment().subtract(1, "months").startOf("day"),
        "endDate": moment().endOf("day"),
        "includeZeros": true,
        "currentEndDate": true,
        "timeInterval": "day",
        "autoUpdate": 21600,
        "draft": false,
        "mode": "kpichart",
        "maxValue": null,
        "minValue": null,
        "disabledExport": null,
        "onReport": false,
        "xLabelTicks": "default",
        "stacked": false,
        "showGrowth": true,
        "Datasets": [
          {
            "fillColor": "rgba(80, 227, 194, 0.47)",
            "patterns": [],
            "conditions": null,
            "fieldsSchema": {},
            "excludedFields": null,
            "groups": null,
            "query": null,
            "xAxis": `root[].${formattedCreatedAt}`,
            "xAxisOperation": null,
            "yAxis": "root[].id",
            "yAxisOperation": "count",
            "dateField": `root[].${formattedCreatedAt}`,
            "datasetColor": "#50E3C2",
            "fill": false,
            "multiFill": false,
            "dateFormat": null,
            "legend": `${collection}`,
            "pointRadius": null,
            "formula": null,
            "groupBy": null,
            "sort": null,
            "DataRequest": {
              "headers": {},
              "body": "null",
              "conditions": null,
              "configuration": null,
              "method": "GET",
              "route": `${collection}?filters[${createdField}][$gt]=${moment().subtract(32, "days").startOf("day").toISOString()}`,
              "useGlobalHeaders": true,
              "query": null,
              "pagination": true,
              "items": "items",
              "itemsLimit": 0,
              "offset": "pagination.page",
              "paginationField": null,
              "template": "pages"
            },
          }
        ],
        "tid": 2
      },
      {
        "name": `${collection} in the last year`,
        "type": "bar",
        "subType": "lcTimeseries",
        "public": false,
        "shareable": false,
        "chartSize": 2,
        "dashboardOrder": dashboardOrder + 3,
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
        "maxValue": null,
        "minValue": null,
        "disabledExport": null,
        "onReport": false,
        "xLabelTicks": "default",
        "stacked": false,
        "showGrowth": true,
        "Datasets": [
          {
            "fillColor": "rgba(80, 227, 194, 0.47)",
            "patterns": [],
            "conditions": null,
            "fieldsSchema": {},
            "excludedFields": null,
            "groups": null,
            "query": null,
            "xAxis": `root[].${formattedCreatedAt}`,
            "xAxisOperation": null,
            "yAxis": "root[].id",
            "yAxisOperation": "count",
            "dateField": `root[].${formattedCreatedAt}`,
            "datasetColor": "#50E3C2",
            "fill": false,
            "multiFill": false,
            "dateFormat": null,
            "legend": collection,
            "pointRadius": null,
            "formula": null,
            "groupBy": null,
            "sort": null,
            "DataRequest": {
              "headers": {},
              "body": "null",
              "conditions": null,
              "configuration": null,
              "method": "GET",
              "route": `${collection}?filters[${createdField}][$gt]=${moment().subtract(367, "days").startOf("day").toISOString()}`,
              "useGlobalHeaders": true,
              "query": null,
              "pagination": true,
              "items": "items",
              "itemsLimit": 0,
              "offset": "pagination[page]",
              "paginationField": null,
              "template": "pages"
            },
          }
        ],
        "tid": 3
      },
      {
        "name": "Updates in the last 30 days",
        "type": "line",
        "subType": "lcTimeseries",
        "public": false,
        "shareable": false,
        "chartSize": 2,
        "dashboardOrder": dashboardOrder + 4,
        "displayLegend": false,
        "pointRadius": null,
        "startDate": moment().subtract(1, "months").startOf("day"),
        "endDate": moment().endOf("day"),
        "includeZeros": true,
        "currentEndDate": true,
        "timeInterval": "day",
        "autoUpdate": 21600,
        "draft": false,
        "mode": "kpichart",
        "maxValue": null,
        "minValue": null,
        "disabledExport": null,
        "onReport": false,
        "xLabelTicks": "default",
        "stacked": false,
        "showGrowth": true,
        "Datasets": [
          {
            "fillColor": "rgba(0,0,0,0)",
            "patterns": [],
            "conditions": null,
            "fieldsSchema": {},
            "excludedFields": null,
            "groups": null,
            "query": null,
            "xAxis": `root[].${formattedUpdatedAt}`,
            "xAxisOperation": null,
            "yAxis": "root[].id",
            "yAxisOperation": "count",
            "dateField": "root[].updatedAt",
            "datasetColor": "#FF7F0E",
            "fill": false,
            "multiFill": false,
            "dateFormat": null,
            "legend": collection,
            "pointRadius": null,
            "formula": null,
            "groupBy": null,
            "sort": null,
            "DataRequest": {
              "headers": {},
              "body": "null",
              "conditions": null,
              "configuration": null,
              "method": "GET",
              "route": `${collection}?filters[${updatedField}][$gt]=${moment().subtract(32, "days").startOf("day").toISOString()}`,
              "useGlobalHeaders": true,
              "query": null,
              "pagination": true,
              "items": "items",
              "itemsLimit": 0,
              "offset": "pagination[page]",
              "paginationField": null,
              "template": "pages"
            },
          }
        ],
        "tid": 4
      }
    ],
  };
};

module.exports.template = template;

module.exports.build = async (projectId, templateData, dashboardOrder) => {
  const {
    strapiToken, apiEndpoint, collection, strapiHost, connection_id, charts,
  } = templateData;

  if ((!strapiToken || !apiEndpoint || !strapiHost || !collection) && !connection_id) {
    return Promise.reject("Missing required arguments to create the template");
  }

  let checkErrored = false;
  if (!connection_id) {
    const checkOpt = {
      url: `${strapiHost}/${apiEndpoint}/${collection}`,
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${strapiToken}`,
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

  return builder(projectId, templateData, dashboardOrder, template, charts, connection_id)
    .catch((err) => {
      if (err && err.message) {
        return Promise.reject(err.message);
      }
      return Promise.reject(err);
    });
};
