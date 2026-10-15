import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBusinessProfile,
  buildOnboardingCompletion,
  findOwnedOnboardingTeam,
  getBusinessProfileReview,
  getBusinessLogoFileError,
  getOnboardingEntry,
  getOnboardingLoadingLabel,
  getOnboardingPreferences,
  getOnboardingAiSettings,
  getSuggestedTeamName,
  hasBusinessProfileDetails,
  isTeamOwner,
  normalizeBusinessWebsite,
  shouldResumeOnboarding,
  shouldLoadOnboardingTeam,
  getReportPreparationState,
} from "./onboardingState.js";

const incompleteOwnedTeam = {
  id: 1, onboardingCompletedAt: null,
  TeamRoles: [{ role: "teamOwner", user_id: 10 }],
};
const completedOwnedTeam = {
  id: 2, onboardingCompletedAt: "2026-08-13T00:00:00.000Z",
  TeamRoles: [{ role: "teamOwner", user_id: 10 }],
};
const invitedTeam = {
  id: 3, onboardingCompletedAt: null,
  TeamRoles: [{ role: "projectViewer", user_id: 10 }],
};

test("only an owner resumes incomplete team onboarding", () => {
  assert.equal(isTeamOwner(incompleteOwnedTeam, 10), true);
  assert.equal(shouldResumeOnboarding(incompleteOwnedTeam, 10), true);
  assert.equal(shouldResumeOnboarding(completedOwnedTeam, 10), false);
  assert.equal(shouldResumeOnboarding(invitedTeam, 10), false);
});

test("team selection respects an explicit owned target and ignores invited teams", () => {
  const teams = [completedOwnedTeam, invitedTeam, incompleteOwnedTeam];
  assert.equal(findOwnedOnboardingTeam(teams, 10).id, 1);
  assert.equal(findOwnedOnboardingTeam(teams, 10, 2).id, 2);
  assert.equal(findOwnedOnboardingTeam(teams, 10, 3), null);
});

test("a discovered business name becomes the team name default", () => {
  assert.equal(getSuggestedTeamName({ businessName: " Chartbrew " }, { name: "My team" }), "Chartbrew");
  assert.equal(getSuggestedTeamName(null, { name: " My team " }), "My team");
});

test("business details open the optional profile section", () => {
  assert.equal(hasBusinessProfileDetails(null), false);
  assert.equal(hasBusinessProfileDetails({}), false);
  assert.equal(hasBusinessProfileDetails({ websiteUrl: "https://example.com/" }), true);
});

test("welcome and new-team entries stay separate", () => {
  assert.deepEqual(getOnboardingEntry("?welcome=1"), {
    isNewTeam: false, requestedTeamId: null, welcome: true,
  });
  assert.deepEqual(getOnboardingEntry("?new=1&welcome=1"), {
    isNewTeam: true, requestedTeamId: null, welcome: false,
  });
});

test("business profile input gets a canonical website and reviewed fields", () => {
  assert.deepEqual(normalizeBusinessWebsite("Example.com/path?tracking=1"), {
    domain: "example.com", websiteUrl: "https://example.com/path",
  });
  assert.deepEqual(buildBusinessProfile({
    businessName: " Acme ", description: " Reporting ", logo: null,
    metadata: { language: "en" }, websiteUrl: "acme.example",
  }), {
    businessName: "Acme", description: "Reporting", domain: "acme.example",
    logo: null, metadata: { language: "en" }, websiteUrl: "https://acme.example/",
  });
});

test("a failed discovery stays retryable and a result becomes an editable review", () => {
  assert.equal(getBusinessProfileReview(null, "example.com"), null);
  assert.deepEqual(getBusinessProfileReview({
    businessName: "Discovered name", description: "Discovered description",
  }, "example.com"), {
    businessName: "Discovered name", description: "Discovered description", logo: null,
    metadata: {}, websiteUrl: "example.com",
  });
});

test("skip and reviewed completion payloads do not add a profile consent field", () => {
  assert.deepEqual(buildOnboardingCompletion(null), { complete: true });
  assert.deepEqual(buildOnboardingCompletion({ businessName: "Edited name" }), {
    businessProfile: { businessName: "Edited name" },
    complete: true,
  });
});

