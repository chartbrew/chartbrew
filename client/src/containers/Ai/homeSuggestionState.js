export function mergeSuggestionContext(current, additions) {
  const entities = new Map(current.map((item) => [`${item.entity_type}:${item.id}`, item]));
  additions.forEach((item) => entities.set(`${item.entity_type}:${item.id}`, item));
  if (entities.size > 10) return null;
  return [...entities.values()];
}

export function keepSuggestionOrder(previous, next, editing) {
  if (!editing) return next;
  const keys = new Set(next.map((item) => typeof item === "string" ? item : item.id));
  const retained = previous.filter((item) => keys.has(typeof item === "string" ? item : item.id));
  return retained.length ? retained : next;
}
