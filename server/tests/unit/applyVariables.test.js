import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { applyVariables } = require("../../modules/applyVariables.js");

describe("applyVariables", () => {
  it("applies mysql variable bindings with runtime precedence and falsey values", () => {
    const dataRequest = {
      query: "SELECT * FROM orders WHERE team_id = {{teamId}} AND is_active = {{enabled}} AND total >= {{minTotal}} AND status = {{status}}",
      VariableBindings: [
        { name: "teamId", type: "string" },
        { name: "enabled", type: "boolean", default_value: true },
        { name: "minTotal", type: "number", default_value: "100" },
        { name: "status", type: "string", default_value: "paid" },
      ],
      Connection: {
        type: "mysql",
      },
    };

    const result = applyVariables(dataRequest, {
      teamId: "team_1",
      enabled: false,
      minTotal: 0,
    });

    expect(result.dataRequest).toBe(dataRequest);
    expect(result.processedQuery).toBe("SELECT * FROM orders WHERE team_id = 'team_1' AND is_active = FALSE AND total >= 0 AND status = 'paid'");
    expect(dataRequest.query).toBe("SELECT * FROM orders WHERE team_id = {{teamId}} AND is_active = {{enabled}} AND total >= {{minTotal}} AND status = {{status}}");
  });

  it("applies api variable bindings across route headers and body without mutating the original request", () => {
    const dataRequest = {
      route: "/teams/{{teamId}}/orders?includeArchived={{includeArchived}}",
      headers: {
        Authorization: "Bearer {{apiToken}}",
        "X-Retry": "{{retryCount}}",
      },
      body: "{\"region\":\"{{region}}\",\"enabled\":{{enabled}}}",
      VariableBindings: [
        { name: "teamId", type: "string" },
        { name: "includeArchived", type: "boolean" },
        { name: "apiToken", type: "string", default_value: "default_token" },
        { name: "retryCount", type: "number" },
        { name: "region", type: "string", default_value: "emea" },
        { name: "enabled", type: "boolean" },
      ],
      Connection: {
        type: "api",
      },
    };

    const result = applyVariables(dataRequest, {
      teamId: "team_1",
      includeArchived: false,
      retryCount: 0,
      enabled: false,
    });

    expect(result.dataRequest).toBe(dataRequest);
    expect(result.processedRoute).toBe("/teams/team_1/orders?includeArchived=false");
    expect(result.processedHeaders).toEqual({
      Authorization: "Bearer default_token",
      "X-Retry": "0",
    });
    expect(result.processedBody).toBe("{\"region\":\"emea\",\"enabled\":false}");
    expect(dataRequest.route).toBe("/teams/{{teamId}}/orders?includeArchived={{includeArchived}}");
    expect(dataRequest.headers).toEqual({
      Authorization: "Bearer {{apiToken}}",
      "X-Retry": "{{retryCount}}",
    });
    expect(dataRequest.body).toBe("{\"region\":\"{{region}}\",\"enabled\":{{enabled}}}");
  });

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
