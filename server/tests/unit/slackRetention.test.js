import { afterEach, expect, it, vi } from "vitest";
const db = require("../../models/models");
const { cleanupSlackData } = require("../../apps/slack/retention");
afterEach(() => vi.restoreAllMocks());

it("reports expired Slack data without deleting during a dry run", async () => {
  vi.spyOn(db.SlackRequest, "count").mockResolvedValue(2);
  vi.spyOn(db.SlackLinkToken, "count").mockResolvedValue(1);
  const requests = vi.spyOn(db.SlackRequest, "destroy").mockResolvedValue(2);
  const tokens = vi.spyOn(db.SlackLinkToken, "destroy").mockResolvedValue(1);
  expect(await cleanupSlackData({ dryRun: true })).toEqual({ dryRun: true, requests: 0, linkTokens: 1 });
  expect(requests).not.toHaveBeenCalled();
  expect(tokens).not.toHaveBeenCalled();
  await cleanupSlackData();
  expect(requests).not.toHaveBeenCalled();
  expect(tokens).toHaveBeenCalledOnce();
});
