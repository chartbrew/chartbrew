import assert from "node:assert/strict";
import test from "node:test";

import {
  getChartToolMessageInfo,
  getOperationSummary,
  groupAiMessages,
  isProgressForConversation,
  normalizeProgressEvent,
} from "./aiMessageUtils.js";

test("summarizes connection checks for both live and saved conversations", () => {
  assert.equal(getOperationSummary([{ name: "list_connections", status: "complete" }]), "Checked available connections");
  assert.equal(getOperationSummary([{ name: "list_connections", type: "call" }]), "Checked available connections");
});

test("keeps connection card references when a saved conversation is grouped", () => {
  const option = { name: "PostHog", provider_id: "posthog", state: "mcp_oauth_setup", connection_id: 8 };
  const groups = groupAiMessages([
    { role: "tool", name: "list_connections", content: JSON.stringify({ options: [option] }) },
    { role: "assistant", content: "Connect your data source to continue." },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].items[0].parsed.content.options, [option]);
});

test("restores a temporary chart preview from saved tool history", () => {
  const parsed = getChartToolMessageInfo({
    content: JSON.stringify({
      chart_id: 44,
      ghost_project_id: 77,
      name: "Trial conversion",
      visibility: "temporary",
    }),
    name: "create_temporary_chart",
    role: "tool",
  });
  assert.equal(parsed.chartId, 44);
  assert.equal(parsed.chartName, "Trial conversion");
  assert.equal(parsed.projectId, 77);
  assert.equal(parsed.type, "chart_temporary");
});

test("restores a saved chart from persistent tool history", () => {
  const parsed = getChartToolMessageInfo({
    content: JSON.stringify({
      chart_id: 45,
      name: "Revenue",
      project_id: 78,
      visibility: "dashboard",
    }),
    name: "create_chart",
    role: "tool",
  });
  assert.equal(parsed.type, "chart_created");
  assert.equal(parsed.projectId, 78);
  assert.equal(parsed.isTemporary, false);
});

test("restores one saved chart after a preview is added to a dashboard", () => {
  const groups = groupAiMessages([{
    content: JSON.stringify({
      chart_id: 44,
      ghost_project_id: 77,
      name: "Trial conversion",
      visibility: "temporary",
    }),
    name: "create_temporary_chart",
    role: "tool",
  }, {
    content: "",
    role: "assistant",
    tool_calls: [{
      function: { arguments: "{}", name: "move_chart_to_dashboard" },
      id: "move_44",
    }],
  }, {
    content: JSON.stringify({
      chart_id: 44,
      chart_name: "Trial conversion",
      new_project_id: 88,
      visibility: "dashboard",
    }),
    name: "move_chart_to_dashboard",
    role: "tool",
    tool_call_id: "move_44",
  }, {
    content: "Added Trial conversion to Growth.",
    role: "assistant",
  }]);
  const chartGroups = groups.filter((group) => group.type.startsWith("chart_"));
  assert.equal(chartGroups.length, 1);
  assert.equal(chartGroups[0].items[0].parsed.projectId, 88);
  assert.equal(chartGroups[0].items[0].parsed.visibility, "dashboard");
});

test("normalizes socket progress events and scopes them to the active chat", () => {
  const event = normalizeProgressEvent({
    conversationId: "11111111-1111-4111-8111-111111111111",
    event: "execution",
    data: {
      message: "Prepared a chart preview",
      tools: ["create_temporary_chart"],
    },
    timestamp: "2026-08-14T11:00:00.000Z",
  });
  assert.equal(event.type, "execution");
  assert.equal(event.tools[0], "create_temporary_chart");
  assert.equal(
    isProgressForConversation(event, "11111111-1111-4111-8111-111111111111"),
    true,
  );
  assert.equal(isProgressForConversation(event, "22222222-2222-4222-8222-222222222222"), false);
  assert.equal(isProgressForConversation(event, null), false);
  assert.equal(isProgressForConversation({ event: "execution" }, "11111111-1111-4111-8111-111111111111"), true);
});
