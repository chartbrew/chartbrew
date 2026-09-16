import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine");
const { getMap } = require("../../visualization/geo");
const { assertVisualizationSpec } = require("../../visualization/spec");
const { renderEChartsSvg } = require("../../visualization/image/renderEChartsSvg");
const { resolveImageTheme } = require("../../visualization/image/imageTheme");
const manifest = require("../../../shared/geo/manifest.json");
const echarts = require("echarts");

function engine(data, encoding, map = {}) {
  return new VisualizationEngine({
    chart: {
      id: 1, type: "map", name: "Locations",
      visualization: {
        version: 2, status: "ready",
        layers: [{ id: "map", bindingId: 1, mark: "map", encoding, options: { map } }],
      },
    },
    datasets: [{ bindingId: 1, data }],
  });
}

const regions = { location: { field: "root[].location.country" }, value: { field: "root[].amount", aggregate: "sum" } };
const points = { latitude: { field: "root[].location.lat" }, longitude: { field: "root[].location.lon" }, value: { field: "root[].amount", aggregate: "sum" } };

function image(result, theme = "light") {
  return renderEChartsSvg({
    chart: { type: "map" }, colors: resolveImageTheme({ theme }),
    height: 360, width: 640,
    preparedData: result.preparedData, visualization: result.visualization,
  });
}

