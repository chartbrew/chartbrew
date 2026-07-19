import {
  describe, expect, it,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  getEnabledSnapshotIntegrations,
  getSnapshotEmailRecipients,
  hasSnapshotChannels,
} = require("../../modules/snapshotChannels.js");

describe("snapshot channels", () => {
  it("handles a null schedule", () => {
    expect(getSnapshotEmailRecipients(null)).toEqual([]);
    expect(getEnabledSnapshotIntegrations(null)).toEqual([]);
    expect(hasSnapshotChannels(null)).toBe(false);
  });

  it("requires at least one non-blank recipient for email", () => {
    const schedule = {
      mediums: { email: { enabled: true } },
      customEmails: ["", "  "],
    };

    expect(getSnapshotEmailRecipients(schedule)).toEqual([]);
    expect(hasSnapshotChannels(schedule)).toBe(false);
  });

  it("normalizes email recipients", () => {
    const schedule = {
      mediums: { email: { enabled: true } },
      customEmails: [" user@example.com ", ""],
    };

    expect(getSnapshotEmailRecipients(schedule)).toEqual(["user@example.com"]);
    expect(hasSnapshotChannels(schedule)).toBe(true);
  });

  it("ignores recipients when email delivery is disabled", () => {
    const schedule = {
      mediums: { email: { enabled: false } },
      customEmails: ["user@example.com"],
    };

    expect(getSnapshotEmailRecipients(schedule)).toEqual([]);
    expect(hasSnapshotChannels(schedule)).toBe(false);
  });

  it("only includes enabled integrations", () => {
    const schedule = {
      integrations: [
        { integration_id: 1, enabled: false },
        { integration_id: 2, enabled: true },
      ],
    };

    expect(getEnabledSnapshotIntegrations(schedule)).toEqual([
      { integration_id: 2, enabled: true },
    ]);
    expect(hasSnapshotChannels(schedule)).toBe(true);
  });
});
