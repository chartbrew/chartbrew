import { beforeAll, describe, expect, it } from "vitest";

import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const { buildContextManifest } = require("../../modules/workspaceContext/contextManifest");
const {
  readWorkspaceContext,
} = require("../../modules/workspaceContext/workspaceContextService");
const {
  createFactStore,
  normalizeToolResult,
} = require("../../modules/ai/orchestrator/runtime/factNormalizer");

describe("business profile AI context", () => {
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    models = await getModels();
  });

  it("excludes the profile until the owner allows AI context", async () => {
    const team = await models.Team.create({ name: "Acme", useCases: "internal" });
    const profile = await models.TeamBusinessProfile.create({
      aiContextAllowed: false,
      businessName: "Acme Analytics",
      description: "Reporting for growing companies",
      domain: "acme.example",
      logoData: Buffer.from("not sent"),
      metadata: { industry: "Analytics", language: "en" },
      team_id: team.id,
    });
    const access = { teamId: team.id };
    const envelope = {
      canUseExternalWorkspaceContext: true,
      workspaceOrchestratorEnabled: true,
    };

    const denied = await readWorkspaceContext(access, envelope, {
      externalProvider: true,
      sections: ["business_profile"],
    });
    expect(denied).not.toHaveProperty("business_profile");
    expect(denied.coverage.businessProfileUnavailable).toBe(true);

    await profile.update({ aiContextAllowed: true });
    const approved = await readWorkspaceContext(access, envelope, {
      externalProvider: true,
      sections: ["business_profile"],
    });
    expect(approved.business_profile).toEqual({
      businessName: "Acme Analytics",
      description: "Reporting for growing companies",
      domain: "acme.example",
      metadata: { industry: "Analytics", language: "en" },
      useCases: "internal",
    });
    expect(JSON.stringify(approved)).not.toContain("not sent");

    const store = createFactStore();
    const normalized = normalizeToolResult("get_workspace_context", approved, store);
    expect(normalized.facts).toEqual([
      expect.objectContaining({ factType: "business_profile", state: "approved" }),
    ]);

    const manifest = buildContextManifest({
      context: approved,
      externalProviderUsed: true,
      purpose: "ask_data",
    });
    expect(manifest.contextSections).toContain("business_profile");
    expect(manifest.factCounts.businessProfiles).toBe(1);

    const platformDenied = await readWorkspaceContext(access, {
      canUseExternalWorkspaceContext: false,
      workspaceOrchestratorEnabled: true,
    }, {
      externalProvider: true,
      sections: ["business_profile"],
    });
    expect(platformDenied).not.toHaveProperty("business_profile");

    await profile.update({ aiContextAllowed: false });
    const revoked = await readWorkspaceContext(access, envelope, {
      externalProvider: true,
      sections: ["business_profile"],
    });
    expect(revoked).not.toHaveProperty("business_profile");
  });
});
