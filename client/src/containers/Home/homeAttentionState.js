export function shouldShowNeedsAttention({ hasWatchedMetric, recommendationCount }) {
  return hasWatchedMetric || recommendationCount > 0;
}

export function buildHomeActivityRows({ dataHealth, needsAttention, notableChanges }) {
  return [
    ...dataHealth.map((item) => ({
      category: "health",
      id: `health:${item.id}`,
      item,
      path: item.action?.path || "/activity?tab=health",
    })),
    ...needsAttention.map((item) => ({
      category: "attention",
      id: `change:${item.id}`,
      item,
      path: `/activity/${item.id}`,
    })),
    ...notableChanges.map((item) => ({
      category: "notable",
      id: `change:${item.id}`,
      item,
      path: `/activity/${item.id}`,
    })),
  ].slice(0, 8);
}

export function removeHomeActivityItem(data, observationId) {
  const removeObservation = (items) => items.filter((item) => item.id !== observationId);
  return {
    ...data,
    needsAttention: removeObservation(data.needsAttention),
    notableChanges: removeObservation(data.notableChanges),
    observations: removeObservation(data.observations),
  };
}
