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

  it("does not create a client without the selected environment API key", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CB_OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "must-not-be-used");

    expect(createOpenAiClient()).toBeUndefined();
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

  it("routes Responses API calls through the configured endpoint", async () => {
    let requestUrl;
    let requestedModel;
    const server = createServer((request, response) => {
      requestUrl = request.url;
      let body = "";
      request.on("data", (chunk) => { body += chunk; });
      request.on("end", () => {
        requestedModel = JSON.parse(body).model;
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          id: "resp-test",
          object: "response",
          created_at: 1,
          status: "completed",
          model: "gateway-model",
          output: [{
            id: "msg-test",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: "Gateway response", annotations: [] }],
          }],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        }));
      });
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CB_OPENAI_API_KEY", "gateway-key");
      vi.stubEnv("CB_OPENAI_BASE_URL", `http://127.0.0.1:${port}/v1`);

      const response = await createOpenAiClient().responses.create({
        model: "gateway-model",
        input: "Hello",
      });

      expect(response.output_text).toBe("Gateway response");
      expect(requestUrl).toBe("/v1/responses");
      expect(requestedModel).toBe("gateway-model");
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it.each([
    [401, "invalid API key"],
    [404, "model not found"],
    [400, "context window exceeded"],
  ])("preserves SDK errors for HTTP %i", async (status, message) => {
    const server = createServer((_request, response) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message } }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CB_OPENAI_API_KEY", "gateway-key");
      vi.stubEnv("CB_OPENAI_BASE_URL", `http://127.0.0.1:${port}/v1`);

      await expect(createOpenAiClient().chat.completions.create({
        model: "gateway-model",
        messages: [{ role: "user", content: "Hello" }],
      }, { maxRetries: 0 })).rejects.toMatchObject({ status });
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("retries a rate-limited request", async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.writeHead(requests === 1 ? 429 : 200, {
        "Content-Type": "application/json",
        "retry-after-ms": "1",
      });
      response.end(JSON.stringify(requests === 1
        ? { error: { message: "rate limited" } }
        : {
          id: "chatcmpl-test",
          object: "chat.completion",
          created: 0,
          model: "gateway-model",
          choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CB_OPENAI_API_KEY", "gateway-key");
      vi.stubEnv("CB_OPENAI_BASE_URL", `http://127.0.0.1:${port}/v1`);

      const result = await createOpenAiClient().chat.completions.create({
        model: "gateway-model",
        messages: [{ role: "user", content: "Hello" }],
      }, { maxRetries: 1 });

      expect(result.choices[0].message.content).toBe("ok");
      expect(requests).toBe(2);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("surfaces timeout failures", async () => {
    const server = createServer((_request, response) => {
      setTimeout(() => {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end("not-json");
      }, 100);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CB_OPENAI_API_KEY", "gateway-key");
      vi.stubEnv("CB_OPENAI_BASE_URL", `http://127.0.0.1:${port}/v1`);

      await expect(createOpenAiClient().chat.completions.create({
        model: "gateway-model",
        messages: [{ role: "user", content: "Hello" }],
      }, { maxRetries: 0, timeout: 10 })).rejects.toBeDefined();
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("rejects malformed JSON responses", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("not-json");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CB_OPENAI_API_KEY", "gateway-key");
      vi.stubEnv("CB_OPENAI_BASE_URL", `http://127.0.0.1:${port}/v1`);

      await expect(createOpenAiClient().chat.completions.create({
        model: "gateway-model",
        messages: [{ role: "user", content: "Hello" }],
      }, { maxRetries: 0 })).rejects.toBeDefined();
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it.skipIf(!process.env.LITELLM_E2E_BASE_URL || !process.env.LITELLM_E2E_API_KEY || !process.env.LITELLM_E2E_MODEL)(
    "completes live Chat Completions and Responses API requests",
    async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CB_OPENAI_API_KEY", process.env.LITELLM_E2E_API_KEY);
      vi.stubEnv("CB_OPENAI_BASE_URL", process.env.LITELLM_E2E_BASE_URL);
      const client = createOpenAiClient();
      const model = process.env.LITELLM_E2E_MODEL;

      const chat = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: "Reply with OK." }],
      });
      const responses = await client.responses.create({
        model,
        input: "Reply with OK.",
      });

      expect(chat.choices[0].message.content?.trim()).toBeTruthy();
      expect(responses.output_text.trim()).toBeTruthy();
    }
  );
});
