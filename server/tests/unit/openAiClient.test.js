import {
  afterEach, describe, expect, it, vi
} from "vitest";
import { createServer } from "node:http";

const { createOpenAiClient, getOpenAiConfig } = require("../../modules/ai/openAiClient");

describe("OpenAI client configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the production LiteLLM endpoint when configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CB_OPENAI_API_KEY", "production-key");
    vi.stubEnv("CB_OPENAI_MODEL", "production-model");
    vi.stubEnv("CB_OPENAI_BASE_URL", "http://litellm.example/v1");

    expect(getOpenAiConfig()).toEqual({
      model: "production-model",
      clientOptions: {
        apiKey: "production-key",
        baseURL: "http://litellm.example/v1",
      },
    });
  });

  it("uses development variables and leaves the default endpoint unchanged", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CB_OPENAI_API_KEY_DEV", "development-key");
    vi.stubEnv("CB_OPENAI_MODEL_DEV", "development-model");
    vi.stubEnv("CB_OPENAI_BASE_URL_DEV", "");

    expect(getOpenAiConfig()).toEqual({
      model: "development-model",
      clientOptions: {
        apiKey: "development-key",
      },
    });
  });

  it("routes chat completions through the configured OpenAI-compatible endpoint", async () => {
    let requestUrl;
    let authorization;
    const server = createServer((request, response) => {
      requestUrl = request.url;
      authorization = request.headers.authorization;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "gateway-model",
        choices: [{
          index: 0,
          message: { role: "assistant", content: "Gateway response" },
          finish_reason: "stop",
        }],
      }));
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CB_OPENAI_API_KEY", "gateway-key");
      vi.stubEnv("CB_OPENAI_BASE_URL", `http://127.0.0.1:${port}/v1`);

      const response = await createOpenAiClient().chat.completions.create({
        model: "gateway-model",
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(response.choices[0].message.content).toBe("Gateway response");
      expect(requestUrl).toBe("/v1/chat/completions");
      expect(authorization).toBe("Bearer gateway-key");
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
