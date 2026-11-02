const _ = require("lodash");
const safeRequest = require("./safeRequest");
const { parseSourceResponse } = require("./sourceResponse");

function extractArrayResults(parsedResponse) {
  if (parsedResponse instanceof Array) {
    return parsedResponse;
  }

  if (!parsedResponse || typeof parsedResponse !== "object") {
    throw new Error("The data source returned a page without records.");
  }

  let results;
  Object.keys(parsedResponse).forEach((key) => {
    if (parsedResponse[key] instanceof Array) {
      results = parsedResponse[key];
    }
  });

  if (!results) throw new Error("The data source returned a page without records.");
  return results;
}

function PaginateRequests(options, limit, items, offset, policyContext, totalResults = []) {
  return safeRequest(options, policyContext)
    .then((response) => {
      let results;
      const parsedResponse = parseSourceResponse(response);
      results = extractArrayResults(parsedResponse);

      // check if results are the same as previous ones (infinite request loop?)
      if (results?.length > 0 && _.isEqual(results, totalResults)) {
        throw new Error("The data source repeated a page. Check the pagination settings.");
      }

      const tempResults = totalResults.concat(results);

      if (results.length === 0 || (tempResults.length >= limit && limit !== 0)) {
        let finalResults = tempResults;

        // check if it goes above the limit
        if (tempResults.length > limit && limit !== 0) {
          finalResults = tempResults.slice(0, limit);
        }

        return finalResults;
      }

      const newOptions = options;
      newOptions.qs[offset] = parseInt(options.qs[offset], 10) + parseInt(options.qs[items], 10);

      return PaginateRequests(newOptions, limit, items, offset, policyContext, tempResults);
    });
}

function PaginatePages(options, limit, offset, policyContext, totalResults = []) {
  if (!options.qs[offset]) options.qs[offset] = 1; // eslint-disable-line

  return safeRequest(options, policyContext)
    .then((response) => {
      let results;
      const parsedResponse = parseSourceResponse(response);
      results = extractArrayResults(parsedResponse);

      // check if results are the same as previous ones (infinite request loop?)
      if (results?.length > 0 && _.isEqual(results, totalResults)) {
        throw new Error("The data source repeated a page. Check the pagination settings.");
      }

      const tempResults = totalResults.concat(results);

      if (results.length === 0 || (tempResults.length >= limit && limit !== 0)) {
        let finalResults = tempResults;

        // check if it goes above the limit
        if (tempResults.length > limit && limit !== 0) {
          finalResults = tempResults.slice(0, limit);
        }

        return finalResults;
      }

      // increment page number
      const newOptions = options;
      newOptions.qs[offset] = parseInt(options.qs[offset], 10) + 1;

      return PaginatePages(newOptions, limit, offset, policyContext, tempResults);
    });
}

function PaginateStripe(options, limit, policyContext, totalResults) {
  return safeRequest(options, policyContext)
    .then((response) => {
      // introduce a delay so Stripe doesn't shut down the request
      return new Promise((resolve) => setTimeout(() => resolve(response), 1500));
    })
    .then((response) => {
      const result = parseSourceResponse(response);
      const tempResults = result;
      tempResults.data = (
        totalResults && totalResults.data && totalResults.data.concat(result.data)
      ) || result.data;

      if (!result.has_more
        || (tempResults.data && tempResults.data.length >= limit && limit !== 0)
      ) {
        if (tempResults.data.length > limit && limit !== 0) {
          tempResults.data = tempResults.data.slice(0, limit);
        }
        // the recursion ends here
        return tempResults;
      }

      // continue the recursion
      const newOptions = options;
      newOptions.qs.starting_after = tempResults.data[tempResults.data.length - 1].id;

      return PaginateStripe(newOptions, limit, policyContext, tempResults);
    });
}

