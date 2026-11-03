const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const { TOOLS } = require("../../modules/mcp/tools");
const { validatePostBody } = require("../../modules/dataApiValidation");

describe("MCP tool definitions", () => {
  it("documents every input and keeps the complete catalog bounded", () => {
    for (const tool of TOOLS) {
      for (const [name, property] of Object.entries(tool.inputSchema.properties)) {
        expect(property.description, `${tool.name}.${name}`).toEqual(expect.any(String));
        expect(property.description.trim().length).toBeGreaterThan(0);
      }
    }
    const tools = TOOLS.map(({ scope, ...definition }) => definition);
    expect(JSON.stringify({ tools }).length).toBeLessThanOrEqual(28000);
  });

  it("accepts documented filter examples in both the MCP schema and the data handler", () => {
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    for (const name of ["run_dataset", "get_chart_data"]) {
      const tool = TOOLS.find((definition) => definition.name === name);
      const validate = ajv.compile(tool.inputSchema);
      const resourceType = name === "run_dataset" ? "dataset" : "chart";
      const ids = resourceType === "dataset" ? { datasetId: 1 } : { projectId: 1, chartId: 1 };
      for (const filters of tool.inputSchema.properties.filters.examples) {
        expect(validate({ ...ids, filters })).toBe(true);
        expect(validatePostBody({ filters }, { resourceType }).filters).toEqual(filters);
      }
    }
  });
});
