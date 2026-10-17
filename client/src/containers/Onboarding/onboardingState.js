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

export function getSuggestedTeamName(businessProfile, team) {
  return String(businessProfile?.businessName || team?.name || "").trim();
}

export function hasBusinessProfileDetails(businessProfile) {
  return Boolean(
    businessProfile?.businessName
    || businessProfile?.description
    || businessProfile?.logo
    || businessProfile?.websiteUrl
  );
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
  if (logo !== undefined) profile.logo = logo;
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

export function getOnboardingAiSettings(team) {
  return {
    aiEnabled: team?.aiEnabled !== false,
    aiSuggestionsEnabled: team?.aiSuggestionsEnabled !== false,
  };
}

export function buildOnboardingCompletion(businessProfile, aiSettings) {
  const completion = { complete: true };
  if (businessProfile) completion.businessProfile = businessProfile;
  if (aiSettings) Object.assign(completion, getOnboardingAiSettings(aiSettings));
  return completion;
}

export const MAX_BUSINESS_LOGO_BYTES = 512 * 1024;

const BUSINESS_LOGO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/vnd.microsoft.icon",
  "image/webp",
  "image/x-icon",
]);

export function getBusinessLogoFileError(file) {
  if (!file || !BUSINESS_LOGO_MIME_TYPES.has(String(file.type || "").toLowerCase())) {
    return "Choose a PNG, JPG, WebP, or ICO image.";
  }
  if (!file.size || file.size > MAX_BUSINESS_LOGO_BYTES) {
    return "Choose an image smaller than 512 KB.";
  }
  return "";
}

export function shouldLoadOnboardingTeam({ isNewTeam, requestedTeamId, owningTeam }) {
  if (isNewTeam) return false;
  return !owningTeam?.id || (requestedTeamId !== null && requestedTeamId !== undefined
    && String(owningTeam.id) !== String(requestedTeamId));
}

export function getReportPreparationState(home, websiteUrl) {
  if (home.reportPreview?.websiteUrl === websiteUrl) return "ready";
  return (home.reportPreviewPending ?? home.starterSuggestionsPending) ? "pending" : "failed";
}

export function getOnboardingPreferences(team) {
  const project = team?.Projects?.filter((item) => !item.ghost)
    .sort((a, b) => a.id - b.id)[0];
  return {
    timezone: project?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}

export function getOnboardingLoadingLabel(isPreparingReport, seconds) {
  const messages = isPreparingReport
    ? ["Gathering business context", "Learning about your business", "Getting things ready", "Still gathering context. Thanks for waiting."]
    : ["Reading your website", "Finding your business details", "Still reading your website. Thanks for waiting."];
  return messages[Math.min(Math.floor(seconds / 8), messages.length - 1)];
}

export function watchOnboardingReport({ loadHome, websiteUrl, onPreview, onContinue }) {
  let active = true;
  let timer;
  let continued = false;
  const continueSetup = () => {
    if (!active || continued) return;
    continued = true;
    onContinue();
  };
  const deadline = setTimeout(continueSetup, 30000);
  const poll = async () => {
    try {
      const home = await loadHome();
      if (!active) return;
      const state = getReportPreparationState(home, websiteUrl);
      if (state !== "pending") {
        clearTimeout(deadline);
        if (state === "ready") onPreview(home.reportPreview);
        continueSetup();
        active = false;
        return;
      }
    } catch (error) {
      // Keep checking after temporary connection failures.
    }
    if (active) timer = setTimeout(poll, 2000);
  };
  poll();
  return () => {
    active = false;
    clearTimeout(timer);
    clearTimeout(deadline);
  };
}
