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
