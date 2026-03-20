import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  buildVisualizationVariableContext,
} = require("../../modules/visualizationV2/variableResolution.js");

describe("visualizationV2 variable resolution", () => {
  it("resolves runtime, cdc, request, and dataset defaults with stable precedence", () => {
    const context = buildVisualizationVariableContext({
      variables: {
        enabled: false,
        region: "live_region",
      },
      cdc: {
        configuration: {
          variables: [
            { name: "enabled", value: true },
            { name: "status", value: "cdc_status" },
            { name: "region", value: "cdc_region" },
          ],
        },
      },
      datasetOptions: {
        VariableBindings: [
          { name: "status", type: "string", default_value: "dataset_status" },
          { name: "datasetOnly", type: "string", default_value: "dataset_only" },
          { name: "customerId", type: "number", default_value: "42" },
        ],
        DataRequests: [{
          VariableBindings: [
            { name: "status", type: "string", default_value: "request_status" },
            { name: "customerId", type: "number", default_value: "55" },
            { name: "apiEnabled", type: "boolean", default_value: "true" },
          ],
        }],
      },
    });

    expect(context.values).toEqual({
      status: "cdc_status",
      datasetOnly: "dataset_only",
      customerId: 55,
      apiEnabled: true,
      enabled: false,
      region: "live_region",
    });
    expect(context.meta.status.source).toBe("cdc_default");
    expect(context.meta.customerId.source).toBe("request_default");
    expect(context.meta.datasetOnly.source).toBe("dataset_default");
    expect(context.meta.enabled.source).toBe("runtime");
  });
});
