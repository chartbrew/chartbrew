import {
  describe, expect, it
} from "vitest";

const {
  buildResponseInputFromMessages,
  buildAssistantMessageFromResponse,
  buildDisambiguationAssistantMessage,
  buildFallbackAssistantMessage,
  sanitizeToolError,
  buildUsageRecordFromResponse,
} = require("../../modules/ai/orchestrator/orchestrator");

describe("orchestrator Responses API adapters", () => {
  it("converts stored chat-style history into Responses API input items", () => {
    const input = buildResponseInputFromMessages([
      { role: "user", content: "How many users signed up?" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{
          id: "call_123",
          type: "function",
          function: {
            name: "list_connections",
            arguments: "{\"project_id\":\"1\"}",
          },
        }],
      },
      {
        role: "tool",
        name: "list_connections",
        tool_call_id: "call_123",
        content: "{\"connections\":[]}",
      },
    ]);

    expect(input).toEqual([
      {
        type: "message",
        role: "user",
        content: "How many users signed up?",
      },
      {
        type: "function_call",
        call_id: "call_123",
        name: "list_connections",
        arguments: "{\"project_id\":\"1\"}",
      },
      {
        type: "function_call_output",
        call_id: "call_123",
        output: "{\"connections\":[]}",
      },
    ]);
  });

  it("maps Responses output back into the stored assistant message format", () => {
    const assistantMessage = buildAssistantMessageFromResponse({
      output_text: "",
      output: [{
        type: "function_call",
        call_id: "call_456",
        name: "get_schema",
        arguments: "{\"connection_id\":\"9\"}",
      }],
    });

    expect(assistantMessage).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [{
        id: "call_456",
        type: "function",
        function: {
          name: "get_schema",
          arguments: "{\"connection_id\":\"9\"}",
        },
      }],
    });
  });

  it("normalizes Responses usage into existing AiUsage-compatible fields", () => {
    const usageRecord = buildUsageRecordFromResponse({
      usage: {
        input_tokens: 120,
        output_tokens: 45,
        total_tokens: 165,
      },
    }, 850, "gpt-5.4-mini");

    expect(usageRecord).toEqual({
      model: "gpt-5.4-mini",
      prompt_tokens: 120,
      completion_tokens: 45,
      total_tokens: 165,
      elapsed_ms: 850,
    });
  });

  it("builds a non-empty fallback message after tool-only chart creation", () => {
    const message = buildFallbackAssistantMessage({
      toolResults: [{
        content: JSON.stringify({
          chart_created: true,
          name: "Total sessions",
        }),
      }],
    });

    expect(message).toBe("I created Total sessions.");
  });

  it("builds a persisted assistant message with quick replies for disambiguation", () => {
    const message = buildDisambiguationAssistantMessage({
      prompt: "Which sprint should I use?",
      options: [
        { label: "Use the active sprint", value: "active_sprint" },
        { label: "Pick a board", value: "pick_board" },
      ],
    });

    expect(message).toContain("Which sprint should I use?");
    expect(message).toContain("```cb-actions");
    expect(message).toContain("\"version\": 1");
    expect(message).toContain("\"id\": \"active_sprint\"");
    expect(message).toContain("\"label\": \"Use the active sprint\"");
    expect(message).toContain("\"action\": \"reply\"");
  });

  it("redacts sensitive request details from tool errors", () => {
    const message = sanitizeToolError(new Error("401 - authorization: Basic abc123def456 token=secret"));

    expect(message).toContain("Basic [REDACTED]");
    expect(message).toContain("token=[REDACTED]");
    expect(message).not.toContain("abc123def456");
    expect(message).not.toContain("secret");
  });
});