test("team logo uploads use safe image types and a small size limit", () => {
  assert.equal(getBusinessLogoFileError({ size: 1024, type: "image/png" }), "");
  assert.equal(
    getBusinessLogoFileError({ size: 1024, type: "image/svg+xml" }),
    "Choose a PNG, JPG, WebP, or ICO image."
  );
  assert.equal(
    getBusinessLogoFileError({ size: 600 * 1024, type: "image/png" }),
    "Choose an image smaller than 512 KB."
  );
});

test("AI choices keep current team values and preserve an explicit opt-out", () => {
  assert.deepEqual(getOnboardingAiSettings(null), { aiEnabled: true, aiSuggestionsEnabled: true });
  assert.deepEqual(getOnboardingAiSettings({ aiEnabled: false, aiSuggestionsEnabled: false }), {
    aiEnabled: false, aiSuggestionsEnabled: false,
  });
  assert.deepEqual(buildOnboardingCompletion(null, { aiEnabled: false, aiSuggestionsEnabled: true }), {
    complete: true, aiEnabled: false, aiSuggestionsEnabled: true,
  });
  assert.deepEqual(buildOnboardingCompletion(null, { aiEnabled: true, aiSuggestionsEnabled: false, ignored: true }), {
    complete: true, aiEnabled: true, aiSuggestionsEnabled: false,
  });
});

test("onboarding reloads a missing or changed team after leaving the new-team URL", () => {
  assert.equal(shouldLoadOnboardingTeam({ isNewTeam: true, requestedTeamId: null, owningTeam: null }), false);
  assert.equal(shouldLoadOnboardingTeam({ isNewTeam: false, requestedTeamId: "104", owningTeam: null }), true);
  assert.equal(shouldLoadOnboardingTeam({ isNewTeam: false, requestedTeamId: "104", owningTeam: { id: 104 } }), false);
  assert.equal(shouldLoadOnboardingTeam({ isNewTeam: false, requestedTeamId: "105", owningTeam: { id: 104 } }), true);
  assert.equal(shouldLoadOnboardingTeam({ isNewTeam: false, requestedTeamId: null, owningTeam: null }), true);
  assert.equal(shouldLoadOnboardingTeam({ isNewTeam: false, requestedTeamId: null, owningTeam: { id: 104 } }), false);
});

test("report preparation waits for a matching result and detects unavailable reports", () => {
  const website = "https://notocat.com/";
  assert.equal(getReportPreparationState({ starterSuggestionsPending: true }, website), "pending");
  assert.equal(getReportPreparationState({ reportPreview: { websiteUrl: website } }, website), "ready");
  assert.equal(getReportPreparationState({ reportPreview: { websiteUrl: "https://other.example/" }, starterSuggestionsPending: true }, website), "pending");
  assert.equal(getReportPreparationState({ starterSuggestionsPending: false }, website), "failed");
});

test("preferences use the first dashboard without changing branding", () => {
  const team = {
    showBranding: false,
    Projects: [
      { id: 3, timezone: "Europe/Paris" },
      { id: 1, ghost: true, timezone: "UTC" },
      { id: 2, timezone: "Asia/Bangkok" },
    ],
  };
  assert.deepEqual(getOnboardingPreferences(team), {
    timezone: "Asia/Bangkok",
  });
  assert.deepEqual(team.Projects.map((project) => project.id), [3, 1, 2]);
  assert.deepEqual(getOnboardingPreferences(null), {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
});

test("loading text follows each phase and stays on a waiting message", () => {
  assert.equal(getOnboardingLoadingLabel(false, 0), "Reading your website");
  assert.equal(getOnboardingLoadingLabel(false, 8), "Finding your business details");
  assert.equal(getOnboardingLoadingLabel(true, 0), "Finding metrics for your business");
  assert.equal(getOnboardingLoadingLabel(true, 8), "Choosing charts for your report");
  assert.equal(getOnboardingLoadingLabel(true, 16), "Bringing your report together");
  assert.equal(getOnboardingLoadingLabel(true, 120), "Still preparing your report. Thanks for waiting.");
});

test("manual website fallback keeps the address and leaves business details editable", () => {
  assert.deepEqual(getBusinessProfileReview({}, "example.com"), {
    businessName: "", description: "", logo: null, metadata: {}, websiteUrl: "example.com",
  });
});
