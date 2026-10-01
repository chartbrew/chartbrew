const { callAiProvider } = require("../ai/usage");
const { validateProfile } = require("./profileSchema");

function buildEnrichmentEvidence(profile) {
  return {
    datasetName: profile.dataset.summary,
    grain: profile.dataset.grain,
    fields: Object.entries(profile.fields).slice(0, 100).map(([field, value]) => ({
      field,
      type: value.type,
      role: value.role,
      semanticType: value.semanticType,
      aggregation: value.defaultAggregation,
    })),
    chartNames: (profile.usage.analyses || []).slice(0, 20).map((item) => item.chartName),
    dashboardNames: (profile.usage.analyses || [])
      .slice(0, 20)
      .map((item) => item.dashboardName)
      .filter(Boolean),
  };
}

async function enrichProfile(profile, client = global.openaiClient) {
  if (!client) return profile;

  const response = await callAiProvider({
    client,
    api: "chat",
    purpose: "dataset_enrichment",
    request: {
      model: global.openAiModel || "gpt-4o-mini",
      messages: [{
        role: "system",
        content: [
          "Return JSON only.",
          "Describe the dataset purpose and grain using only the provided metadata.",
          "Do not invent fields, calculations, or business meaning.",
          "Shape: {\"summary\": string, \"grain\": string|null}.",
        ].join(" "),
      }, {
        role: "user",
        content: JSON.stringify(buildEnrichmentEvidence(profile)),
      }],
      response_format: { type: "json_object" },
      max_tokens: 300,
    },
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  const summary = typeof parsed.summary === "string"
    ? parsed.summary.trim().slice(0, 500)
    : profile.dataset.summary;
  const grain = typeof parsed.grain === "string"
    ? parsed.grain.trim().slice(0, 500)
    : profile.dataset.grain;

  return validateProfile({
    ...profile,
    dataset: {
      ...profile.dataset,
      summary: summary || profile.dataset.summary,
      grain: grain || profile.dataset.grain,
    },
    provenance: {
      ...profile.provenance,
      llmEnriched: true,
    },
  });
}

module.exports = {
  buildEnrichmentEvidence,
  enrichProfile,
};

