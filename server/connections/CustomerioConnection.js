const request = require("request-promise");
const moment = require("moment");

const paginateRequests = require("../modules/paginateRequests");

function getConnectionOpt(connection, dr) {
  const host = connection.host === "eu" ? "https://api-eu.customer.io/v1" : "https://api.customer.io/v1";
  const options = {
    url: `${host}/${dr.route}`,
    method: dr.method,
    headers: {
      "Accept": "application/json",
      "authorization": `Bearer ${connection.password}`,
    },
    resolveWithFullResponse: true,
  };

  if (dr.method === "POST" || dr.method === "PUT") {
    options.headers["content-type"] = "application/json";
  }

  return options;
}

function getCustomersAttributes(ids, options, result = {}) {
  if (!ids) return result;

  const newOpt = options;
  if (ids.length <= 100) {
    newOpt.body = JSON.stringify({ ids });
  } else {
    newOpt.body = JSON.stringify({ ids: ids.slice(0, 100) });
  }

  return request(newOpt)
    .then((response) => {
      try {
        const parsedRes = JSON.parse(response.body);
        const newResult = { ...result };
        if (!newResult.customers) newResult.customers = [];

        newResult.customers = [...newResult.customers, ...parsedRes.customers];
        if (ids.length <= 100) return newResult;

        return getCustomersAttributes(ids.slice(100), options, newResult);
      } catch (e) {
        return result;
      }
    })
    .catch(() => {
      return result;
    });
}

async function getCustomers(connection, dr) {
  const options = getConnectionOpt(connection, dr);

  if (dr.configuration && dr.configuration.cioFilters) {
    const selector = dr.configuration.cioFilters.and ? "and" : "or";
    if (dr.configuration.cioFilters[selector] && dr.configuration.cioFilters[selector].length > 0) {
      options.body = JSON.stringify({ filter: dr.configuration.cioFilters });
    } else {
      return Promise.reject("No filters selected");
    }
  }

  let result = await paginateRequests("cursor", {
    options, limit: dr.itemsLimit, items: "next", offset: "start"
  });

  // check if the customer attributes need to be populated
  if (dr.configuration.populateAttributes) {
    const attrOpt = options;
    attrOpt.url += "/attributes";
    result = await getCustomersAttributes(result.ids, attrOpt);
  }

  // clean the results
  if (result.identifiers) {
    result.customers = result.identifiers;
    delete result.identifiers;
    delete result.ids;
    delete result.next;
  }

  result.customer_count = result.customers ? result.customers.length : 0;
  return result;
}

function getAllSegments(connection) {
  const options = getConnectionOpt(connection, {
    method: "GET",
    route: "segments",
  });

  return request(options)
    .then((data) => {
      try {
        const parsedData = JSON.parse(data.body);
        if (parsedData.segments) return parsedData.segments;
      } catch (e) { /** */ }

      return Promise.reject("Segments not found");
    })
    .catch((err) => {
      return err;
    });
}

function getAllCampaigns(connection) {
  const options = getConnectionOpt(connection, {
    method: "GET",
    route: "campaigns",
  });

  return request(options)
    .then((data) => {
      try {
        const parsedData = JSON.parse(data.body);
        if (parsedData.campaigns) return parsedData.campaigns;
      } catch (e) { /** */ }

      return Promise.reject("Campaigns not found");
    })
    .catch((err) => {
      return err;
    });
}

function getCampaignMetrics(connection, dr) {
  const options = getConnectionOpt(connection, dr);

  if (dr && dr.configuration) {
    options.qs = {
      period: dr.configuration.period,
      steps: dr.configuration.steps,
      type: dr.configuration.type,
    };
  }

  return request(options)
    .then((data) => {
      try {
        const parsedData = JSON.parse(data.body);
        if (parsedData.metric) return parsedData.metric;
      } catch (e) { /** */ }

      return Promise.reject("Metrics not found");
    })
    .then((metrics) => {
      // process the metrics in CB-style
      const period = (dr.configuration && dr.configuration.period) || "days";
      const series = metrics.series[dr.configuration.series];

      let newSeries;
      if (period === "hours") {
        newSeries = series.map((s, index) => {
          return {
            date: moment().subtract(series.length - index, "hours").toISOString(),
            value: s,
          };
        });
      } else if (period === "days") {
        newSeries = series.map((s, index) => {
          return {
            date: moment().subtract(series.length - index - 1, "days").toISOString(),
            value: s,
          };
        });
      } else if (period === "weeks") {
        newSeries = series.map((s, index) => {
          return {
            date: moment().subtract(series.length - index, "weeks").toISOString(),
            value: s,
          };
        });
      } else if (period === "months") {
        newSeries = series.map((s, index) => {
          return {
            date: moment().subtract(series.length - index, "months").toISOString(),
            value: s,
          };
        });
      }
      return {
        [dr.configuration.series]: newSeries
      };
    })
    .catch((err) => {
      return err;
    });
}

module.exports = {
  getConnectionOpt,
  getCustomers,
  getAllSegments,
  getAllCampaigns,
  getCampaignMetrics,
};
