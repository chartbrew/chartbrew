const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const db = require("../../models/models");

const LOGO_EXTENSIONS = Object.freeze({
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/x-icon": ".ico",
});

async function getTeamBrandDefaults(teamId, options = {}) {
  const profile = await db.TeamBusinessProfile.findOne({
    attributes: ["logoData", "logoMimeType", "websiteUrl"],
    transaction: options.transaction,
    where: { team_id: teamId },
  });
  if (!profile) return {};

  const defaults = {};
  if (profile.websiteUrl) defaults.logoLink = profile.websiteUrl;
  const extension = LOGO_EXTENSIONS[profile.logoMimeType];
  if (!profile.logoData || !extension) return defaults;

  const logoData = Buffer.from(profile.logoData);
  const fingerprint = crypto.createHash("sha256").update(logoData).digest("hex").slice(0, 20);
  const fileName = `team-logo-${teamId}-${fingerprint}${extension}`;
  const uploadDirectory = options.uploadDirectory
    || path.resolve(__dirname, "../../uploads");
  const uploadPath = path.resolve(uploadDirectory, fileName);
  if (!uploadPath.startsWith(`${path.resolve(uploadDirectory)}${path.sep}`)) return defaults;

  await fs.promises.mkdir(uploadDirectory, { recursive: true });
  try {
    await fs.promises.writeFile(uploadPath, logoData, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  defaults.logo = `uploads/${fileName}`;
  return defaults;
}

async function applyTeamBrandDefaults(data, options = {}) {
  if (!data?.team_id) return data;
  const defaults = await getTeamBrandDefaults(data.team_id, options);
  const brandedData = { ...data };
  if (!brandedData.logo && defaults.logo) brandedData.logo = defaults.logo;
  if (!brandedData.logoLink && defaults.logoLink) brandedData.logoLink = defaults.logoLink;
  return brandedData;
}

async function applyTeamBrandDefaultsToExistingProjects(teamId, options = {}) {
  const defaults = await getTeamBrandDefaults(teamId, options);
  if (defaults.logo) {
    await db.Project.update(
      { logo: defaults.logo },
      { transaction: options.transaction, where: { logo: null, team_id: teamId } }
    );
  }
  if (defaults.logoLink) {
    await db.Project.update(
      { logoLink: defaults.logoLink },
      { transaction: options.transaction, where: { logoLink: null, team_id: teamId } }
    );
  }
  return defaults;
}

module.exports = {
  applyTeamBrandDefaults,
  applyTeamBrandDefaultsToExistingProjects,
  getTeamBrandDefaults,
};
