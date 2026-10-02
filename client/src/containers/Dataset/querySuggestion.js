export function resolveQuerySuggestion(response, submittedQuery, currentQuery) {
  if (typeof response?.query !== "string" || !response.query.trim()) {
    throw new Error("No query returned");
  }

  return {
    query: response.query,
    previousQuery: currentQuery === submittedQuery ? submittedQuery : null,
  };
}
