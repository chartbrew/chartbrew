export function shouldShowNeedsAttention({ hasWatchedMetric, recommendationCount }) {
  return hasWatchedMetric || recommendationCount > 0;
}
