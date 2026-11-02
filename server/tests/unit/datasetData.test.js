const {
  createDatasetData,
  getDatasetDataFingerprint,
  serializeDatasetData,
} = require("../../modules/datasetData");

describe("DatasetData v1", () => {
  it("preserves exact nested data and sorts fields and object keys", () => {
    const data = createDatasetData({
      dataset: {
        id: 18,
        name: "Orders",
        fieldsSchema: {
          "root[].customer.name": "string",
          "root[].amount": "number",
        },
      },
      generatedAt: "2026-08-25T08:00:00.000Z",
      data: [{
        z: undefined,
        customer: { name: "Ada", rank: 1 },
        amount: Infinity,
        paid: true,
        createdAt: new Date("2026-08-20T04:00:00.000Z"),
        nullable: null,
      }],
    });

    expect(data).toEqual({
      data: [{
        amount: null,
        createdAt: "2026-08-20T04:00:00.000Z",
        customer: { name: "Ada", rank: 1 },
        nullable: null,
        paid: true,
      }],
      fields: [
        { key: "root[].amount", type: "number" },
        { key: "root[].customer.name", type: "string" },
      ],
      generatedAt: "2026-08-25T08:00:00.000Z",
      resource: { id: 18, kind: "dataset", name: "Orders" },
      version: 1,
    });
  });

  it("detects fields when no stored schema exists", () => {
    const data = createDatasetData({
      dataset: { id: 2, name: "Values" },
      data: [{ score: 4, active: false }],
    });
    expect(data.fields).toEqual([
      { key: "root[].active", type: "boolean" },
      { key: "root[].score", type: "number" },
    ]);
  });

  it.each([null, 42, "value", true, { value: 4 }])("keeps non-array result shape", (value) => {
    const data = createDatasetData({ dataset: { id: 2, name: "Value" }, data: value });
    expect(data.data).toEqual(value);
  });

  it("excludes only generation time from the content fingerprint", () => {
    const first = createDatasetData({
      dataset: { id: 2, name: "Values" },
      generatedAt: "2026-08-25T08:00:00.000Z",
      data: [{ score: 4 }],
    });
    const second = { ...first, generatedAt: "2026-08-26T08:00:00.000Z" };
    const changed = { ...second, data: [{ score: 5 }] };
    expect(getDatasetDataFingerprint(first)).toBe(getDatasetDataFingerprint(second));
    expect(getDatasetDataFingerprint(first)).not.toBe(getDatasetDataFingerprint(changed));
    expect(serializeDatasetData(first)).toContain("generatedAt");
  });

  it("unwraps model values without exposing model metadata", () => {
    const row = {
      dataValues: { amount: 12 },
      _options: { secret: true },
      toJSON() {
        return { ...this.dataValues };
      },
    };
    const data = createDatasetData({ dataset: { id: 2, name: "Values" }, data: [row] });
    expect(data.data).toEqual([{ amount: 12 }]);
    expect(JSON.stringify(data)).not.toContain("_options");
  });
});