function PaginateUrl(options, paginationField, limit, policyContext, totalResults = []) {
  return safeRequest(options, policyContext)
    .then((response) => {
      let results;
      let paginationURL;
      let resultsKey;
      let parsedResponse;
      parsedResponse = parseSourceResponse(response);
      const formattedPaginationField = paginationField.replace("root.", "").replace("root[].", "");
      paginationURL = _.get(parsedResponse, formattedPaginationField);

      Object.keys(parsedResponse).forEach((key) => {
        if (parsedResponse[key] instanceof Array) {
          results = parsedResponse[key];
          resultsKey = key;
        }
      });

      // check if results are the same as previous ones (infinite request loop?)
      if (results?.length > 0 && _.isEqual(results, totalResults)) {
        throw new Error("The data source repeated a page. Check the pagination settings.");
      }

      if (!results) throw new Error("The data source returned a page without records.");
      const tempResults = totalResults.concat(results);

      if (results.length === 0
          || (tempResults.length >= limit && limit !== 0)
          || !paginationURL
      ) {
        let finalResults = tempResults;

        // check if it goes above the limit
        if (tempResults.length > limit && limit !== 0) {
          finalResults = tempResults.slice(0, limit);
        }

        parsedResponse[resultsKey] = finalResults;
        return parsedResponse;
      }

      const newOptions = options;
      if (paginationURL === options.url) throw new Error("The data source repeated a page. Check the pagination settings.");
      newOptions.url = paginationURL;

      return PaginateUrl(newOptions, paginationField, limit, policyContext, tempResults);
    });
}

function PaginateCursor(options, limit, items, offset, policyContext, totalResults = []) {
  return safeRequest(options, policyContext)
    .then((response) => {
      const resultsKey = [];
      const result = parseSourceResponse(response);
      if (Array.isArray(result) && result.length === 0) {
        return Array.isArray(totalResults) ? totalResults : _.set(totalResults, items, null);
      }
      Object.keys(result).forEach((key) => {
        if (result[key] instanceof Array) {
          resultsKey.push(key);
        }
      });

      const tempResults = result;
      let endRecursion = false;
      if (resultsKey.length === 0) {
        throw new Error("The data source returned a page without records.");
      }

      resultsKey.forEach((resultKey) => {
        tempResults[resultKey] = (
          totalResults
          && totalResults[resultKey]
          && totalResults[resultKey].concat(result[resultKey])
        ) || result[resultKey];

        const nextCursor = _.get(result, items);
        if (!nextCursor
          || (tempResults[resultKey] && tempResults[resultKey].length >= limit && limit !== 0)
        ) {
          if (tempResults[resultKey].length > limit && limit !== 0) {
            tempResults[resultKey] = tempResults[resultKey].slice(0, limit);
          }
          endRecursion = true;
        }
      });

      if (endRecursion) {
        // the recursion ends here
        return tempResults;
      }

      // continue the recursion
      const newOptions = options;
      const nextCursor = _.get(tempResults, items);
      if (!newOptions.qs) newOptions.qs = {};
      if (nextCursor === newOptions.qs[offset]) throw new Error("The data source repeated a page. Check the pagination settings.");
      newOptions.qs[offset] = nextCursor;

      return PaginateCursor(newOptions, limit, items, offset, policyContext, tempResults);
    });
}

module.exports = (template = "custom", {
  options, limit, items, offset, paginationField, policyContext = {},
}) => {
  let results;

  switch (template) {
    case "custom":
      results = PaginateRequests(options, limit, items, offset, policyContext);
      break;
    case "stripe": {
      // make sure stripe's query parameters include the max limit value
      const stripeOpt = _.cloneDeep(options);
      stripeOpt.qs.limit = 100;
      results = PaginateStripe(stripeOpt, limit, policyContext);
      break;
    }
    case "url":
      results = PaginateUrl(options, paginationField, limit, policyContext);
      break;
    case "pages":
      results = PaginatePages(options, limit, offset, policyContext);
      break;
    case "cursor":
      results = PaginateCursor(options, limit, items, offset, policyContext);
      break;
    default:
      results = PaginateRequests(options, limit, items, offset, policyContext);
  }

  return results;
};
