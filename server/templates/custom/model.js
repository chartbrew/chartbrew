const builder = require("./builder");

module.exports.build = async (projectId, {
  template_id, charts,
}) => {
  if (!template_id) return Promise.reject("Missing required parameters");

  return builder(projectId, { template_id, charts })
    .catch((err) => {
      if (err && err.message) {
        return Promise.reject(err.message);
      }
      return Promise.reject(err);
    });
};
