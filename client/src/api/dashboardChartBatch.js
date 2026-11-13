let retryAt = 0;

export function retryAfterMilliseconds(value, now = Date.now()) {
  if (!value) return 1000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 1000;
}

function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function requestDashboardChartBatch(url, options) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    while (retryAt > Date.now()) {
      await wait(Math.min(retryAt - Date.now(), 60000), options.signal);
    }
    const response = await fetch(url, options);
    if (response.status === 429) {
      retryAt = Math.max(retryAt, Date.now() + retryAfterMilliseconds(response.headers.get("Retry-After")));
      if (attempt < 2) continue;
      throw new Error("Too many requests. Wait, then try again.");
    }
    if (!response.ok) throw Object.assign(new Error("Could not load these charts. Try again."), { code: String(response.status) });
    return response.json();
  }
}
