const fs = require("node:fs");
const path = require("node:path");

const manifest = require("../../shared/geo/manifest.json");
const { getFieldValue } = require("./fieldPath");

const maps = new Map();

function normalizeLocation(value) {
  return `${value ?? ""}`.normalize("NFKD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function getMap(area = "world") {
  if (maps.has(area)) return maps.get(area);
  const definition = manifest.maps.find((item) => item.id === area);
  if (!definition) throw new Error("Select an available map area.");
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, "../../shared/geo/maps", `${definition.file}.json`), "utf8"));
  const features = definition.continent
    ? source.features.filter((item) => item.properties.continent === definition.continent)
    : source.features;
  const names = new Map();
  const aliases = new Map();
  const included = new Set(features.map((item) => item.properties.code));
  // Resolve against all countries so a continent filter can exclude known places.
  for (const { properties } of source.features) {
    names.set(properties.code, properties.name);
    [properties.code, ...properties.aliases].forEach((alias) => {
      const key = normalizeLocation(alias);
      if (!key) return;
      if (aliases.has(key) && aliases.get(key) !== properties.code) aliases.set(key, null);
      else if (!aliases.has(key)) aliases.set(key, properties.code);
    });
  }
  // Exact region codes take precedence over ambiguous names or short aliases.
  for (const { properties } of source.features) {
    aliases.set(normalizeLocation(properties.code), properties.code);
  }
  const map = { definition, geoJSON: { type: "FeatureCollection", features }, names, aliases, included };
  maps.set(area, map);
  return map;
}

function coordinate(value, limit) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function projectMapRows(rows, layer) {
  const map = getMap(layer.options?.map?.area);
  const points = layer.options?.map?.mode === "points";
  const encoding = layer.encoding;
  const projected = [];
  let invalid = 0;
  let outside = 0;
  const unmatched = new Set();
  rows.forEach((row) => {
    const item = {};
    if (points) {
      let latitude;
      let longitude;
      if (encoding.point) {
        const point = getFieldValue(row, encoding.point.field);
        const geometry = point?.type === "Feature" ? point.geometry : point;
        if (geometry?.type === "Point" && Array.isArray(geometry.coordinates)) {
          [longitude, latitude] = geometry.coordinates;
        }
      } else {
        latitude = encoding.latitude && getFieldValue(row, encoding.latitude.field);
        longitude = encoding.longitude && getFieldValue(row, encoding.longitude.field);
      }
      item.latitude = coordinate(latitude, 90);
      item.longitude = coordinate(longitude, 180);
      if (item.latitude === null || item.longitude === null) {
        invalid += 1;
        return;
      }
      if (encoding.location) item.location = `${getFieldValue(row, encoding.location.field) ?? ""}`;
    } else {
      const rawLocation = encoding.location && getFieldValue(row, encoding.location.field);
      const key = normalizeLocation(rawLocation);
      const code = map.aliases.get(key);
      if (!code) {
        invalid += 1;
        if (unmatched.size < 5) unmatched.add(`${rawLocation ?? "(empty)"}`.slice(0, 80));
        return;
      }
      if (!map.included.has(code)) {
        outside += 1;
        return;
      }
      item.location = code;
    }
    item.value = encoding.value ? getFieldValue(row, encoding.value.field) : 1;
    projected.push(item);
  });
  const warnings = [];
  if (invalid) warnings.push({
    code: points ? "INVALID_MAP_COORDINATES" : "UNMATCHED_MAP_LOCATIONS",
    count: invalid,
    message: points
      ? `${invalid} rows have missing or invalid coordinates. Select both coordinates in decimal degrees, or a GeoJSON Point field.`
      : `${invalid} rows have locations that could not be matched: ${[...unmatched].join(", ")}. Check the location field and map area.`,
  });
  if (outside) warnings.push({
    code: "MAP_LOCATIONS_OUTSIDE_AREA",
    count: outside,
    message: `${outside} rows are outside this map area. Select World to show all countries.`,
  });
  return {
    projected,
    dimensionRoles: points ? ["latitude", "longitude", ...(encoding.location ? ["location"] : [])] : ["location"],
    measureEncodings: { value: encoding.value || { aggregate: "sum" } },
    warnings,
  };
}

module.exports = { getMap, normalizeLocation, projectMapRows };
