const _ = require("lodash");

const xlsx = require("node-xlsx");
const determineType = require("./determineType");

function normalizeKeys(level, finalKey, finalResult) {
  let newFinalResult = finalResult;
  Object.keys(level).forEach((key) => {
    const newFinalKey = finalKey ? `${finalKey}.${key}` : key;
    const value = level[key];
    if (determineType(value) === "object" && Object.keys(value).length > 0) {
      newFinalResult = normalizeKeys(value, newFinalKey, newFinalResult);
    } else {
      newFinalResult.push(newFinalKey);
    }
  });

  return newFinalResult;
}

function normalizeValues(level, finalResult) {
  let newFinalResult = finalResult;
  Object.keys(level).forEach((key) => {
    const value = level[key];
    if (determineType(value) === "object" && value !== null && Object.values(value).length > 0) {
      newFinalResult = normalizeValues(value, newFinalResult);
    } else if (determineType(value) === "object" && value !== null && Object.values(value).length === 0) {
      newFinalResult.push(JSON.stringify(value));
    } else if (determineType(value) === "array") {
      newFinalResult.push(JSON.stringify(value));
    } else {
      newFinalResult.push(value);
    }
  });

  return newFinalResult;
}

module.exports = (sheetsData) => {
  const formattedData = [];

  sheetsData.map((sheet) => {
    const formattedSet = [];
    let addKeys = true;
    Object.keys(sheet.data).map((dataKey, index) => {
      const dataset = sheet.datasets[index];
      // push the name of the dataset in the first line of each set
      if (index !== 0) formattedSet.push([""]);
      formattedSet.push([dataKey]);

      const set = sheet.data[dataKey];
      let setHeadersIndex;
      set.map((item) => {
        if (addKeys) {
          setHeadersIndex = formattedSet.length;
          if (!formattedSet[setHeadersIndex]) formattedSet.push(normalizeKeys(item, null, []));
          addKeys = false;
        }

        // go through the headers to see if we need to add more as we explore the objects
        const headersSet = normalizeKeys(item, null, []);
        const existingHeaders = formattedSet[setHeadersIndex];
        headersSet.forEach((header) => {
          if (_.indexOf(existingHeaders, header) === -1) {
            formattedSet[setHeadersIndex].push(header);
          }
        });

        return item;
      });

      // remove any headers based on the exclusions
      const formattedExclusions = dataset.excludedFields ? dataset.excludedFields.map((field) => {
        if (field && typeof field.replaceAll === "function") {
          return field.replaceAll("?", ".");
        }

        return field;
      }) : [];
      const tempHeaders = [];
      formattedSet[setHeadersIndex].forEach((header) => {
        let exclude = false;

        // check for exact match
        if (_.indexOf(formattedExclusions, header) > -1) {
          exclude = true;
        }

        // check for nested matches
        formattedExclusions.forEach((exclusion) => {
          if (header.indexOf(`${exclusion}.`) > -1) {
            exclude = true;
          }
        });

        if (!exclude) tempHeaders.push(header);
      });
      formattedSet[setHeadersIndex] = tempHeaders;

      set.forEach((item) => {
        const newItem = {};
        formattedSet[setHeadersIndex].forEach((header) => {
          let formattedHeader = header;
          if (header.indexOf(".") > -1) formattedHeader = header.substring(0, header.indexOf("."));

          if (item[formattedHeader]) newItem[formattedHeader] = item[formattedHeader];
          else newItem[formattedHeader] = null;
        });
        formattedSet.push(normalizeValues(newItem, []));
      });

      addKeys = true;
      return set;
    });

    formattedData.push({
      name: sheet.name,
      data: formattedSet,
    });

    return sheet;
  });

  const options = {
    "!cols": [],
  };
  formattedData[0].data.forEach(() => options["!cols"].push({ wch: 15 }));

  const sheets = formattedData.map((dataItem) => {
    return {
      name: dataItem.name,
      data: dataItem.data,
    };
  });

  // need to make arrays

  return xlsx.build(sheets, options);
};
