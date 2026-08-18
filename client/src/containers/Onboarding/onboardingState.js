export function isTeamOwner(team, userId) {
  return Boolean(team?.TeamRoles?.some((role) => (
    role.user_id === userId && role.role === "teamOwner"
  )));
}

export function findOwnedOnboardingTeam(teams, userId, requestedTeamId = null) {
  const ownedTeams = (teams || []).filter((team) => isTeamOwner(team, userId));
  if (requestedTeamId !== null && requestedTeamId !== undefined) {
    return ownedTeams.find((team) => `${team.id}` === `${requestedTeamId}`) || null;
  }
  return ownedTeams.find((team) => !team.onboardingCompletedAt) || null;
}

export function shouldResumeOnboarding(team, userId) {
  return isTeamOwner(team, userId) && !team.onboardingCompletedAt;
}

export function getInitialOnboardingStep(team) {
  return team?.useCases ? 2 : 1;
}

export function getOnboardingEntry(search = "") {
  const searchParams = new URLSearchParams(search);
  return {
    isNewTeam: searchParams.get("new") === "1",
    requestedTeamId: searchParams.get("team"),
    welcome: searchParams.get("welcome") === "1" && searchParams.get("new") !== "1",
  };
}

export function normalizeBusinessWebsite(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return { domain: null, websiteUrl: null };
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed : `https://${trimmed}`);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { domain: null, websiteUrl: trimmed };
    }
    parsed.search = "";
    parsed.hash = "";
    return { domain: parsed.hostname.toLowerCase(), websiteUrl: parsed.toString() };
  } catch (error) {
    return { domain: null, websiteUrl: trimmed };
  }
}

export function buildBusinessProfile({
  businessName, description, logo, metadata, websiteUrl,
}) {
  const profile = {
    ...normalizeBusinessWebsite(websiteUrl),
    businessName: businessName.trim() || null,
    description: description.trim() || null,
    metadata: metadata || {},
  };
  if (logo) profile.logo = logo;
  return profile;
}

export function getBusinessProfileReview(discoveredProfile, fallbackWebsiteUrl = "") {
  if (!discoveredProfile) return null;
  return {
    businessName: discoveredProfile.businessName || "",
    description: discoveredProfile.description || "",
    logo: discoveredProfile.logo || null,
    metadata: discoveredProfile.metadata || {},
    websiteUrl: discoveredProfile.websiteUrl || fallbackWebsiteUrl,
  };
}

export function buildOnboardingCompletion(businessProfile, aiContextAllowed = false) {
  const completion = { complete: true, aiContextAllowed: aiContextAllowed === true };
  if (businessProfile) completion.businessProfile = businessProfile;
  return completion;
}
