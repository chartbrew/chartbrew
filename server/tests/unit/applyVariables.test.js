import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { applyVariables } = require("../../modules/applyVariables.js");

describe("applyVariables", () => {
  it("applies firestore variable bindings to configuration without mutating the original request", () => {
    const dataRequest = {
      route: "/teams/{{teamId}}/orders",
      configuration: {
        selectedSubCollection: "{{subCollection}}",
        orderBy: "{{sortField}}",
        limit: "{{limit}}",
      },
      VariableBindings: [
        { name: "teamId", type: "string" },
        { name: "subCollection", type: "string", default_value: "events" },
        { name: "sortField", type: "string", default_value: "created_at" },
        { name: "limit", type: "number", default_value: "25" },
      ],
      Connection: {
        type: "firestore",
      },
    };

    const result = applyVariables(dataRequest, {
      teamId: "team_1",
      limit: "10",
    });

    expect(result.dataRequest).toBe(dataRequest);
    expect(result.processedDataRequest).not.toBe(dataRequest);
    expect(result.processedDataRequest.route).toBe("/teams/{{teamId}}/orders");
    expect(result.processedDataRequest.configuration).toEqual({
      selectedSubCollection: "events",
      orderBy: "created_at",
      limit: 10,
    });
    expect(dataRequest.route).toBe("/teams/{{teamId}}/orders");
    expect(dataRequest.configuration).toEqual({
      selectedSubCollection: "{{subCollection}}",
      orderBy: "{{sortField}}",
      limit: "{{limit}}",
    });
  });
});