describe("map data and rendering", () => {
  it("moves the legend to the right on wide maps and restores it below on resize", () => {
    echarts.registerMap("world", getMap("world").geoJSON);
    for (const mode of ["regions", "points"]) {
      const chartEngine = engine([{ location: { country: "US", lat: 10, lon: 20 }, amount: 5 }], mode === "points" ? points : regions, { mode });
      const instance = echarts.init(null, null, { renderer: "svg", ssr: true, width: 1000, height: 400 });
      try {
        instance.setOption(chartEngine.render().configuration);
        expect(instance.getOption().visualMap[0].orient).toBe("vertical");
        expect((instance.getOption().geo?.[0] || instance.getOption().series[0]).bottom).toBe(8);
        instance.resize({ width: 320, height: 400 });
        expect(instance.getOption().visualMap[0].orient).toBe("horizontal");
        expect((instance.getOption().geo?.[0] || instance.getOption().series[0]).right).toBe(8);
        instance.resize({ width: 1000, height: 400 });
        expect(instance.getOption().visualMap[0].orient).toBe("vertical");
        expect(instance.renderToSVGString().includes("NaN")).toBe(false);
        chartEngine.chart.visualization.settings = { legend: { visible: false } };
        instance.setOption(chartEngine.render().configuration, { notMerge: true });
        expect(instance.getOption().visualMap[0].show).toBe(false);
        expect((instance.getOption().geo?.[0] || instance.getOption().series[0]).right).toBe(8);
      } finally {
        instance.dispose();
      }
    }
  });

  it("applies map colors and legend visibility in region, point and SVG output", () => {
    for (const mode of ["regions", "points"]) {
      const chartEngine = engine([{ location: { country: "US", lat: 10, lon: 20 }, amount: 5 }], mode === "points" ? points : regions, { mode });
      chartEngine.chart.visualization.layers[0].style = { color: "#ff0000", fillColor: "#ffff00" };
      chartEngine.chart.displayLegend = false;
      const hidden = chartEngine.render();
      expect(hidden.configuration.visualMap.show).toBe(false);
      expect(hidden.configuration.visualMap.inRange.color).toEqual(mode === "points" ? ["#ff0000", "#ff0000"] : ["#ffff00", "#ff0000"]);
      expect((hidden.configuration.geo || hidden.configuration.series[0]).bottom).toBe(8);
      chartEngine.chart.visualization.settings = { legend: { visible: true } };
      expect(chartEngine.render().configuration.visualMap.show).toBe(true);
      chartEngine.chart.visualization.settings.legend.visible = false;
      const result = chartEngine.render();
      expect(result.configuration.visualMap.show).toBe(false);
      const svg = image(result);
      expect(svg.includes('fill="rgb(255,0,0)"')).toBe(true);
      expect(svg.includes("<linearGradient")).toBe(false);
    }
  });

  it("keeps small points visible with the same color and opacity as large points", () => {
    echarts.registerMap("world", getMap("world").geoJSON);
    const instance = echarts.init(null, null, { renderer: "svg", ssr: true, width: 800, height: 400 });
    try {
      instance.setOption(engine([
        { location: { lat: 10, lon: 20 }, amount: 1 },
        { location: { lat: 30, lon: 40 }, amount: 1000 },
      ], points, { mode: "points" }).render().configuration);
      const data = instance.getModel().getSeriesByIndex(0).getData();
      expect(data.getItemVisual(0, "style")).toEqual(data.getItemVisual(1, "style"));
      expect(data.getItemVisual(0, "symbolSize")).toBeGreaterThanOrEqual(6);
      expect(data.getItemVisual(0, "symbolSize")).toBeLessThan(data.getItemVisual(1, "symbolSize"));
    } finally {
      instance.dispose();
    }
  });

  it("matches nested names and codes before aggregation, preserves zero and distinguishes no data", () => {
    const result = engine([
      { location: { country: "US" }, amount: 2 },
      { location: { country: "USA" }, amount: 3 },
      { location: { country: "United States" }, amount: 4 },
      { location: { country: "RO" }, amount: 0 },
      { location: { country: "Unknown place" }, amount: 9 },
    ], regions).render();
    expect(result.preparedData.results[0].rows).toEqual([
      expect.objectContaining({ location: "US", value: 9 }),
      expect.objectContaining({ location: "RO", value: 0 }),
    ]);
    expect(result.configuration.series[0].data).toContainEqual(expect.objectContaining({ name: "CA", value: null, formattedValue: "No data" }));
    expect(result.metadata.warnings).toContainEqual(expect.objectContaining({ code: "UNMATCHED_MAP_LOCATIONS", count: 1 }));
    expect(result.tabularData.Locations).toContainEqual({ Location: "United States", Value: 9 });
    expect(image(result)).toContain("<svg");
  });

  it("keeps coordinate pairs separate and rejects missing, boolean and out-of-range coordinates", () => {
    const result = engine([
      { location: { lat: 10, lon: 20 }, amount: 2 },
      { location: { lat: 30, lon: 40 }, amount: 3 },
      { location: { lat: 10, lon: 20 }, amount: 4 },
      { location: { lat: "0", lon: "0" }, amount: 0 },
      { location: { lat: "", lon: 0 }, amount: 7 },
      { location: { lat: false, lon: 0 }, amount: 7 },
      { location: { lat: 91, lon: 0 }, amount: 7 },
    ], points, { mode: "points" }).render();
    expect(result.configuration.series[0].data.map((row) => row.value)).toEqual([[20, 10, 6], [40, 30, 3], [0, 0, 0]]);
    expect(result.metadata.warnings).toContainEqual(expect.objectContaining({ code: "INVALID_MAP_COORDINATES", count: 3 }));
    expect(image(result, "dark")).toContain("<svg");
  });

  it("reads nested GeoJSON points and features from an API response, with row counts by default", () => {
    const result = engine({ payload: { rows: [
      { location: { geo_data: { type: "Point", coordinates: [26.1025, 44.4268] } } },
      { location: { geo_data: { type: "Feature", geometry: { type: "Point", coordinates: [26.1025, 44.4268] } } } },
      { location: { geo_data: { type: "Polygon", coordinates: [] } } },
    ] } }, { point: { field: "root.payload.rows[].location.geo_data", type: "record" } }, { mode: "points" }).render();
    expect(result.configuration.series[0].data[0].value).toEqual([26.1025, 44.4268, 2]);
    expect(result.configuration.series[0].name).toBe("Count");
    expect(result.preparedData.results[0].fields.map((field) => field.key)).toEqual(["latitude", "longitude", "value"]);
    expect(result.metadata.warnings[0].count).toBe(1);
  });

  it("matches country subdivisions and filters countries outside a continent", () => {
    const states = engine([{ location: { country: "CA" }, amount: 5 }, { location: { country: "US-CA" }, amount: 3 }], regions, { area: "US" }).render();
    expect(states.preparedData.results[0].rows[0]).toMatchObject({ location: "US-CA", value: 8 });
    const europe = engine([{ location: { country: "RO" }, amount: 2 }, { location: { country: "US" }, amount: 3 }], regions, { area: "europe" }).render();
    expect(europe.preparedData.results[0].rows).toHaveLength(1);
    expect(europe.metadata.warnings[0].code).toBe("MAP_LOCATIONS_OUTSIDE_AREA");
  });

  it("wraps date-line point positions for rendering without changing exported coordinates", () => {
    const result = engine([{ location: { lat: 52, lon: 179 }, amount: 5 }], points, { mode: "points", area: "US" }).render();
    expect(result.configuration.series[0].data[0].value[0]).toBe(-181);
    expect(result.tabularData.Locations[0].Longitude).toBe(179);
  });

  it("validates the selected map and coordinate pair before rendering", () => {
    expect(() => engine([], { latitude: points.latitude }, { mode: "points" }).render()).toThrow("both latitude and longitude");
    expect(() => engine([], regions, { area: "../../package" }).render()).toThrow("available map area");
    expect(() => assertVisualizationSpec({ version: 2, layers: [
      { id: "a", bindingId: 1, mark: "map", encoding: regions },
      { id: "b", bindingId: 2, mark: "map", encoding: regions },
    ] })).toThrow("one dataset and one value");
    for (const mode of ["regions", "points"]) {
      const draft = engine([{ location: {} }], {}, { mode });
      draft.chart.visualization.status = "draft";
      expect(draft.render().preparedData.results[0].rows).toEqual([]);
    }
  });

  it("loads every bundled map and renders representative countries with the real SVG renderer", () => {
    for (const definition of manifest.maps) {
      const map = getMap(definition.id);
      expect(map.geoJSON.features.length).toBeGreaterThan(0);
      for (const feature of map.geoJSON.features) {
        expect(["Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
        expect(feature.properties.code).toBeTruthy();
        expect(map.aliases.get(feature.properties.code.toLowerCase().replace(/[^a-z0-9]/g, ""))).toBe(feature.properties.code);
      }
    }
    for (const area of ["US", "CA", "GB", "FR", "DE", "CN", "FJ"]) {
      const first = getMap(area).geoJSON.features[0].properties.code;
      const result = engine([{ location: { country: first }, amount: 5 }], regions, { area }).render();
      const svg = image(result);
      expect(svg).toContain("<path");
      expect(svg).not.toContain("NaN");
    }
  }, 20000);
});
