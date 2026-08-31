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

export function buildOnboardingCompletion(businessProfile) {
  const completion = { complete: true };
  if (businessProfile) completion.businessProfile = businessProfile;
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
