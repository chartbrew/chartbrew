const {
  DEFAULT_DATA_API_LIMITS,
  getDataApiLimits,
  positiveInteger,
  withExecutionDeadline,
} = require("../../modules/dataApiLimits");
const {
  acceptsJson,
  DataApiError,
  matchesEtag,
  serializeDataApiResponse,
} = require("../../modules/dataApiResponse");
const {
  parseDataApiId,
  requiresRefreshScope,
  validatePostBody,
} = require("../../modules/dataApiValidation");
const { filterDatasetResult } = require("../../visualization/filterDatasets");
const {
  buildConnectorAuditPayload,
  getConnectorAuditError,
} = require("../../sources/shared/connectorRuntime");

describe("Data API contracts", () => {
  it("uses positive environment limits and safe defaults", () => {
    expect(positiveInteger("12", 5)).toBe(12);
    expect(positiveInteger("0", 5)).toBe(5);
    expect(positiveInteger("word", 5)).toBe(5);
    expect(getDataApiLimits({})).toEqual(DEFAULT_DATA_API_LIMITS);
    expect(getDataApiLimits({ CB_DATA_API_MAX_FILTERS: "4" }).maxFilters).toBe(4);
  });

  it("accepts only positive base-10 integer IDs", () => {
    expect(parseDataApiId("42")).toBe(42);
    ["0", "-1", "1.5", "1e2", "01abc", ""].forEach((value) => {
      expect(() => parseDataApiId(value)).toThrow(DataApiError);
    });
  });

  it("validates chart runtime input and refresh authority", () => {
    const request = validatePostBody({
      variables: { region: "APAC" },
      filters: [{
        type: "field",
        field: "root[].status",
        operator: "is",
        value: "paid",
        scope: "cdc",
        cdcId: 8,
      }],
    }, {
      resourceType: "chart",
      cdcIds: [8],
    });

    expect(request).toEqual({
      variables: { region: "APAC" },
      filters: [{
        type: "field",
        field: "root[].status",
        operator: "is",
        value: "paid",
        scope: "cdc",
        cdcId: 8,
      }],
      refresh: false,
    });
    expect(requiresRefreshScope(request)).toBe(true);
  });

  it("rejects unknown input, foreign CDCs, and client-only filters", () => {
    expect(() => validatePostBody({ unknown: true }, { resourceType: "chart" }))
      .toThrow("The request is not valid.");
    expect(() => validatePostBody({
      filters: [{
        type: "field",
        field: "root[].status",
        operator: "is",
        value: "paid",
        scope: "cdc",
        cdcId: 99,
      }],
    }, { resourceType: "chart", cdcIds: [8] })).toThrow("One or more filters are not valid.");
    expect(() => validatePostBody({
      filters: [{
        type: "sort",
        field: "root[].amount",
        operator: "is",
        value: 1,
      }],
    }, { resourceType: "dataset" })).toThrow("One or more filters are not valid.");

    [
      { type: "", field: "root[].amount", operator: "is", value: 1 },
      { field: "root[].amount", operator: "is", value: 1, origin: "dashboard" },
      { field: "root[].amount", operator: "is", value: 1, exposed: false },
      { field: "root[].amount", operator: "is", value: 1, clientOnly: false },
      { field: "root[].amount", operator: "is", value: 1, forceSourceRefresh: "false" },
      { type: "date", startDate: "2026-08-01", endDate: "2026-08-02", scope: "other" },
    ].forEach((filter) => {
      expect(() => validatePostBody({ filters: [filter] }, { resourceType: "chart" }))
        .toThrow("One or more filters are not valid.");
    });
  });

  it("validates dataset timezone and stored schema fields", () => {
    expect(validatePostBody({
      timezone: "Asia/Bangkok",
      filters: [{
        type: "field",
        field: "root[].amount",
        operator: "greaterOrEqual",
        value: 100,
      }],
    }, {
      resourceType: "dataset",
      schemaFields: ["root[].amount"],
    }).timezone).toBe("Asia/Bangkok");

    expect(() => validatePostBody({ timezone: "Moon/Base" }, { resourceType: "dataset" }))
      .toThrow("The request is not valid.");
    expect(() => validatePostBody({
      filters: [{
        type: "field",
        field: "root[].secret",
        operator: "is",
        value: true,
      }],
    }, {
      resourceType: "dataset",
      schemaFields: ["root[].amount"],
    })).toThrow("One or more filters are not valid.");
    expect(() => validatePostBody({
      filters: [{ field: "root.amount", operator: "is", value: 100 }],
    }, { resourceType: "dataset" })).toThrow("One or more filters are not valid.");
    expect(() => validatePostBody({
      filters: [{ field: "root[].items[].amount", operator: "is", value: 100 }],
    }, { resourceType: "dataset" })).toThrow("One or more filters are not valid.");
  });

  it("bounds nested values, strings, filter counts, and variable counts", () => {
    const limits = {
      ...DEFAULT_DATA_API_LIMITS,
      maxFilters: 1,
      maxStringBytes: 4,
      maxValueDepth: 1,
      maxVariables: 1,
    };
    expect(() => validatePostBody({ variables: { first: 1, last: 2 } }, {
      resourceType: "chart",
      limits,
    })).toThrow("One or more variables are not valid.");
    expect(() => validatePostBody({ variables: { longName: 1 } }, {
      resourceType: "chart",
      limits,
    })).toThrow("One or more variables are not valid.");
    expect(() => validatePostBody({ variables: { key: { a: { b: 1 } } } }, {
      resourceType: "chart",
      limits,
    })).toThrow("One or more variables are not valid.");
    expect(() => validatePostBody({
      variables: JSON.parse("{\"safe\":{\"__proto__\":{\"polluted\":true}}}"),
    }, { resourceType: "chart" })).toThrow("One or more variables are not valid.");
  });

  it("matches strong and weak ETags without accepting partial values", () => {
    const etag = "\"pd-v1-abc\"";
    expect(matchesEtag(etag, etag)).toBe(true);
    expect(matchesEtag(`W/${etag}`, etag)).toBe(true);
    expect(matchesEtag(`"other", ${etag}`, etag)).toBe(true);
    expect(matchesEtag("\"pd-v1-ab\"", etag)).toBe(false);
  });

  it("honors JSON content negotiation quality", () => {
    const request = (accept) => ({ headers: { accept } });
    expect(acceptsJson(request("application/json"))).toBe(true);
    expect(acceptsJson(request("application/problem+json"))).toBe(true);
    expect(acceptsJson(request("text/html, application/json;q=0"))).toBe(false);
  });

  it("measures UTF-8 response bytes and rejects complete oversized responses", () => {
    expect(serializeDataApiResponse({ value: "é" }).bytes)
      .toBe(Buffer.byteLength(JSON.stringify({ value: "é" }), "utf8"));
    expect(() => serializeDataApiResponse({ value: "é" }, { maxBytes: 5 }))
      .toThrow("The response is too large.");
  });

  it("returns a stable execution timeout", async () => {
    await expect(withExecutionDeadline(() => new Promise(() => {}), 5))
      .rejects.toMatchObject({ code: "EXECUTION_TIMEOUT", statusCode: 504 });
  });

  it("filters root and nested arrays without changing the source value", () => {
    const root = [{ value: null }, { value: 2 }, {}];
    expect(filterDatasetResult(root, [{
      type: "field",
      field: "root[].value",
      operator: "isNull",
    }])).toEqual([{ value: null }, {}]);
    expect(root).toEqual([{ value: null }, { value: 2 }, {}]);

    const nested = { payload: { rows: [{ amount: 10 }, { amount: 20 }] } };
    expect(filterDatasetResult(nested, [{
      type: "field",
      field: "root.payload.rows[].amount",
      operator: "greaterThan",
      value: 10,
    }])).toEqual({ payload: { rows: [{ amount: 20 }] } });
    expect(nested).toEqual({ payload: { rows: [{ amount: 10 }, { amount: 20 }] } });
  });

  it("removes source content from Data API connector audits", () => {
    const auditContext = {
      redactSensitivePayload: true,
      requestMetadata: {
        connectionId: 3,
        queryPreview: "select secret from accounts",
      },
    };
    expect(buildConnectorAuditPayload(auditContext, {
      bodySnippet: "secret body",
      cacheHit: false,
      itemCount: 2,
      responseSnippet: "secret rows",
    })).toEqual({
      cacheHit: false,
      connectionId: 3,
      itemCount: 2,
    });
    expect(getConnectorAuditError(
      auditContext,
      new Error("database password is invalid"),
      "connection"
    )).toMatchObject({
      code: "DATA_UNAVAILABLE",
      message: "The data source request failed.",
    });
  });
});
