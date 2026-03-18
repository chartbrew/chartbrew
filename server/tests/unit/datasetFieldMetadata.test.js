import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  buildFieldsSchemaFromMetadata,
  inferDatasetFieldMetadata,
} = require("../../modules/datasetFieldMetadata.js");

describe("datasetFieldMetadata", () => {
  it("infers field roles, labels, and schema from preview data", () => {
    const fieldsMetadata = inferDatasetFieldMetadata([
      {
        id: 1,
        created_at: "2026-03-18T08:00:00.000Z",
        revenue: 1250,
        status: "paid",
        customer: {
          city: "Bucharest",
        },
      },
    ]);

    expect(fieldsMetadata).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "root[].id",
        type: "number",
        role: "dimension",
        aggregation: "none",
      }),
      expect.objectContaining({
        id: "root[].created_at",
        type: "date",
        role: "date",
        aggregation: "none",
      }),
      expect.objectContaining({
        id: "root[].revenue",
        type: "number",
        role: "metric",
        aggregation: "sum",
      }),
      expect.objectContaining({
        id: "root[].status",
        type: "string",
        role: "dimension",
      }),
      expect.objectContaining({
        id: "root[].customer.city",
        type: "string",
        label: "Customer City",
      }),
    ]));

    expect(buildFieldsSchemaFromMetadata(fieldsMetadata)).toMatchObject({
      "root[].id": "number",
      "root[].created_at": "date",
      "root[].revenue": "number",
      "root[].status": "string",
      "root[].customer.city": "string",
    });
  });

  it("preserves manual overrides and marks missing fields on refresh", () => {
    const fieldsMetadata = inferDatasetFieldMetadata(
      [{ revenue: 25 }],
      [
        {
          id: "root[].revenue",
          legacyPath: "root[].revenue",
          label: "MRR",
          role: "metric",
          aggregation: "avg",
          enabled: false,
        },
        {
          id: "root[].status",
          legacyPath: "root[].status",
          label: "Status",
          role: "dimension",
          aggregation: "none",
          enabled: true,
        },
      ]
    );

    expect(fieldsMetadata).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "root[].revenue",
        label: "MRR",
        aggregation: "avg",
        enabled: false,
        missing: false,
      }),
      expect.objectContaining({
        id: "root[].status",
        label: "Status",
        missing: true,
      }),
    ]));
  });
});
