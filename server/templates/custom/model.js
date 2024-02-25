const builder = require("./builder");

module.exports.build = async (teamId, projectId, {
  template_id, charts, connections, newDatasets,
}) => {
  if (!template_id) return Promise.reject("Missing required parameters");

  return builder(teamId, projectId, {
    template_id, charts, connections, newDatasets
  })
    .catch((err) => {
      if (err && err.message) {
        return Promise.reject(err.message);
      }
      return Promise.reject(err);
    });
};
