import assert from "node:assert/strict";
import test from "node:test";

import {
  addVisualizationLayer,
  getPreferredDateField,
  getVisualizationTimeField,
  isVisualizationReady,
  updateBindingFill,
  updateLayerField,
  updateLayerFormula,
  updateLayerGoal,
  updateLayerMark,
  updateLayerNullHandling,
  updateLayerRowPath,
  updateLayerSeriesOptions,
  updateLegendVisibility,
  updateMissingValuePolicy,
  updateSeriesColor,
} from "./visualization.js";
import { chartColors, getChartColorForKey } from "../config/colors.js";

const visualization = {
  version: 2,
  metadata: { migratedFrom: "legacy" },
  layers: [{
    id: "income",
    bindingId: "cdc-income",
    mark: "bar",
    encoding: {
      category: { field: "root[].program", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    },
  }],
};

test("adding a breakdown makes a legacy spec native without adding a binding", () => {
  const next = updateLayerField(visualization, "income", "breakdown", {
    type: "string",
    value: "root[].level",
  });

  assert.equal(next.metadata.migratedFrom, undefined);
  assert.equal(next.metadata.createdBy, "visualization-editor");
  assert.equal(next.layers.length, 1);
  assert.equal(next.layers[0].bindingId, "cdc-income");
  assert.equal(next.layers[0].encoding.breakdown.field, "root[].level");
  assert.equal(next.status, "ready");
});

test("clearing a breakdown removes the generated-series encoding", () => {
  const withBreakdown = updateLayerField(visualization, "income", "breakdown", {
    type: "string",
    value: "root[].level",
  });
  const next = updateLayerField(withBreakdown, "income", "breakdown", null);

  assert.equal(Object.hasOwn(next.layers[0].encoding, "breakdown"), false);
  assert.equal(next.layers.length, 1);
  assert.equal(next.status, "ready");
});

test("empty dimension values can be grouped under a custom label", () => {
  const next = updateLayerNullHandling(
    visualization,
    "income",
    "dimension",
    "label",
    "No program"
  );

  assert.equal(next.layers[0].encoding.category.nullPolicy, "label");
  assert.equal(next.layers[0].encoding.category.nullLabel, "No program");
});

test("empty breakdown handling can return to the default exclusion policy", () => {
  const withBreakdown = updateLayerField(visualization, "income", "breakdown", {
    type: "string",
    value: "root[].level",
  });
  const labeled = updateLayerNullHandling(
    withBreakdown,
    "income",
    "breakdown",
    "label",
    "No level"
  );
  const excluded = updateLayerNullHandling(labeled, "income", "breakdown", "exclude");

  assert.equal(excluded.layers[0].encoding.breakdown.nullPolicy, undefined);
  assert.equal(excluded.layers[0].encoding.breakdown.nullLabel, undefined);
});

test("empty dimension values can be preserved without a display label", () => {
  const next = updateLayerNullHandling(
    visualization,
    "income",
    "dimension",
    "preserve"
  );

  assert.equal(next.layers[0].encoding.category.nullPolicy, "preserve");
  assert.equal(next.layers[0].encoding.category.nullLabel, undefined);
});

test("missing chart points can be explicitly treated as zero", () => {
  const next = updateMissingValuePolicy(visualization, "zero");

  assert.equal(next.settings.missingValues.policy, "zero");
  assert.equal(next.metadata.createdBy, "visualization-editor");
});

test("legend visibility is stored in canonical chart settings", () => {
  const next = updateLegendVisibility(visualization, false);

  assert.equal(next.settings.legend.visible, false);
});

test("value-only marks remove axis encodings", () => {
  const next = updateLayerMark(visualization, "income", "kpi");

  assert.deepEqual(Object.keys(next.layers[0].encoding), ["value"]);
  assert.deepEqual(
    next.layers[0].options.markState.bar.encoding,
    visualization.layers[0].encoding
  );
  assert.equal(isVisualizationReady(next), true);
});

test("switching back from KPI restores the previous line fields", () => {
  const lineVisualization = {
    ...visualization,
    layers: [{
      ...visualization.layers[0],
      mark: "line",
      encoding: {
        ...visualization.layers[0].encoding,
        breakdown: { field: "root[].level", type: "nominal" },
      },
    }],
  };
  const kpi = updateLayerMark(lineVisualization, "income", "kpi");
  const restored = updateLayerMark(kpi, "income", "line");

  assert.deepEqual(restored.layers[0].encoding, lineVisualization.layers[0].encoding);
  assert.equal(restored.layers[0].mark, "line");
  assert.equal(restored.status, "ready");
});

test("each chart type remembers its own value aggregation", () => {
  const average = updateLayerMark(visualization, "income", "avg");
  const restored = updateLayerMark(average, "income", "bar");

  assert.equal(average.layers[0].encoding.value.aggregate, "avg");
  assert.equal(restored.layers[0].encoding.value.aggregate, "sum");
});

test("bar charts are filled by default and preserve an explicit bar fill choice", () => {
  const lineVisualization = {
    ...visualization,
    layers: [{
      ...visualization.layers[0],
      mark: "line",
      style: { fill: false },
    }],
  };
  const bar = updateLayerMark(lineVisualization, "income", "bar");
  const explicitlyUnfilled = {
    ...bar,
    layers: [{
      ...bar.layers[0],
      options: {
        ...bar.layers[0].options,
        markState: {
          ...bar.layers[0].options.markState,
          bar: { fill: false },
        },
      },
      style: { ...bar.layers[0].style, fill: false },
    }],
  };
  const restored = updateLayerMark(
    updateLayerMark(explicitlyUnfilled, "income", "line"),
    "income",
    "bar"
  );

  assert.equal(bar.layers[0].style.fill, true);
  assert.equal(bar.layers[0].style.fillOpacity, 0.65);
  assert.equal(restored.layers[0].style.fill, false);
});

test("fill settings use one opacity while preserving each series hue", () => {
  const next = updateBindingFill(visualization, "cdc-income", {
    fill: true,
    fillOpacity: 0.35,
  });

  assert.equal(next.layers[0].style.fill, true);
  assert.equal(next.layers[0].style.fillOpacity, 0.35);
  assert.equal(next.layers[0].style.fillColor, undefined);
  assert.equal(next.layers[0].options.markState.bar.fillOpacity, 0.35);
});

test("goals belong to one selected value layer", () => {
  const withSecondValue = addVisualizationLayer(visualization, "cdc-income", {
    id: "cost",
    metric: true,
  });
  const next = updateLayerGoal(withSecondValue, "cost", 2500);

  assert.equal(next.layers[0].goal, undefined);
  assert.equal(next.layers[1].goal, 2500);
});

test("generated-series controls stay on their selected layer", () => {
  const next = updateLayerSeriesOptions(visualization, "income", {
    hidden: ["series-b"],
    includeOther: true,
    limit: 8,
    order: ["series-c", "series-a"],
  });

  assert.deepEqual(next.layers[0].options.series, {
    hidden: ["series-b"],
    includeOther: true,
    limit: 8,
    order: ["series-c", "series-a"],
  });
});

test("add value reuses the dimension but creates a draft visual layer", () => {
  const next = addVisualizationLayer(visualization, "cdc-income", {
    id: "cost",
    metric: true,
  });

  assert.equal(next.layers.length, 2);
  assert.equal(next.layers[1].bindingId, "cdc-income");
  assert.equal(next.layers[1].name, "Value 2");
  assert.equal(next.layers[1].encoding.category.field, "root[].program");
  assert.equal(next.layers[1].encoding.value, undefined);
  assert.equal(next.status, "draft");
});

test("choosing a field gives a new value a useful label", () => {
  const withValue = addVisualizationLayer(visualization, "cdc-income", {
    metric: true,
    sourceLayer: visualization.layers[0],
  });
  const newLayer = withValue.layers[1];
  const next = updateLayerField(withValue, newLayer.id, "value", {
    text: "cost",
    type: "number",
    value: "root[].cost",
  });

  assert.equal(next.layers[1].name, "cost");
});

test("clearing a table row path removes the optional property", () => {
  const tableVisualization = {
    ...visualization,
    layers: [{
      ...visualization.layers[0],
      mark: "table",
      rowPath: "root[].items",
    }],
  };
  const next = updateLayerRowPath(tableVisualization, "income", "");

  assert.equal(Object.hasOwn(next.layers[0], "rowPath"), false);
});

test("series color overrides are stable and can return to automatic", () => {
  const overridden = updateSeriesColor(
    visualization,
    "income",
    "series-1234abcd",
    "#112233"
  );

  assert.deepEqual(overridden.layers[0].style.series["series-1234abcd"], {
    color: "#112233",
    fillColor: "#112233",
  });

  const automatic = updateSeriesColor(
    overridden,
    "income",
    "series-1234abcd",
    null
  );
  assert.equal(automatic.layers[0].style.series, undefined);
  assert.equal(getChartColorForKey("series-1234abcd"), getChartColorForKey("series-1234abcd"));
  assert.equal(
    Object.values(chartColors).some((color) => color.hex === getChartColorForKey("series-1234abcd")),
    true
  );
});

test("radar charts default to an unfilled primary-color shape", () => {
  const radar = updateLayerMark(visualization, "income", "radar");

  assert.equal(radar.layers[0].style.fill, false);
  assert.equal(radar.layers[0].style.fillOpacity, 0.15);
  assert.equal(radar.layers[0].style.multiFill, false);
  assert.equal(radar.layers[0].style.fillColor, undefined);
});

test("radar fill keeps one primary color and stores only opacity", () => {
  const radar = updateLayerMark(visualization, "income", "radar");
  const filled = updateBindingFill(radar, "cdc-income", { fill: true, fillOpacity: 0.28 });

  assert.equal(filled.layers[0].style.fill, true);
  assert.equal(filled.layers[0].style.fillOpacity, 0.28);
  assert.equal(filled.layers[0].style.multiFill, false);
  assert.equal(filled.layers[0].style.fillColor, undefined);
});

test("formulas belong to the selected canonical value layer", () => {
  const next = updateLayerFormula(visualization, "income", "${val / 100}");

  assert.equal(next.layers[0].encoding.value.formula, "${val / 100}");
  assert.equal(next.layers[1]?.encoding?.value?.formula, undefined);
});

test("date fields prefer the semantic time binding and created dates", () => {
  const timeVisualization = {
    ...visualization,
    layers: [{
      ...visualization.layers[0],
      encoding: {
        ...visualization.layers[0].encoding,
        time: { field: "root[].occurredAt", type: "temporal" },
      },
    }],
  };

  assert.equal(
    getVisualizationTimeField(timeVisualization, "cdc-income"),
    "root[].occurredAt"
  );
  assert.equal(getPreferredDateField([{
    type: "date",
    value: "root[].updatedAt",
  }, {
    type: "date",
    value: "root[].createdAt",
  }]), "root[].createdAt");
});
