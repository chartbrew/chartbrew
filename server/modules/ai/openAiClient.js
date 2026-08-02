const OpenAI = require("openai");

function getOpenAiConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const suffix = isProduction ? "" : "_DEV";
  const apiKey = process.env[`CB_OPENAI_API_KEY${suffix}`];
  const baseURL = process.env[`CB_OPENAI_BASE_URL${suffix}`];

  return {
    model: process.env[`CB_OPENAI_MODEL${suffix}`],
    clientOptions: {
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    },
  };
}

function createOpenAiClient() {
  const { clientOptions } = getOpenAiConfig();
  return clientOptions.apiKey ? new OpenAI(clientOptions) : undefined;
}

module.exports = {
  createOpenAiClient,
  getOpenAiConfig,
};
