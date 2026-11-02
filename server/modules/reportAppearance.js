const db = require("../models/models");
const { validateReportAppearance } = require("../../shared/reportAppearance.mjs");

function appearanceError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function validatePayload(data, fields) {
  if (!data || typeof data !== "object" || Array.isArray(data)
    || Buffer.byteLength(JSON.stringify(data)) > 16384
    || Object.keys(data).some((key) => !fields.includes(key))) {
    throw appearanceError(400, "The theme could not be saved. Check the supplied fields.");
  }
  if (fields.includes("revision") && (!Number.isSafeInteger(data.revision) || data.revision < 0)) {
    throw appearanceError(400, "Reload the saved theme before making changes.");
  }
}

function appearance(value) {
  try {
    return validateReportAppearance(value);
  } catch (error) {
    throw appearanceError(400, error.message);
  }
}

function presetName(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80) {
    throw appearanceError(400, "Enter a preset name with 1 to 80 characters.");
  }
  return value.trim();
}

async function saveReportAppearance(projectId, data) {
  validatePayload(data, ["appearance", "revision"]);
  const reportAppearance = appearance(data.appearance);
  const [updated] = await db.Project.update({
    reportAppearance,
    reportAppearanceRevision: data.revision + 1,
  }, { where: { id: projectId, reportAppearanceRevision: data.revision } });
  if (!updated) throw appearanceError(409, "This report changed. Reload its appearance before saving.");
  return { reportAppearance, reportAppearanceRevision: data.revision + 1 };
}

async function createPreset(teamId, userId, data) {
  validatePayload(data, ["name", "appearance"]);
  return db.ReportThemePreset.create({
    team_id: teamId, created_by: userId, name: presetName(data.name), appearance: appearance(data.appearance),
  });
}

async function changePreset(preset, data, remove = false) {
  validatePayload(data, remove ? ["revision"] : ["name", "appearance", "revision"]);
  const where = { id: preset.id, team_id: preset.team_id, revision: data.revision };
  if (remove) {
    if (!await db.ReportThemePreset.destroy({ where })) {
      throw appearanceError(409, "This preset changed. Reload presets before deleting it.");
    }
    return { deleted: true };
  }
  const fields = { revision: data.revision + 1 };
  if (Object.hasOwn(data, "name")) fields.name = presetName(data.name);
  if (Object.hasOwn(data, "appearance")) fields.appearance = appearance(data.appearance);
  if (Object.keys(fields).length === 1) throw appearanceError(400, "Supply a name or colors to update.");
  const [updated] = await db.ReportThemePreset.update(fields, { where });
  if (!updated) throw appearanceError(409, "This preset changed. Reload presets before saving.");
  return { ...preset.toJSON(), ...fields };
}

module.exports = { appearanceError, saveReportAppearance, createPreset, changePreset };
