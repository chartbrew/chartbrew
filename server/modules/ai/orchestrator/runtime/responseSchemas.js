const PLANNER_SCHEMA = {
  type: "object",
  properties: {
    answerCanUseBootstrapOnly: { type: "boolean" },
    planVersion: { type: "integer", enum: [1] },
    synthesisRequirements: {
      type: "object",
      properties: {
        includeCoverage: { type: "boolean" },
        includeNextAction: { type: "boolean" },
        rejectUnsupportedValues: { type: "boolean" },
      },
      required: ["includeCoverage", "includeNextAction", "rejectUnsupportedValues"],
      additionalProperties: false,
    },
    tasks: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          allowedTools: {
            type: "array",
            minItems: 1,
            maxItems: 1,
            items: { type: "string" },
          },
          dependsOn: {
            type: "array",
            maxItems: 3,
            items: { type: "string" },
          },
          evidenceRequired: {
            type: "array",
            maxItems: 12,
            items: { type: "string" },
          },
          maximumOutputCharacters: { type: "integer", minimum: 100, maximum: 12000 },
          maximumToolCalls: { type: "integer", minimum: 1, maximum: 4 },
          questionFragment: { type: "string", maxLength: 500 },
          sections: {
            type: "array",
            maxItems: 8,
            items: { type: "string" },
          },
          targetRef: { type: "string", maxLength: 200 },
          taskId: { type: "string", maxLength: 64 },
          taskType: {
            type: "string",
            enum: [
              "preview_kpi_review",
              "preview_metric_monitor",
              "read_workspace_section",
              "recommend_metric_monitors",
            ],
          },
        },
        required: [
          "allowedTools",
          "dependsOn",
          "evidenceRequired",
          "maximumOutputCharacters",
          "maximumToolCalls",
          "questionFragment",
          "sections",
          "targetRef",
          "taskId",
          "taskType",
        ],
        additionalProperties: false,
      },
    },
    taskType: {
      type: "string",
      enum: [
        "kpi_review_preview",
        "watch_preview",
        "watch_recommendation",
        "workspace_question",
        "workspace_summary",
      ],
    },
  },
  required: [
    "answerCanUseBootstrapOnly",
    "planVersion",
    "synthesisRequirements",
    "tasks",
    "taskType",
  ],
  additionalProperties: false,
};

const WORKER_SCHEMA = {
  type: "object",
  properties: {
    coverage: {
      type: "object",
      properties: {
        complete: { type: "boolean" },
        missingEvidence: {
          type: "array",
          maxItems: 20,
          items: { type: "string", maxLength: 200 },
        },
        truncated: { type: "boolean" },
      },
      required: ["complete", "missingEvidence", "truncated"],
      additionalProperties: false,
    },
    facts: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        properties: {
          evidenceRefs: {
            type: "array",
            maxItems: 20,
            items: { type: "string", maxLength: 200 },
          },
          factId: { type: "string", maxLength: 200 },
          factType: { type: "string", maxLength: 80 },
          state: { type: "string", maxLength: 80 },
        },
        required: ["evidenceRefs", "factId", "factType", "state"],
        additionalProperties: false,
      },
    },
    previewPrepared: { type: "boolean" },
    status: { type: "string", enum: ["complete", "failed", "partial"] },
    taskId: { type: "string", maxLength: 64 },
    workerContractVersion: { type: "integer", enum: [2] },
  },
  required: [
    "coverage",
    "facts",
    "previewPrepared",
    "status",
    "taskId",
    "workerContractVersion",
  ],
  additionalProperties: false,
};

const ANSWER_ITEM_SCHEMA = {
  type: "object",
  properties: {
    factRefs: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: { type: "string", maxLength: 200 },
    },
    text: { type: "string", minLength: 1, maxLength: 500 },
  },
  required: ["factRefs", "text"],
  additionalProperties: false,
};

const SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    answer: {
      type: "object",
      properties: {
        coverageNote: { type: "string", maxLength: 500 },
        headline: { type: "string", maxLength: 240 },
        sections: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              items: {
                type: "array",
                maxItems: 20,
                items: ANSWER_ITEM_SCHEMA,
              },
              type: {
                type: "string",
                enum: [
                  "account",
                  "coverage",
                  "dashboards",
                  "datasets",
                  "details",
                  "kpi_result",
                  "kpi_results",
                  "kpi_reviews",
                  "learning",
                  "needs_attention",
                  "prepared_change",
                  "recent_alerts",
                  "recommendations",
                  "watched_metrics",
                ],
              },
            },
            required: ["items", "type"],
            additionalProperties: false,
          },
        },
      },
      required: ["coverageNote", "headline", "sections"],
      additionalProperties: false,
    },
    contractVersion: { type: "integer", enum: [2] },
    recommendations: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          factRefs: {
            type: "array",
            minItems: 1,
            maxItems: 1,
            items: { type: "string", maxLength: 200 },
          },
          text: { type: "string", minLength: 1, maxLength: 400 },
        },
        required: ["factRefs", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["answer", "contractVersion", "recommendations"],
  additionalProperties: false,
};

function buildJsonSchemaFormat(name, schema) {
  return {
    type: "json_schema",
    name,
    schema,
    strict: true,
  };
}

module.exports = {
  PLANNER_SCHEMA,
  SYNTHESIS_SCHEMA,
  WORKER_SCHEMA,
  buildJsonSchemaFormat,
};
