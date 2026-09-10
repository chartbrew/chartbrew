// Official endpoints only. OAuth metadata and tool permissions still come from discovery.
module.exports = [{
  id: "posthog",
  name: "PostHog",
  url: "https://mcp.posthog.com/mcp?mode=tools&readonly=true",
  documentationUrl: "https://posthog.com/docs/model-context-protocol/faq",
  verifiedAt: "2026-09-06",
  capabilities: ["query", "tools"],
  toolFilter: {
    parameter: "tools",
    preserveParameters: ["features"],
  },
  note: "Sign in to select your PostHog account. Review read-only tool access after connecting.",
}];
