import presetManifest from "../../../shared/visualization/presetManifest.json";
import presetImplementations from "./presetImplementations.json";

export const PRESET_MANIFEST = Object.freeze(presetManifest);
export const CLIENT_PRESET_IMPLEMENTATIONS = Object.freeze(presetImplementations);

export function getPresetDefinition(presetId) {
  return PRESET_MANIFEST.presets.find((preset) => preset.id === presetId) || null;
}

export function getClientPresetImplementation(presetId) {
  return CLIENT_PRESET_IMPLEMENTATIONS[presetId] || null;
}

export function isReadyPreset(presetId) {
  return getPresetDefinition(presetId)?.releaseState === "ready"
    && Boolean(getClientPresetImplementation(presetId));
}
