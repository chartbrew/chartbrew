import assert from "node:assert/strict";
import test from "node:test";

import { canSubmitAiMessage, getAiDisabledGuidance } from "./aiAvailability.js";
import {
  AI_DATA_DISCLOSURE,
  TEAM_AI_TOOLTIP,
  getAiEnablementCopy,
} from "./aiEnablementCopy.js";

test("a team admin gets a direct Team settings action", () => {
  const guidance = getAiDisabledGuidance(
    { disabledBy: "team", enabled: false },
    { canManageTeam: true }
  );
  assert.equal(guidance.settingsPath, "/settings/team?enableAi=team");
  assert.equal(guidance.actionLabel, "Open team settings");
});

test("a team member gets guidance without an inaccessible action", () => {
  const guidance = getAiDisabledGuidance(
    { disabledBy: "team", enabled: false },
    { canManageTeam: false }
  );
  assert.equal(guidance.settingsPath, null);
  assert.match(guidance.message, /Contact a team owner or admin/);
});

test("a platform admin gets the platform settings action", () => {
  const guidance = getAiDisabledGuidance(
    { disabledBy: "platform", enabled: false },
    { canManagePlatform: true }
  );
  assert.equal(guidance.settingsPath, "/settings/platform?enableAi=platform");
});

test("a regular user is told to contact a platform administrator", () => {
  const guidance = getAiDisabledGuidance(
    { disabledBy: "platform", enabled: false },
    { canManagePlatform: false }
  );
  assert.equal(guidance.settingsPath, null);
  assert.match(guidance.message, /Contact a platform administrator/);
});

test("the enablement copy explains capabilities and external processing", () => {
  const teamCopy = getAiEnablementCopy("team");
  assert.match(teamCopy.message, /explore metrics/);
  assert.match(teamCopy.message, /create charts/);
  assert.match(AI_DATA_DISCLOSURE.details, /external AI services/);
  assert.doesNotMatch(AI_DATA_DISCLOSURE.details, /OpenAI/);
  assert.match(AI_DATA_DISCLOSURE.permissions, /Team and project permissions/);
  assert.match(TEAM_AI_TOOLTIP, /external AI services/);
});

test("AI messages are accepted only after access is confirmed", () => {
  assert.equal(canSubmitAiMessage(null), false);
  assert.equal(canSubmitAiMessage({ enabled: false }), false);
  assert.equal(canSubmitAiMessage({ enabled: true }), true);
});
