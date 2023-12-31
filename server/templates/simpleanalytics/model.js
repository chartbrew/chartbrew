const request = require("request-promise");

const { chartColors } = require("../../charts/colors");
const builder = require("./builder");

const template = (website, apiKey) => ({
  Connections: [{
    name: "SimpleAnalyticsAPI",
    type: "api",
    subType: "simpleanalytics",
    host: "https://simpleanalytics.com",
    options: [{
      "Api-Key": apiKey || "none",
    }]
  }],
  Datasets: [{
    td_id: 1,
    legend: "Pageviews",
    datasetColor: chartColors.blue.rgb,
    fill: false,
    fillColor: "rgba(0,0,0,0)",
    dateField: "root.histogram[].date",
    xAxis: "root.histogram[].date",
    yAxis: "root.histogram[].pageviews",
    yAxisOperation: "none",
    DataRequests: [{
      route: `/${website}.json?version=5&fields=histogram`,
    }]
  }, {
    td_id: 2,
    legend: "Visitors",
    datasetColor: chartColors.amber.rgb,
    fill: false,
    fillColor: "rgba(0,0,0,0)",
    dateField: "root.histogram[].date",
    xAxis: "root.histogram[].date",
    yAxis: "root.histogram[].visitors",
    yAxisOperation: "none",
    DataRequests: [{
      route: `/${website}.json?version=5&fields=histogram`,
    }]
  }, {
    td_id: 3,
    legend: "Devices",
    datasetColor: "rgba(255, 255, 255, 1)",
    fillColor: [chartColors.blue, chartColors.amber, chartColors.teal],
    multiFill: true,
    xAxis: "root.device_types[].value",
    yAxis: "root.device_types[].visitors",
    yAxisOperation: "none",
    DataRequests: [{
      route: `/${website}.json?version=5&fields=device_types`,
    }],
  }, {
    td_id: 4,
    legend: "Referrers",
    datasetColor: chartColors.blue.rgb,
    fill: false,
    fillColor: "rgba(0,0,0,0)",
    xAxis: "root.referrers[].value",
    yAxis: "root.referrers[].pageviews",
    yAxisOperation: "none",
    DataRequests: [{
      route: `/${website}.json?version=5&fields=referrers`,
    }],
  }, {
    td_id: 5,
    legend: "UTM Sources",
    datasetColor: chartColors.amber.rgb,
    fill: false,
    fillColor: "rgba(0,0,0,0)",
    xAxis: "root.utm_sources[].value",
    yAxis: "root.utm_sources[].pageviews",
    yAxisOperation: "none",
    DataRequests: [{
      route: `/${website}.json?version=5&fields=utm_sources`,
    }],
  }, {
    td_id: 6,
    legend: "Browsers",
    datasetColor: chartColors.blue.rgb,
    fill: false,
    fillColor: "rgba(0,0,0,0)",
    xAxis: "root.browser_names[].value",
    yAxis: "root.browser_names[].pageviews",
    yAxisOperation: "none",
    DataRequests: [{
      route: `/${website}.json?version=5&fields=browser_names`,
    }],
  }, {
    td_id: 7,
    legend: "Countries",
    datasetColor: chartColors.amber.rgb,
    fill: false,
    fillColor: "rgba(0,0,0,0)",
    xAxis: "root.countries[].value",
    yAxis: "root.countries[].pageviews",
    yAxisOperation: "none",
    DataRequests: [{
      route: `/${website}.json?version=5&fields=countries`,
    }],
  }],
  Charts: [{
    tid: 1,
    name: "30-day Stats",
    chartSize: 1,
    currentEndDate: false,
    displayLegend: false,
    draft: false,
    includeZeros: true,
    public: false,
    subType: "AddTimeseries",
    timeInterval: "day",
    type: "kpi",
    layout: {
      "xxs": [0, 0, 2, 2], "xs": [0, 0, 6, 2], "sm": [0, 0, 3, 2], "md": [0, 0, 4, 2], "lg": [0, 0, 3, 2]
    },
    ChartDatasetConfigs: [{
      td_id: 1,
      legend: "Pageviews",
      datasetColor: chartColors.blue.rgb,
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      dateField: "root.histogram[].date",
      xAxis: "root.histogram[].date",
      yAxis: "root.histogram[].pageviews",
      yAxisOperation: "none",
      DataRequests: [{
        route: `/${website}.json?version=5&fields=histogram`,
      }],
    }, {
      td_id: 2,
      legend: "Visitors",
      datasetColor: chartColors.amber.rgb,
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      dateField: "root.histogram[].date",
      xAxis: "root.histogram[].date",
      yAxis: "root.histogram[].visitors",
      yAxisOperation: "none",
    }]
  }, {
    tid: 2,
    name: "Site Stats",
    chartSize: 2,
    currentEndDate: false,
    displayLegend: false,
    draft: false,
    includeZeros: true,
    mode: "kpichart",
    public: false,
    subType: "lcTimeseries",
    timeInterval: "day",
    type: "line",
    showGrowth: true,
    layout: {
      "xxs": [0, 2, 2, 2], "xs": [0, 2, 6, 2], "sm": [3, 0, 5, 2], "md": [4, 0, 6, 2], "lg": [3, 0, 6, 2]
    },
    ChartDatasetConfigs: [{
      td_id: 1,
      legend: "Pageviews",
      datasetColor: chartColors.blue.rgb,
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      dateField: "root.histogram[].date",
      xAxis: "root.histogram[].date",
      yAxis: "root.histogram[].pageviews",
      yAxisOperation: "none",
    }, {
      td_id: 2,
      legend: "Visitors",
      datasetColor: chartColors.amber.rgb,
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      dateField: "root.histogram[].date",
      xAxis: "root.histogram[].date",
      yAxis: "root.histogram[].visitors",
      yAxisOperation: "none",
    }]
  }, {
    tid: 3,
    name: "Devices",
    chartSize: 1,
    draft: false,
    includeZeros: true,
    mode: "chart",
    public: false,
    subType: "timeseries",
    timeInterval: "day",
    type: "doughnut",
    displayLegend: true,
    layout: {
      "xxs": [0, 4, 2, 2], "xs": [0, 4, 6, 2], "sm": [0, 2, 2, 2], "md": [0, 2, 4, 2], "lg": [9, 0, 3, 2]
    },
    ChartDatasetConfigs: [{
      td_id: 3,
      legend: "Devices",
      datasetColor: "rgba(255, 255, 255, 1)",
      fillColor: [chartColors.blue.rgb, chartColors.amber.rgb, chartColors.teal.rgb],
      multiFill: true,
      xAxis: "root.device_types[].value",
      yAxis: "root.device_types[].visitors",
      yAxisOperation: "none",
    }]
  }, {
    tid: 5,
    name: "Referrers Data",
    chartSize: 2,
    draft: false,
    includeZeros: true,
    mode: "chart",
    public: false,
    subType: "timeseries",
    type: "table",
    timeInterval: "day",
    layout: {
      "xxs": [0, 6, 2, 3], "xs": [0, 6, 6, 3], "sm": [2, 2, 6, 2], "md": [4, 2, 6, 2], "lg": [0, 2, 6, 3]
    },
    ChartDatasetConfigs: [{
      td_id: 4,
      legend: "Referrers",
      datasetColor: chartColors.blue.rgb,
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      xAxis: "root.referrers[].value",
      yAxis: "root.referrers[].pageviews",
      yAxisOperation: "none",
    }, {
      td_id: 5,
      legend: "UTM Sources",
      datasetColor: chartColors.amber.rgb,
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      xAxis: "root.utm_sources[].value",
      yAxis: "root.utm_sources[].pageviews",
      yAxisOperation: "none",
    }]
  }, {
    tid: 6,
    name: "Browsers & Countries",
    chartSize: 2,
    draft: false,
    includeZeros: true,
    mode: "chart",
    public: false,
    subType: "timeseries",
    type: "table",
    timeInterval: "day",
    layout: {
      "xxs": [0, 9, 2, 3], "xs": [0, 9, 6, 3], "sm": [0, 4, 6, 3], "md": [0, 4, 6, 3], "lg": [6, 2, 6, 3]
    },
    ChartDatasetConfigs: [{
      td_id: 6,
      legend: "Browsers",
      datasetColor: chartColors.blue.rgb,
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      xAxis: "root.browser_names[].value",
      yAxis: "root.browser_names[].pageviews",
      yAxisOperation: "none",
    }, {
      td_id: 7,
      legend: "Countries",
      datasetColor: chartColors.amber.rgb,
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      xAxis: "root.countries[].value",
      yAxis: "root.countries[].pageviews",
      yAxisOperation: "none",
    }]
  }],
});

module.exports.template = template;

module.exports.build = async (teamId, projectId, {
  website, apiKey, charts, connection_id
}) => {
  if (!website && !connection_id) return Promise.reject("Missing required 'website' argument");

  if (!connection_id) {
    let checkErrored = false;
    if (!connection_id) {
      const checkWebsiteOpt = {
        url: `https://simpleanalytics.com/${website}.json?version=5&fields=histogram`,
        method: "GET",
        headers: {
          accept: "application/json",
        },
        json: true,
      };

      if (apiKey) {
        checkWebsiteOpt.headers = {
          "Api-Key": apiKey,
        };
      }
      try {
        const data = await request(checkWebsiteOpt);
        if (!data.histogram) return new Promise((resolve, reject) => reject(new Error("403")));
      } catch (e) {
        checkErrored = true;
      }
    }

    if (!connection_id && checkErrored) {
      return Promise.reject(new Error("404"));
    }
  }

  return builder(teamId, projectId, website, apiKey, template, charts, connection_id)
    .catch((err) => {
      if (err && err.message) {
        return Promise.reject(err.message);
      }
      return Promise.reject(err);
    });
};
