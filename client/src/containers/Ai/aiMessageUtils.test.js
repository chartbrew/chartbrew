import assert from "node:assert/strict";
import test from "node:test";

import {
  getChartToolMessageInfo,
  isProgressForConversation,
  normalizeProgressEvent,
} from "./aiMessageUtils.js";

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
  assert.equal(parsed.isTemporary, undefined);
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
