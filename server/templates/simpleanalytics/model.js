const request = require("request-promise");

const builder = require("./builder");

const template = (website, apiKey, dashboardOrder) => ({
  Connections: [{
    name: "SimpleAnalyticsAPI",
    type: "api",
    host: "https://simpleanalytics.com",
    options: [{
      "Api-Key": apiKey || "none",
    }]
  }],
  Charts: [{
    tid: 1,
    name: "30-day Stats",
    chartSize: 1,
    currentEndDate: false,
    dashboardOrder: dashboardOrder + 1,
    displayLegend: false,
    draft: false,
    includeZeros: true,
    mode: "kpi",
    public: false,
    subType: "AddTimeseries",
    timeInterval: "day",
    type: "line",
    Datasets: [{
      legend: "Pageviews",
      datasetColor: "rgba(80, 227, 194, 1)",
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      dateField: "root.histogram[].date",
      xAxis: "root.histogram[].date",
      yAxis: "root.histogram[].pageviews",
      yAxisOperation: "none",
      DataRequest: {
        route: `/${website}.json?version=5&fields=histogram`,
      }
    }, {
      legend: "Visitors",
      datasetColor: "rgba(74, 144, 226, 1)",
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      dateField: "root.histogram[].date",
      xAxis: "root.histogram[].date",
      yAxis: "root.histogram[].visitors",
      yAxisOperation: "none",
      DataRequest: {
        route: `/${website}.json?version=5&fields=histogram`,
      }
    }]
  }, {
    tid: 2,
    name: "Site Stats",
    chartSize: 2,
    currentEndDate: false,
    dashboardOrder: dashboardOrder + 2,
    displayLegend: false,
    draft: false,
    includeZeros: true,
    mode: "kpichart",
    public: false,
    subType: "lcTimeseries",
    timeInterval: "day",
    type: "line",
    showGrowth: true,
    Datasets: [{
      legend: "Pageviews",
      datasetColor: "rgba(80, 227, 194, 1)",
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      dateField: "root.histogram[].date",
      xAxis: "root.histogram[].date",
      yAxis: "root.histogram[].pageviews",
      yAxisOperation: "none",
      DataRequest: {
        route: `/${website}.json?version=5&fields=histogram`,
      }
    }, {
      legend: "Visitors",
      datasetColor: "rgba(74, 144, 226, 1)",
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      dateField: "root.histogram[].date",
      xAxis: "root.histogram[].date",
      yAxis: "root.histogram[].visitors",
      yAxisOperation: "none",
      DataRequest: {
        route: `/${website}.json?version=5&fields=histogram`,
      }
    }]
  }, {
    tid: 3,
    name: "Devices",
    chartSize: 1,
    dashboardOrder: dashboardOrder + 3,
    draft: false,
    includeZeros: true,
    mode: "chart",
    public: false,
    subType: "timeseries",
    timeInterval: "day",
    type: "doughnut",
    displayLegend: true,
    Datasets: [{
      legend: "Devices",
      datasetColor: "rgba(255, 255, 255, 1)",
      fillColor: ["rgba(74, 144, 226, 0.55)", "rgba(126, 211, 33, 0.4)", "rgba(245, 166, 35, 0.55)"],
      multiFill: true,
      xAxis: "root.device_types[].value",
      yAxis: "root.device_types[].visitors",
      yAxisOperation: "none",
      DataRequest: {
        route: `/${website}.json?version=5&fields=device_types`,
      },
    }]
  }, {
    tid: 5,
    name: "Referrers Data",
    chartSize: 2,
    dashboardOrder: dashboardOrder + 4,
    draft: false,
    includeZeros: true,
    mode: "chart",
    public: false,
    subType: "timeseries",
    type: "table",
    timeInterval: "day",
    Datasets: [{
      legend: "Referrers",
      datasetColor: "#2CA02C",
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      xAxis: "root.referrers[].value",
      yAxis: "root.referrers[].pageviews",
      yAxisOperation: "none",
      DataRequest: {
        route: `/${website}.json?version=5&fields=referrers`,
      },
    }, {
      legend: "UTM Sources",
      datasetColor: "#17BECF",
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      xAxis: "root.utm_sources[].value",
      yAxis: "root.utm_sources[].pageviews",
      yAxisOperation: "none",
      DataRequest: {
        route: `/${website}.json?version=5&fields=utm_sources`,
      },
    }]
  }, {
    tid: 6,
    name: "Browsers & Countries",
    chartSize: 2,
    dashboardOrder: dashboardOrder + 5,
    draft: false,
    includeZeros: true,
    mode: "chart",
    public: false,
    subType: "timeseries",
    type: "table",
    timeInterval: "day",
    Datasets: [{
      legend: "Browsers",
      datasetColor: "#2CA02C",
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      xAxis: "root.browser_names[].value",
      yAxis: "root.browser_names[].pageviews",
      yAxisOperation: "none",
      DataRequest: {
        route: `/${website}.json?version=5&fields=browser_names`,
      },
    }, {
      legend: "Countries",
      datasetColor: "#17BECF",
      fill: false,
      fillColor: "rgba(0,0,0,0)",
      xAxis: "root.countries[].value",
      yAxis: "root.countries[].pageviews",
      yAxisOperation: "none",
      DataRequest: {
        route: `/${website}.json?version=5&fields=countries`,
      },
    }]
  }],
});

module.exports.template = template;

module.exports.build = async (projectId, {
  website, apiKey, charts, connection_id
}, dashboardOrder) => {
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

  return builder(projectId, website, apiKey, dashboardOrder, template, charts, connection_id)
    .catch((err) => {
      if (err && err.message) {
        return Promise.reject(err.message);
      }
      return Promise.reject(err);
    });
};
