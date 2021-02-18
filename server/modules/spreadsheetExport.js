const xlsx = require("node-xlsx");
const determineType = require("./determineType");

module.exports = (sheetsData) => {
  const formattedData = [];

  sheetsData.map((data) => {
    const formattedSet = [];
    let addKeys = true;
    Object.keys(data.data).map((dataset, index) => {
      // push the name of the dataset in the first line of each set
      if (index !== 0) formattedSet.push([""]);
      formattedSet.push([dataset]);

      const set = data.data[dataset];
      set.map((item) => {
        if (addKeys) {
          formattedSet.push(Object.keys(item));
          addKeys = false;
        }
        formattedSet.push(
          Object.values(item).map((val) => {
            if (determineType(val) === "object") return JSON.stringify(val);
            return val;
          })
        );
        return item;
      });

      addKeys = true;
      return set;
    });
    formattedData.push({
      name: data.name,
      data: formattedSet,
    });

    return data;
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
