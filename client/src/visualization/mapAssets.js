import manifest from "../../../shared/geo/manifest.json";

const assets = import.meta.glob("../../../shared/geo/maps/*.json", { import: "default" });

export async function registerOptionMap(echarts, option) {
  const area = option.geo?.map || option.series?.find((series) => series.type === "map")?.map;
  if (!area || echarts.getMap(area)) return;
  const definition = manifest.maps.find((map) => map.id === area);
  if (!definition) throw new Error("This map is unavailable. Select another map area.");
  const geoJSON = await assets[`../../../shared/geo/maps/${definition.file}.json`]();
  echarts.registerMap(area, definition.continent ? {
    type: "FeatureCollection",
    features: geoJSON.features.filter((feature) => feature.properties.continent === definition.continent),
  } : geoJSON);
}
