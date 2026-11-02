function shouldMigrateOnStartup(environment = process.env.NODE_ENV) {
  return environment === "production";
}

module.exports = {
  shouldMigrateOnStartup,
};
