import assert from "node:assert/strict";
import test from "node:test";

import { getFieldTypeLabel, getSchemaDefault, getSchemaExample, hasFormFields, partitionFields } from "./mcp-builder.utils.js";

test("hasFormFields is false when the schema has no properties", () => {
  assert.equal(hasFormFields(), false);
  assert.equal(hasFormFields({ type: "object" }), false);
  assert.equal(hasFormFields({ type: "object", properties: {} }), false);
  assert.equal(hasFormFields({ additionalProperties: true }), false);
});

test("hasFormFields is true when the schema lists properties", () => {
  assert.equal(hasFormFields({
    type: "object",
    properties: {
      page: { type: "integer" },
    },
  }), true);
});

test("partitionFields promotes optional fields when they are the only inputs", () => {
  const groups = partitionFields({
    type: "object",
    properties: {
      page: { type: "integer", description: "Page number, 1-indexed", minimum: 1 },
    },
  });

  assert.equal(groups.main.length, 1);
  assert.equal(groups.main[0][0], "page");
  assert.equal(groups.extra.length, 0);
});

test("partitionFields keeps optional fields in more options when required fields exist", () => {
  const groups = partitionFields({
    type: "object",
    required: ["query"],
    properties: {
      query: { type: "string" },
      limit: { type: "integer" },
    },
  });

  assert.equal(groups.long[0][0], "query");
  assert.equal(groups.extra[0][0], "limit");
  assert.equal(groups.main.length, 0);
});

test("getSchemaDefault walks nested object defaults", () => {
  assert.deepEqual(getSchemaDefault({
    type: "object",
    properties: {
      page: { type: "integer", default: 1 },
    },
  }), { page: 1 });
});

test("getSchemaExample builds argument values, not a schema document", () => {
  assert.deepEqual(getSchemaExample({ type: "object" }), {});
  assert.deepEqual(getSchemaExample({
    type: "object",
    properties: {
      page: { type: "integer", description: "Page number, 1-indexed", minimum: 1 },
      query: { type: "string" },
    },
  }), { page: 1, query: "" });
  assert.deepEqual(getSchemaExample({
    type: "object",
    properties: {
      status: { type: "string", enum: ["open", "closed"] },
    },
  }), { status: "open" });
});

test("getFieldTypeLabel matches the builder field labels", () => {
  assert.equal(getFieldTypeLabel({ type: "string" }, "query"), "text");
  assert.equal(getFieldTypeLabel({ type: "string" }, "connectionId"), "string");
  assert.equal(getFieldTypeLabel({ type: "boolean" }), "boolean");
  assert.equal(getFieldTypeLabel({ type: "string", enum: ["a", "b"] }), "enum");
  assert.equal(getFieldTypeLabel({ type: "integer" }), "number");
});
