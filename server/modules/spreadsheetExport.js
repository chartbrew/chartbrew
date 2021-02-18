const xlsx = require("node-xlsx");

module.exports = (sheetsData) => {
  const formattedData = [];

  sheetsData.map((data) => {
    const formattedSet = [];
    let addKeys = true;
    Object.keys(data).map((dataset, index) => {
      // push the name of the dataset in the first line of each set
      if (index !== 0) formattedSet.push([""]);
      formattedSet.push([dataset]);

      const set = data[dataset];
      set.map((item) => {
        if (addKeys) {
          formattedSet.push(Object.keys(item));
          addKeys = false;
        }
        formattedSet.push(Object.values(item));
        return item;
      });

      addKeys = true;
      return set;
    });
    formattedData.push(formattedSet);

    return data;
  });

  const options = {
    "!cols": [],
  };
  formattedData[0].forEach(() => options["!cols"].push({ wch: 15 }));

  const sheets = formattedData.map((dataItem, index) => {
    return {
      name: `ChartbrewSheet${index + 1}`,
      data: dataItem,
    };
  });

  // need to make arrays

  return xlsx.build(sheets, options);
};
