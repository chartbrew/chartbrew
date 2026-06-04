import {
  describe,
  expect,
  it,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  applyApiVariables,
} = require("../../sources/shared/protocols/api.variables.js");
const {
  applyFirestoreVariables,
} = require("../../sources/plugins/firestore/firestore.variables.js");
const {
  applyRealtimeDbVariables,
} = require("../../sources/plugins/realtimedb/realtimedb.variables.js");
const {
  applySqlVariables,
} = require("../../sources/shared/sql/sql.variables.js");
const mysqlProtocol = require("../../sources/plugins/mysql/mysql.protocol.js");

describe("source-owned variable processors", () => {
  it("applies SQL variables with quoting, escaping, defaults, and required checks", () => {
    const dataRequest = {
      query: "select * from users where name = {{name}} and status = '{{status}}' and age > {{age}}",
      VariableBindings: [{
        name: "name",
        type: "string",
        required: true,
      }, {
        name: "status",
        type: "string",
        default_value: "new \"lead\"",
      }, {
        name: "age",
        type: "number",
        default_value: "18",
      }],
    };

    const result = applySqlVariables(dataRequest, { name: "O'Reilly" });

    expect(result.dataRequest).toBe(dataRequest);
    expect(result.processedQuery).toBe(
      "select * from users where name = 'O''Reilly' and status = 'new \"\"lead\"\"' and age > 18"
    );
    expect(dataRequest.query).toBe("select * from users where name = {{name}} and status = '{{status}}' and age > {{age}}");

    expect(() => applySqlVariables(dataRequest, {}))
      .toThrow("Required variable 'name' has no value provided and no default value");
  });

  it("treats SQL variable replacement values as literals", () => {
    const dataRequest = {
      query: "select * from users where name = '{{name}}' and role = 'user'",
      VariableBindings: [{
        name: "name",
        type: "string",
        required: true,
      }],
    };

    const result = applySqlVariables(dataRequest, { name: "x$' OR 1=1 -- " });

    expect(result.processedQuery).toBe(
      "select * from users where name = 'x$'' OR 1=1 -- ' and role = 'user'"
    );
  });

  it("escapes backslashes in SQL string variables when requested", () => {
    const dataRequest = {
      query: "select * from users where name = {{name}}",
      VariableBindings: [{
        name: "name",
        type: "string",
        required: true,
      }],
    };

    const result = applySqlVariables(
      dataRequest,
      { name: "x\\' OR 1=1 -- " },
      { escapeBackslash: true }
    );

    expect(result.processedQuery).toBe(
      "select * from users where name = 'x\\\\'' OR 1=1 -- '"
    );
  });

  it("escapes backslashes through the MySQL protocol variable processor", () => {
    const dataRequest = {
      query: "select * from users where name = {{name}}",
      VariableBindings: [{
        name: "name",
        type: "string",
        required: true,
      }],
    };

    const result = mysqlProtocol.applyVariables({
      dataRequest,
      variables: { name: "x\\' OR 1=1 -- " },
    });

    expect(result.processedQuery).toBe(
      "select * from users where name = 'x\\\\'' OR 1=1 -- '"
    );
  });

  it("applies API variables to route, headers, and body while preserving date placeholders", () => {
    const dataRequest = {
      route: "/users/{{user_id}}?from={{start_date}}&active={{active}}",
      headers: {
        "x-plan-{{plan}}": "account-{{user_id}}",
      },
      body: "{\"limit\":{{limit}},\"active\":{{active}}}",
      VariableBindings: [{
        name: "user_id",
        type: "number",
        required: true,
      }, {
        name: "active",
        type: "boolean",
        default_value: "true",
      }, {
        name: "plan",
        type: "string",
        default_value: "pro",
      }, {
        name: "limit",
        type: "number",
        default_value: "25",
      }],
    };

    const result = applyApiVariables(dataRequest, { user_id: "42" });

    expect(result.processedRoute).toBe("/users/42?from={{start_date}}&active=true");
    expect(result.processedHeaders).toEqual({
      "x-plan-pro": "account-42",
    });
    expect(result.processedBody).toBe("{\"limit\":25,\"active\":true}");
  });

  it("applies Firestore variables across path, conditions, and configuration", () => {
    const dataRequest = {
      query: "tenants/{{tenant_id}}",
      conditions: [{
        field: "age",
        operator: ">=",
        value: "{{min_age}}",
      }],
      configuration: {
        selectedSubCollection: "{{sub_collection}}",
        orderBy: "{{order_field}}",
        limit: "{{limit}}",
      },
      VariableBindings: [{
        name: "tenant_id",
        type: "string",
        required: true,
      }, {
        name: "min_age",
        type: "number",
        default_value: "21",
      }, {
        name: "sub_collection",
        type: "string",
        default_value: "customers",
      }, {
        name: "order_field",
        type: "string",
        default_value: "createdAt",
      }, {
        name: "limit",
        type: "number",
        default_value: "50",
      }],
    };

    const result = applyFirestoreVariables(dataRequest, { tenant_id: "tenant-a" });

    expect(result.processedDataRequest).toMatchObject({
      query: "tenants/tenant-a",
      conditions: [{
        field: "age",
        operator: ">=",
        value: "21",
      }],
      configuration: {
        selectedSubCollection: "customers",
        orderBy: "createdAt",
        limit: 50,
      },
    });
    expect(dataRequest.query).toBe("tenants/{{tenant_id}}");
  });

  it("applies RealtimeDB route variables", () => {
    const dataRequest = {
      route: "/accounts/{{account_id}}/events/{{event_type}}",
      VariableBindings: [{
        name: "account_id",
        type: "string",
        required: true,
      }, {
        name: "event_type",
        type: "string",
        default_value: "signup",
      }],
    };

    const result = applyRealtimeDbVariables(dataRequest, { account_id: "acct_123" });

    expect(result.processedDataRequest.route).toBe("/accounts/acct_123/events/signup");
    expect(dataRequest.route).toBe("/accounts/{{account_id}}/events/{{event_type}}");
  });
});
