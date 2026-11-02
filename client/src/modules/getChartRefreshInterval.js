const MAX_REFRESH_INTERVAL_SECONDS = 600;

export default function getChartRefreshInterval(autoUpdate, isPublic = false) {
  const intervalSeconds = Number(autoUpdate);
  if (isPublic || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) return null;

  return Math.min(intervalSeconds, MAX_REFRESH_INTERVAL_SECONDS) * 1000;
}
