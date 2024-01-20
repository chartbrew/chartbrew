const request = require("request-promise");
const moment = require("moment");

const builder = require("./builder");

const template = (templateData) => {
  const {
    strapiToken, apiEndpoint, collection, strapiHost, createdField, updatedField,
  } = templateData || {};

  let formattedCreatedAt = createdField;
  let formattedUpdatedAt = updatedField;
  if (collection !== "users") {
    formattedCreatedAt = `attributes.${createdField}`;
    formattedUpdatedAt = `attributes.${updatedField}`;
  }

  // remove the trailing slash from the strapiHost if present
  let formattedStrapiHost = strapiHost;
  if (strapiHost && strapiHost.endsWith("/")) {
    formattedStrapiHost = strapiHost.slice(0, -1);
  }

  return {
    "Connections": [
      {
        "host": `${formattedStrapiHost}/${apiEndpoint}`,
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
        "subType": "strapi",
        "active": true,
        "srv": false
      }
    ],
    "Datasets": [{
      "td_id": 1,
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
      "DataRequests": [{
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
      }],
    }, {
      "td_id": 2,
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
      "DataRequests": [{
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
      }],
    }, {
      "td_id": 3,
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
      "DataRequests": [{
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
      }],
    }, {
      "td_id": 4,
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
      "DataRequests": [{
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
      }],
    }],
    "Charts": [
      {
        "name": `Total ${collection}`,
        "type": "kpi",
        "subType": "AddTimeseries",
        "public": false,
        "shareable": false,
        "chartSize": 1,
        "displayLegend": false,
        "pointRadius": null,
        "startDate": null,
        "endDate": null,
        "includeZeros": true,
        "currentEndDate": false,
        "timeInterval": "month",
        "autoUpdate": 21600,
        "draft": false,
        "maxValue": null,
        "minValue": null,
        "disabledExport": null,
        "onReport": false,
        "xLabelTicks": "default",
        "stacked": false,
        "showGrowth": true,
        "layout": {
          "xs": [0, 0, 6, 1], "sm": [6, 0, 2, 2], "md": [7, 0, 3, 2], "lg": [8, 0, 4, 2]
        },
        "ChartDatasetConfigs": [
          {
            "td_id": 1,
            "fillColor": "rgba(0,0,0,0)",
            "patterns": [],
            "conditions": null,
            "fieldsSchema": {},
            "excludedFields": null,
            "datasetColor": "#50E3C2",
            "fill": false,
            "multiFill": false,
            "dateFormat": null,
            "legend": collection,
            "pointRadius": null,
            "formula": null,
            "groupBy": null,
            "sort": null,
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
        "layout": {
          "xs": [0, 3, 6, 2], "sm": [0, 2, 8, 2], "md": [0, 2, 10, 2], "lg": [0, 2, 8, 2]
        },
        "ChartDatasetConfigs": [
          {
            "td_id": 2,
            "fillColor": "rgba(80, 227, 194, 0.47)",
            "patterns": [],
            "conditions": null,
            "fieldsSchema": {},
            "excludedFields": null,
            "groups": null,
            "query": null,
            "datasetColor": "#50E3C2",
            "fill": false,
            "multiFill": false,
            "dateFormat": null,
            "legend": `${collection}`,
            "pointRadius": null,
            "formula": null,
            "groupBy": null,
            "sort": null,
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
        "layout": {
          "xs": [0, 1, 6, 2], "sm": [0, 0, 6, 2], "md": [0, 0, 7, 2], "lg": [0, 0, 8, 2]
        },
        "ChartDatasetConfigs": [
          {
            "td_id": 3,
            "fillColor": "rgba(80, 227, 194, 0.47)",
            "patterns": [],
            "conditions": null,
            "fieldsSchema": {},
            "excludedFields": null,
            "groups": null,
            "datasetColor": "#50E3C2",
            "fill": false,
            "multiFill": false,
            "dateFormat": null,
            "legend": collection,
            "pointRadius": null,
            "formula": null,
            "groupBy": null,
            "sort": null,
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
        "layout": {
          "xs": [0, 5, 6, 3], "sm": [0, 4, 8, 3], "md": [0, 4, 10, 3], "lg": [0, 4, 12, 2]
        },
        "ChartDatasetConfigs": [
          {
            "td_id": 4,
            "fillColor": "rgba(0,0,0,0)",
            "patterns": [],
            "conditions": null,
            "fieldsSchema": {},
            "excludedFields": null,
            "groups": null,
            "datasetColor": "#FF7F0E",
            "fill": false,
            "multiFill": false,
            "dateFormat": null,
            "legend": collection,
            "pointRadius": null,
            "formula": null,
            "groupBy": null,
            "sort": null,
          }
        ],
        "tid": 4
      }
    ],
  };
};

module.exports.template = template;

module.exports.build = async (teamId, projectId, templateData) => {
  const {
    strapiToken, apiEndpoint, collection, strapiHost, connection_id, charts,
  } = templateData;

  if ((!strapiToken || !apiEndpoint || !strapiHost || !collection) && !connection_id) {
    return Promise.reject("Missing required arguments to create the template");
  }

  // remove the trailing slash from the strapiHost if present
  let formattedStrapiHost = strapiHost;
  if (strapiHost && strapiHost.endsWith("/")) {
    formattedStrapiHost = strapiHost.slice(0, -1);
  }

  let checkErrored = false;
  if (!connection_id) {
    const checkOpt = {
      url: `${formattedStrapiHost}/${apiEndpoint}/${collection}`,
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

  return builder(teamId, projectId, templateData, template, charts, connection_id)
    .catch((err) => {
      if (err && err.message) {
        return Promise.reject(err.message);
      }
      return Promise.reject(err);
    });
};
