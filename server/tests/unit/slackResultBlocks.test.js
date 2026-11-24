import { describe, expect, it } from "vitest";

const { answerBlocks, dataTable, nativeChart } = require("../../apps/slack/utils/resultBlocks");

function chart(type = "line", count = 12) {
  return {
    name: "Revenue", type,
    visualization: { layers: [{ mark: type }], settings: {} },
    render: { configuration: { series: [{}] }, tabularData: {
      Revenue: Array.from({ length: count }, (_, index) => ({ Category: `Month ${index + 1}`, Revenue: index + 1 })),
    } },
  };
}

describe("Slack chart results", () => {
  it("preserves all values and categories in a native chart", () => {
    const block = nativeChart(chart());
    expect(block.chart.type).toBe("line");
    expect(block.chart.axis_config.categories).toHaveLength(12);
    expect(block.chart.series[0].data[11]).toEqual({ label: "Month 12", value: 12 });
  });

  it("uses a fallback instead of removing points or replacing missing data", () => {
    expect(nativeChart(chart("line", 20))).not.toBeNull();
    expect(nativeChart(chart("line", 21))).toBeNull();
    const missing = chart();
    missing.render.tabularData.Revenue[0].Revenue = null;
    expect(nativeChart(missing)).toBeNull();
  });

  it("rejects changed label meaning, mixed marks, and unsupported axes", () => {
    const item = chart();
    item.render.tabularData.Revenue[1].Category = "Month 1";
    expect(nativeChart(item)).toBeNull();
    item.render.tabularData.Revenue[1].Category = "A category longer than twenty characters";
    expect(nativeChart(item)).toBeNull();
    const mixed = chart();
    mixed.visualization.layers.push({ mark: "bar" });
    expect(nativeChart(mixed)).toBeNull();
    const logarithmic = chart();
    logarithmic.visualization.settings.isLogarithmic = true;
    expect(nativeChart(logarithmic)).toBeNull();
  });

  it("preserves pie limits and rejects non-positive slices", () => {
    expect(nativeChart(chart("pie", 12)).chart.segments).toHaveLength(12);
    expect(nativeChart(chart("pie", 13))).toBeNull();
    const item = chart("pie");
    item.render.tabularData.Revenue[0].Revenue = 0;
    expect(nativeChart(item)).toBeNull();
  });

  it("keeps negative bar values and rejects excess series", () => {
    const item = chart("bar");
    item.render.tabularData.Revenue[0].Revenue = -10;
    expect(nativeChart(item).chart.series[0].data[0].value).toBe(-10);
    for (const row of item.render.tabularData.Revenue) {
      for (let index = 0; index < 12; index++) row[`Series ${index}`] = index;
    }
    expect(nativeChart(item)).toBeNull();
  });

  it("limits table output and states when rows are omitted", () => {
    const blocks = dataTable(chart("line", 210));
    expect(blocks[0].rows).toHaveLength(201);
    expect(blocks[0].rows[1][1].type).toBe("raw_number");
    expect(blocks[1].text.text).toContain("Some data is not shown");
  });

  it("does not expose action JSON or render Slack mentions as active markup", () => {
    const result = answerBlocks({ message: '<!channel>\n```cb-actions\n{"suggestions":[{"action":"reply","label":"By month"}]}\n```' }, "request:answer");
    expect(result.blocks[0]).toEqual({ type: "markdown", text: "&lt;!channel&gt;" });
    expect(result.text).not.toContain("cb-actions");
    expect(result.replies).toEqual(["By month"]);
    expect(result.blocks[1].elements[0].value).toBe("request:answer");
  });

  it("uses Slack native formatting for headings, metrics, lists, links, and code", () => {
    const message = "### Overview\n\n**Trials:** 702\n\n- Visits: 884\n- See [dashboard](https://example.com)\n\n`/tools/`";
    expect(answerBlocks({ message }, "answer").blocks).toEqual([{ type: "markdown", text: message }]);
  });

  it("keeps escaped mentions intact at block boundaries", () => {
    const message = `${"a".repeat(11998)}<!channel> & <@U123>`;
    const result = answerBlocks({ message }, "answer");
    expect(result.blocks.every((block) => block.text.length <= 12000)).toBe(true);
    expect(result.blocks.map((block) => block.text).join("")).toBe(`${"a".repeat(11998)}&lt;!channel&gt; &amp; &lt;@U123&gt;`);
  });

  it("splits long answers without losing their text", () => {
    const result = answerBlocks({ message: "a".repeat(100000) }, "request:answer");
    expect(result.blocks.length).toBeLessThan(50);
    expect(result.blocks.every((block) => block.text.length <= 12000)).toBe(true);
    expect(result.blocks.map((block) => block.text).join("")).toHaveLength(100000);
  });
});
