const request = require("request-promise");

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

function getCustomers(connection, dr) {
  const options = getConnectionOpt(connection, dr);

  if (dr.configuration && dr.configuration.cioFilters) {
    const selector = dr.configuration.cioFilters.and ? "and" : "or";
    if (dr.configuration.cioFilters[selector] && dr.configuration.cioFilters[selector].length > 0) {
      options.body = JSON.stringify({ filter: dr.configuration.cioFilters });
    } else {
      return Promise.reject("No filters selected");
    }
  }

  return paginateRequests("cursor", {
    options, limit: dr.itemsLimit, items: "next", offset: "start"
  });
}

function getAllSegments(connection) {
  const options = getConnectionOpt(connection, {
    method: "GET",
    route: "segments",
  });

  return request(options)
    .then((data) => {
      console.log("data.body", data.body);
      try {
        const parsedData = JSON.parse(data.body);
        if (parsedData.segments) return parsedData.segments;
      } catch (e) {
        return Promise.reject("Segments not found");
      }
      return Promise.reject("Segments not found");
    })
    .catch((err) => {
      return err;
    });
}

module.exports = {
  getConnectionOpt,
  getCustomers,
  getAllSegments,
};
