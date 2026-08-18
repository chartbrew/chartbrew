import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBusinessProfile,
  buildOnboardingCompletion,
  findOwnedOnboardingTeam,
  getBusinessProfileReview,
  getInitialOnboardingStep,
  getOnboardingEntry,
  isTeamOwner,
  normalizeBusinessWebsite,
  shouldResumeOnboarding,
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

test("saved use cases resume at the business profile step", () => {
  assert.equal(getInitialOnboardingStep(incompleteOwnedTeam), 1);
  assert.equal(getInitialOnboardingStep({ ...incompleteOwnedTeam, useCases: "internal" }), 2);
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
    metadata: { language: "en" }, websiteUrl: "https://acme.example/",
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

test("skip and reviewed completion payloads keep AI consent off by default", () => {
  assert.deepEqual(buildOnboardingCompletion(null), {
    aiContextAllowed: false, complete: true,
  });
  assert.deepEqual(buildOnboardingCompletion({ businessName: "Edited name" }, true), {
    aiContextAllowed: true,
    businessProfile: { businessName: "Edited name" },
    complete: true,
  });
});
