const builder = require("./builder");

module.exports.build = async (projectId, {
  template_id, charts, connections,
}, dashboardOrder) => {
  if (!template_id) return Promise.reject("Missing required parameters");

  return builder(projectId, { template_id, charts, connections }, dashboardOrder)
    .catch((err) => {
      if (err && err.message) {
        return Promise.reject(err.message);
      }
      return Promise.reject(err);
    });
};
