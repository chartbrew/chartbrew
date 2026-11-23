import { afterEach, describe, expect, it, vi } from "vitest";

const { createSlackProgress } = require("../../apps/slack/progress");
afterEach(() => vi.restoreAllMocks());

describe("Slack progress updates", () => {
  it("edits the same message using only the public tool label", async () => {
    const update = vi.fn();
    const progress = createSlackProgress({ chat: { update } }, "C1", "progress");
    await progress("read_chart_results", "start", { secret: "private" }, "Read saved chart results");
    expect(update).toHaveBeenCalledExactlyOnceWith({ channel: "C1", ts: "progress", text: "📊 Read saved chart results…",
      blocks: [{ type: "context", elements: [{ type: "plain_text", text: "📊 Read saved chart results…" }] }],
    });
  });

  it("shows readable words when a tool supplies its key as the label", async () => {
    const update = vi.fn();
    const progress = createSlackProgress({ chat: { update } }, "C1", "progress");
    await progress("create_temporary_chart", "start", null, "create_temporary_chart");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ text: "📊 Create temporary chart…" }));
  });

  it("limits edits and skips repeated labels", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(0);
    const update = vi.fn();
    const progress = createSlackProgress({ chat: { update } }, "C1", "progress");
    await progress("read", "start", null, "Read results");
    clock.mockReturnValue(500);
    await progress("capture", "start", null, "Capture dashboard");
    clock.mockReturnValue(2000);
    await progress("read", "start", null, "Read results");
    await progress("capture", "start", null, "Capture dashboard");
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("ignores missing messages, unknown labels, and error details", async () => {
    const update = vi.fn();
    await createSlackProgress({ chat: { update } }, "C1", null)("read", "start", null, "Read results");
    const progress = createSlackProgress({ chat: { update } }, "C1", "progress");
    await progress("internal_tool", "start", { query: "private" });
    await progress("read", "error", { error: "private" }, "Read results");
    expect(update).not.toHaveBeenCalled();
  });

  it("does not block the answer when Slack rejects an update", async () => {
    const progress = createSlackProgress({ chat: { update: vi.fn().mockRejectedValue(new Error("rate limited")) } }, "C1", "progress");
    await expect(progress("read", "start", null, "Read results")).resolves.toBeUndefined();
  });

  it("does not send overlapping progress edits", async () => {
    let complete;
    const update = vi.fn().mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const clock = vi.spyOn(Date, "now").mockReturnValue(0);
    const progress = createSlackProgress({ chat: { update } }, "C1", "progress");
    const pending = progress("read", "start", null, "Read results");
    clock.mockReturnValue(3000);
    await progress("capture", "start", null, "Capture dashboard");
    expect(update).toHaveBeenCalledOnce();
    complete();
    await pending;
  });
});
