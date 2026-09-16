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
  ai: {
    contextTools: ["read-data-schema"],
    datasetTools: ["execute-sql"],
    instructions: [
      "Use read-data-schema to discover events, properties, and property values before building an unfamiliar query. Inspect its live input schema; tool arguments can change.",
      "For read-data-schema and execute-sql, include every required argument from its live schema. When context is required, describe the final requested analysis.",
      "Use execute-sql for chart rows. read-data-schema is for field discovery, not the final dataset. Request named scalar columns and rows, not a prose answer.",
      "Preserve the event, visitor/session/event measure, filters, and date range in follow-ups. A change of grouping usually needs a new query and dataset.",
    ],
    topics: [{
      match: /\b(geo|geoip|map|maps|countr\w*|states?|latitude|longitude|coordinates?)\b/i,
      search: "read-data-schema events geoip properties",
      instructions: [
        "PostHog GeoIP property candidates are $geoip_city_name, $geoip_country_code, $geoip_subdivision_1_code, $geoip_subdivision_1_name, $geoip_latitude, and $geoip_longitude. Verify their presence and usable values; these names alone are not proof of available data.",
        "In HogQL queries on events, these are nested event properties: use properties.$geoip_latitude and properties.$geoip_longitude, not bare $geoip_latitude or $geoip_longitude columns. Apply the properties prefix to country and subdivision fields too. A failure to resolve a bare field is a query-path error, not proof that location data is missing.",
        "When the schema identifies coordinates as numeric, select them directly. If conversion is needed, use HogQL toFloat(), not ClickHouse toFloat64().",
        "For US states, filter properties.$geoip_country_code = 'US' and group by subdivision. For points, alias numeric property values as latitude and longitude plus the requested measure, excluding missing coordinates. Country totals cannot supply state or point data.",
        "For most popular locations, aggregate in the source query: GROUP BY latitude, longitude with count() AS visits for pageview counts, ORDER BY visits DESC, and apply the requested date filter before grouping. Never rank or count a limited sample of raw events. Preserve an explicit unique-visitor or session measure instead of replacing it with count(). For website visits without an established event definition, use $pageview and state that visits means pageviews.",
        "When available, include a city label from properties.$geoip_city_name, using an aggregate such as any() when grouping by coordinates. City is a label, not a replacement for the coordinate grouping. Bind the resulting visits column with sum, not a count of aggregate rows.",
        "Use event GeoIP properties for visit locations. $initial_geoip_* describes the person's first location and changes the meaning. IP locations are approximate.",
      ],
    }],
  },
}];
