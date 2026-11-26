import { describe, expect, it } from "vitest";

const { answerBlocks, dataTable } = require("../../apps/slack/utils/resultBlocks");

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
