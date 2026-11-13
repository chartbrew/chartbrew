const { AsyncLocalStorage } = require("node:async_hooks");

// Set only by trusted integration workers, never from HTTP request fields.
const storage = new AsyncLocalStorage();

module.exports = {
  getIntegrationContext: () => storage.getStore(),
  withIntegrationContext: (context, operation) => storage.run(context, operation),
};
