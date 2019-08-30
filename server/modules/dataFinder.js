const dataFinder = {
  findField(obj, fieldSelector, index) {
    let finalValue;
    Object.keys(obj).forEach((key) => { // eslint-disable-line
      if (key === fieldSelector[index] && index === fieldSelector.length - 1) {
        finalValue = obj[key];
        return obj[key];
      } else if (key === fieldSelector[index]) {
        dataFinder.findField(obj[key], fieldSelector, index + 1);
      }
    });

    return finalValue;
  }
};

module.exports = dataFinder;
