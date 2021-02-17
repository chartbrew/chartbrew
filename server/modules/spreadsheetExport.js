const xlsx = require("node-xlsx");

module.exports = (data) => {
  const formattedData = [];

  data.map((set) => {
    const formattedSet = [];
    set.map((item, index) => {
      if (index === 0) {
        formattedSet.push(Object.keys(item));
      }

      formattedSet.push(Object.values(item));

      return item;
    });

    formattedData.push(formattedSet);
    return set;
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
