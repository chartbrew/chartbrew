import {
  describe, expect, it
} from "vitest";

const {
  buildResponseInputFromMessages,
  buildAssistantMessageFromResponse,
  buildDisambiguationAssistantMessage,
  buildFallbackAssistantMessage,
  appendDashboardLinksToAssistantMessage,
  collectRecentSourceContext,
  sanitizeToolError,
  buildUsageRecordFromResponse,
  availableTools,
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

  it("builds a fallback dashboard creation message with a dashboard link", () => {
    const message = buildFallbackAssistantMessage({
      toolResults: [{
        content: JSON.stringify({
          dashboard_created: true,
          dashboard_url: "http://localhost:4019/dashboard/77",
        }),
      }],
    });

    expect(message).toBe("I created the dashboard.\n\n[Open dashboard](http://localhost:4019/dashboard/77)");
  });

  it("appends dashboard links to assistant messages after dashboard creation", () => {
    const message = appendDashboardLinksToAssistantMessage("Your sprint health dashboard is ready.", [{
      content: JSON.stringify({
        dashboard_created: true,
        dashboard_url: "http://localhost:4019/dashboard/77",
      }),
    }]);

    expect(message).toBe("Your sprint health dashboard is ready.\n\n[Open dashboard](http://localhost:4019/dashboard/77)");
  });

  it("does not append duplicate dashboard links", () => {
    const message = appendDashboardLinksToAssistantMessage(
      "Your dashboard is ready: http://localhost:4019/dashboard/77",
      [{
        content: JSON.stringify({
          dashboard_created: true,
          dashboard_url: "http://localhost:4019/dashboard/77",
        }),
      }]
    );

    expect(message).toBe("Your dashboard is ready: http://localhost:4019/dashboard/77");
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

  it("collects recent Jira source context from prior tool results", () => {
    const context = collectRecentSourceContext([{
      role: "tool",
      name: "source_search_records",
      content: JSON.stringify({
        source: "jira",
        status: "ok",
        configuration: {
          projectIdOrKey: "D2371",
          boardId: "289",
          sprintId: "123",
        },
        resolution: {
          project: { key: "D2371" },
          board: { id: "289", name: "D2371 Scrum Board" },
          sprint: { id: "123", name: "FLS2.0 Sprint 17" },
        },
      }),
    }]);

    expect(context).toContain("Jira project D2371");
    expect(context).toContain("board 289");
    expect(context).toContain("sprint 123");
    expect(context).toContain("overrides.project");
  });

  it("redacts sensitive request details from tool errors", () => {
    const message = sanitizeToolError(new Error("401 - authorization: Basic abc123def456 token=secret"));

    expect(message).toContain("Basic [REDACTED]");
    expect(message).toContain("token=[REDACTED]");
    expect(message).not.toContain("abc123def456");
    expect(message).not.toContain("secret");
  });

  it("exposes the generic source context resolution tool", async () => {
    const tools = await availableTools();
    const tool = tools.find((candidate) => candidate.name === "source_resolve_context");

    expect(tool).toMatchObject({
      name: "source_resolve_context",
      displayName: "Resolve source context",
    });
    expect(tool.parameters.required).toEqual(expect.arrayContaining(["connection_id", "question"]));
  });

  it("exposes generic source action and record search tools", async () => {
    const tools = await availableTools();
    const actionTool = tools.find((candidate) => candidate.name === "source_run_action");
    const searchTool = tools.find((candidate) => candidate.name === "source_search_records");

    expect(actionTool).toMatchObject({
      name: "source_run_action",
      displayName: "Run source action",
    });
    expect(actionTool.parameters.required).toEqual(expect.arrayContaining(["connection_id", "action"]));
    expect(searchTool).toMatchObject({
      name: "source_search_records",
      displayName: "Search source records",
    });
    expect(searchTool.parameters.required).toEqual(expect.arrayContaining(["connection_id", "question"]));
  });

  it("lets source-owned planning choose preview or persist mode", async () => {
    const tools = await availableTools();
    const tool = tools.find((candidate) => candidate.name === "source_plan_dataset");

    expect(tool.parameters.properties.mode).toMatchObject({
      type: "string",
      enum: ["preview", "persist"],
      default: "preview",
    });
  });

  it("does not advertise source-owned Jira for generic query generation", async () => {
    const tools = await availableTools();
    const tool = tools.find((candidate) => candidate.name === "generate_query");

    expect(tool.parameters.properties.source_id.enum).not.toContain("jira");
    expect(tool.parameters.properties.preferred_dialect.enum).not.toContain("jira");
  });
});
