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

/**
 * INTERNAL FUNCTIONS
 */
function processSeriesData(metrics, dr) {
  const period = (dr.configuration && dr.configuration.period) || "days";

  let series;
  if (metrics.series) {
    series = metrics.series[dr.configuration.series];
  } else {
    series = metrics[dr.configuration.series];
  }

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
}

function processCampaignLinksMetrics(metrics, dr) {
  const { linksMode, selectedLink, period } = dr.configuration;
  if (!linksMode && !selectedLink) return Promise.reject("Invalid configuration");

  let cbMetrics = [];
  if (linksMode === "total") {
    cbMetrics = metrics.map((metric) => {
      return {
        id: metric.link.id,
        href: metric.link.href,
        clicks: metric.metric.series.clicked.reduce((a, b) => a + b),
      };
    });
  } else if (linksMode === "links") {
    const link = metrics.filter((l) => l.link && l.link.href === selectedLink);
    const series = link && link[0] && link[0].metric.series.clicked;

    let newSeries;
    if (period === "hours") {
      newSeries = series.map((s, index) => {
        return {
          date: moment().subtract(series.length - index, "hours").toISOString(),
          clicked: s,
        };
      });
    } else if (period === "days") {
      newSeries = series.map((s, index) => {
        return {
          date: moment().subtract(series.length - index - 1, "days").toISOString(),
          clicked: s,
        };
      });
    } else if (period === "weeks") {
      newSeries = series.map((s, index) => {
        return {
          date: moment().subtract(series.length - index, "weeks").toISOString(),
          clicked: s,
        };
      });
    } else if (period === "months") {
      newSeries = series.map((s, index) => {
        return {
          date: moment().subtract(series.length - index, "months").toISOString(),
          clicked: s,
        };
      });
    }

    cbMetrics = {
      linkSeries: newSeries,
    };
  }

  return cbMetrics;
}

// ----------------------------

/*
** HELPER EXPORTED FUNCTIONS
*/

function getAllSegments(connection) {
  const options = getConnectionOpt(connection, {
    method: "GET",
    route: "segments?limit=100",
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
    route: "campaigns?limit=100",
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

function getCampaignLinks(connection, { campaignId, actionId }) {
  let route = `campaigns/${campaignId}/metrics/links?limit=100`;
  if (actionId) {
    route = `campaigns/${campaignId}/actions/${actionId}/metrics/links?limit=100`;
  }

  const options = getConnectionOpt(connection, {
    method: "GET",
    route,
  });

  return request(options)
    .then((data) => {
      try {
        const parsedData = JSON.parse(data.body);
        if (!parsedData.links) return Promise.reject("Links not found");

        const links = [];
        parsedData.links.forEach((linkObj) => {
          links.push(linkObj.link.href);
        });
        return links;
      } catch (e) { /** */ }

      return Promise.reject("Campaigns not found");
    })
    .catch((err) => {
      return err;
    });
}

function getCampaignActions(connection, { campaignId }) {
  const options = getConnectionOpt(connection, {
    method: "GET",
    route: `campaigns/${campaignId}/actions?limit=100`,
  });

  return request(options)
    .then((data) => {
      try {
        const parsedData = JSON.parse(data.body);
        if (!parsedData.actions) return Promise.reject("Actions not found");

        return parsedData.actions;
      } catch (e) { /** */ }

      return Promise.reject("Actions not found");
    })
    .catch((err) => {
      return err;
    });
}

// ----------------------------

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

    // make sure the ids are populated
    if (result.identifiers && result.identifiers.length > 0) {
      for (let i = 0; i < result.identifiers.length; i++) {
        if (!result.ids[i] && result.identifiers[i].cio_id) {
          result.ids[i] = result.identifiers[i].cio_id;
        }
      }
    }

    result = await getCustomersAttributes(result.ids, attrOpt);

    // remove the field timestamps until further notice
    result.customers = result.customers.map((c) => ({
      ...c,
      timestamps: null,
    }));
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

function getCampaignMetrics(connection, dr) {
  const options = getConnectionOpt(connection, dr);

  if (dr && dr.configuration) {
    options.qs = {
      period: dr.configuration.period,
      steps: dr.configuration.steps,
      resolution: dr.configuration.period,
      type: dr.configuration.type,
      unique: dr.configuration.unique,
      start: dr.configuration.start,
      end: dr.configuration.end,
      limit: 100,
    };
  }

  return request(options)
    .then((data) => {
      try {
        const parsedData = JSON.parse(data.body);
        return parsedData;
      } catch (e) { /** */ }

      return Promise.reject("Metrics not found");
    })
    .then((metrics) => {
      // process the metrics in CB-style based on the request type
      if (options.url.substring(options.url.lastIndexOf("/") === "/metrics") && metrics.metric) {
        return processSeriesData(metrics.metric, dr);
      }
      if (options.url.substring(options.url.lastIndexOf("/") === "/journey_metrics") && metrics.journey_metric) {
        return processSeriesData(metrics.journey_metric, dr);
      }
      if (options.url.indexOf("/metrics/links") > -1 && metrics.links) {
        return processCampaignLinksMetrics(metrics.links, dr);
      }
      return metrics;
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
  getCampaignLinks,
  getCampaignActions,
};
