import presetManifest from "../../../shared/visualization/presetManifest.json" with { type: "json" };
import presetImplementations from "./presetImplementations.json" with { type: "json" };

export const PRESET_MANIFEST = Object.freeze(presetManifest);
export const CLIENT_PRESET_IMPLEMENTATIONS = Object.freeze(presetImplementations);

export function getPresetDefinition(presetId) {
  return PRESET_MANIFEST.presets.find((preset) => preset.id === presetId) || null;
}

export function getClientPresetImplementation(presetId) {
  return CLIENT_PRESET_IMPLEMENTATIONS[presetId] || null;
}

export function hasPresetCapability(presetId, capability) {
  return Boolean(getPresetDefinition(presetId)?.capabilities?.includes(capability));
}

export function hasDatasetEditorTab(presetId, tabId) {
  if (tabId === "display") return presetId !== "gauge";
  return ["automation", "data-setup"].includes(tabId);
}

export function isReadyPreset(presetId) {
  return getPresetDefinition(presetId)?.releaseState === "ready"
    && Boolean(getClientPresetImplementation(presetId));
}
