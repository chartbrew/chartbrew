const fs = require("node:fs/promises");
const path = require("node:path");

const VERSION = "v5.1.2";
const SOURCE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${VERSION}/geojson`;
const OUTPUT = path.resolve(__dirname, "../../shared/geo");
const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania", "Antarctica"];

function visitPositions(coordinates, visit) {
  if (typeof coordinates[0] === "number") return visit(coordinates);
  return coordinates.map((item) => visitPositions(item, visit));
}

function wrapCountry(features) {
  let min = 180;
  let max = -180;
  let total = 0;
  features.forEach(({ geometry }) => visitPositions(geometry.coordinates, (position) => {
    min = Math.min(min, position[0]);
    max = Math.max(max, position[0]);
    total += position[0];
    return position;
  }));
  if (max - min < 300) return null;
  const wrap = total < 0 ? "west" : "east";
  features.forEach((item) => {
    item.geometry = {
      ...item.geometry,
      coordinates: visitPositions(item.geometry.coordinates, ([longitude, latitude]) => {
        if (wrap === "west" && longitude > 0) return [longitude - 360, latitude];
        if (wrap === "east" && longitude < 0) return [longitude + 360, latitude];
        return [longitude, latitude];
      }),
    };
  });
  return wrap;
}

function aliases(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value && value !== "-99")
    .flatMap((value) => value.split("|")))];
}

function feature(geometry, properties) {
  return { type: "Feature", properties, geometry };
}

async function readSource(filename, sourceDirectory) {
  if (sourceDirectory) return JSON.parse(await fs.readFile(path.join(sourceDirectory, filename), "utf8"));
  const response = await fetch(`${SOURCE}/${filename}`);
  if (!response.ok) throw new Error(`Map download failed: ${filename} (${response.status})`);
  return response.json();
}

async function importMaps(sourceDirectory) {
  const countries = await readSource("ne_50m_admin_0_countries.geojson", sourceDirectory);
  const subdivisions = await readSource("ne_10m_admin_1_states_provinces.geojson", sourceDirectory);
  const countryCodes = new Map();
  const world = countries.features.map(({ geometry, properties: p }) => {
    const code = [p.ISO_A2, p.ISO_A2_EH].find((value) => /^[A-Z]{2}$/.test(value))
      || ({ KOS: "XK" })[p.ADM0_A3] || p.ADM0_A3;
    countryCodes.set(p.ADM0_A3, code);
    return feature(geometry, {
      code,
      name: p.NAME_LONG || p.NAME,
      continent: p.CONTINENT,
      aliases: aliases([code, p.ISO_A3, p.ISO_A3_EH, p.ADMIN, p.NAME, p.NAME_LONG,
        p.NAME_EN, p.FORMAL_EN, p.NAME_ALT, ...(code === "GB" ? ["UK", "Great Britain"] : [])]),
    });
  });
  const groups = new Map();
  subdivisions.features.forEach(({ geometry, properties: p }) => {
    const country = countryCodes.get(p.adm0_a3) || p.iso_a2;
    if (!/^[A-Z]{2,3}$/.test(country)) return;
    if (!groups.has(country)) groups.set(country, { name: p.admin, features: [] });
    const code = p.iso_3166_2 && p.iso_3166_2 !== "-99" ? p.iso_3166_2 : p.adm1_code;
    groups.get(country).features.push(feature(geometry, {
      code,
      name: p.name_en || p.name || code,
      aliases: aliases([code, p.name, p.name_en, p.name_local, p.name_alt, p.postal, p.code_hasc]),
    }));
  });

  await fs.mkdir(path.join(OUTPUT, "maps"), { recursive: true });
  const writeMap = async (id, features) => {
    await fs.writeFile(path.join(OUTPUT, "maps", `${id}.json`), JSON.stringify({ type: "FeatureCollection", features }));
  };
  await writeMap("world", world);
  const maps = [{ id: "world", name: "World", file: "world" }, ...CONTINENTS.map((name) => ({
    id: name.toLowerCase().replaceAll(" ", "-"), name, file: "world", continent: name,
  }))];
  const countryMaps = [...groups].sort((a, b) => a[1].name.localeCompare(b[1].name));
  countryMaps.forEach(([, group]) => { group.wrap = wrapCountry(group.features); });
  await Promise.all(countryMaps.map(([country, group]) => writeMap(country, group.features)));
  countryMaps.forEach(([country, group]) => {
    maps.push({ id: country, name: group.name, file: country, country,
      ...(group.wrap ? { wrap: group.wrap } : {}),
      regions: new Set(group.features.map((f) => f.properties.code)).size });
  });
  await fs.writeFile(path.join(OUTPUT, "manifest.json"), `${JSON.stringify({ source: "Natural Earth", version: VERSION, maps }, null, 2)}\n`);
  process.stdout.write(`Imported the world map and ${groups.size} country maps from Natural Earth ${VERSION}.\n`);
}

const sourceIndex = process.argv.indexOf("--source-dir");
importMaps(sourceIndex >= 0 ? process.argv[sourceIndex + 1] : null).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
