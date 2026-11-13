export function createChartBatchQueue({ requests, loadBatch, isLoaded }) {
  const queued = new Set();
  const started = new Set();
  const active = new Set();
  const runningIds = new Set();
  let stopped = false;
  let scheduled = false;

  const pump = () => {
    scheduled = false;
    if (stopped) return;
    while (active.size < 2 && queued.size > 0) {
      const batch = [];
      for (const id of queued) {
        queued.delete(id);
        const item = requests.find((request) => request.chart_id === id);
        if (!item || isLoaded(item)) continue;
        started.add(id);
        runningIds.add(id);
        batch.push(item);
        if (batch.length === 4) break;
      }
      if (!batch.length) continue;
      const request = loadBatch(batch);
      active.add(request);
      Promise.resolve(request).catch(() => null).finally(() => {
        active.delete(request);
        batch.forEach((item) => runningIds.delete(item.chart_id));
        pump();
      });
    }
  };

  const enqueue = (id) => {
    if (stopped || started.has(id)) return;
    queued.add(id);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(pump);
    }
  };

  return {
    enqueue,
    retry: (id) => {
      if (runningIds.has(id)) return;
      started.delete(id);
      enqueue(id);
    },
    stop: () => {
      stopped = true;
      queued.clear();
      active.forEach((request) => request.abort());
    },
  };
}
