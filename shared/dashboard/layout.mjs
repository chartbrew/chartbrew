export const widths = { xxxl: 3840, xxl: 2560, xl: 1600, lg: 1200, md: 996, sm: 768, xs: 480, xxs: 240 };
export const cols = { xxxl: 16, xxl: 16, xl: 14, lg: 12, md: 10, sm: 8, xs: 6, xxs: 4 };
export const breakpoints = Object.keys(cols);
export const labels = { xxxl: "4K", xxl: "2K", xl: "XL", lg: "Desktop", md: "Laptop", sm: "Tablet", xs: "Mobile", xxs: "Small mobile" };
export const rowHeight = 150;
export const margin = Object.fromEntries(breakpoints.map((bp) => [bp, [12, 12]]));

export function getBreakpoint(width) {
  return breakpoints.find((bp) => width > widths[bp]) || "xxs";
}

export function visualOrder(items) {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x || String(a.i).localeCompare(String(b.i), undefined, { numeric: true }));
}

export function getReportOrder(charts, savedOrder) {
  const ids = new Set(charts.map((chart) => String(chart.id)));
  const existing = (savedOrder || []).map(String).filter((id) => ids.has(id));
  const primary = ["lg", "xl", "md", "xxl", "xxxl", "sm", "xs", "xxs"]
    .find((bp) => charts.some((chart) => chart.layout?.[bp]));
  const ordered = visualOrder(charts.map((chart) => ({
    i: String(chart.id), x: chart.layout?.[primary]?.[0] ?? 0,
    y: chart.layout?.[primary]?.[1] ?? Number.MAX_SAFE_INTEGER,
  }))).map((item) => item.i);
  return [...new Set([...existing, ...ordered])];
}

function widgetKind(chart = {}) {
  return chart.layoutIntent?.kind || (chart.type === "markdown" ? "text"
    : chart.mode === "kpichart" || ["kpi", "avg", "gauge"].includes(chart.type) ? "kpi"
      : chart.type === "table" ? "table" : "trend");
}

export function defaultSize(chart = {}, bp) {
  const kind = widgetKind(chart);
  const mobile = ["xs", "xxs"].includes(bp);
  const custom = chart.layoutIntent?.sizes?.[bp];
  const fraction = kind === "kpi" ? (cols[bp] >= 12 ? 4 : 2) : kind === "table" ? 1 : 2;
  return {
    w: mobile ? cols[bp] : Math.max(2, Math.min(cols[bp], custom?.[0] || Math.floor(cols[bp] / fraction))),
    h: custom?.[1] || (kind === "kpi" ? 1 : 2),
  };
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function tidyLayout(items, bp) {
  const result = [];
  visualOrder(items).forEach((item) => {
    if (![item.x, item.w, item.h].every(Number.isInteger)
      || item.x < 0 || item.w < 2 || item.h < 1 || item.x + item.w > cols[bp]) {
      throw new Error("Some widgets do not fit. Use Auto-arrange before saving.");
    }
    const y = result.reduce((bottom, other) => (
      item.x < other.x + other.w && item.x + item.w > other.x
        ? Math.max(bottom, other.y + other.h) : bottom
    ), 0);
    result.push({ ...item, y });
  });
  return visualOrder(result);
}

export function autoArrange(items, charts, bp, bottom = 0) {
  const byId = new Map(charts.map((chart) => [String(chart.id), chart]));
  const result = [];
  let block = [];
  let y = bottom;
  const flush = () => {
    const metrics = block.filter((item) => widgetKind(byId.get(String(item.i))) === "kpi");
    const plots = block.filter((item) => widgetKind(byId.get(String(item.i))) !== "kpi");
    [metrics, plots].forEach((group, index) => {
      const capacity = ["xs", "xxs"].includes(bp) ? 1 : index === 0 && cols[bp] >= 12 ? 4 : 2;
      for (let offset = 0; offset < group.length; offset += capacity) {
        const row = group.slice(offset, offset + capacity);
        row.forEach((item, column) => {
          const x = Math.floor(column * cols[bp] / row.length);
          result.push({ ...item, x, y, w: Math.floor((column + 1) * cols[bp] / row.length) - x, h: index === 0 ? 1 : 2 });
        });
        y += index === 0 ? 1 : 2;
      }
    });
    block = [];
  };
  items.forEach((item) => {
    const chart = byId.get(String(item.i));
    const kind = widgetKind(chart);
    if (["text", "table"].includes(kind) || chart?.layoutIntent?.sizes?.[bp]) {
      flush();
      const size = defaultSize(chart, bp);
      if (kind === "text" && !chart?.layoutIntent?.sizes?.[bp]) size.w = cols[bp];
      result.push({ ...item, ...size, x: 0, y });
      y += size.h;
    } else {
      block.push(item);
    }
  });
  flush();
  return result;
}

export function arrangeRows(items, bp, bottom = 0) {
  let x = 0;
  let y = bottom;
  let height = 0;
  return items.map((item) => {
    if (!Number.isInteger(item.w) || !Number.isInteger(item.h) || item.w < 1 || item.h < 1 || item.w > cols[bp]) {
      throw new Error("Some widgets have invalid sizes. Use Auto-arrange before saving.");
    }
    if (x && (x + item.w > cols[bp] || ["xs", "xxs"].includes(bp))) {
      x = 0;
      y += height;
      height = 0;
    }
    const result = { ...item, x, y };
    x += item.w;
    height = Math.max(height, item.h);
    return result;
  });
}

export function getLayouts(charts) {
  const order = getReportOrder(charts);
  return Object.fromEntries(breakpoints.map((bp) => {
    const saved = charts.flatMap((chart) => {
      const rect = chart.layout?.[bp];
      return Array.isArray(rect) && rect.length === 4
        ? [{ i: String(chart.id), x: rect[0], y: rect[1], w: rect[2], h: rect[3], minW: 2 }]
        : [];
    });
    const missing = order.filter((id) => !saved.some((item) => item.i === id));
    const bottom = saved.reduce((value, item) => Math.max(value, item.y + item.h), 0);
    return [bp, [...saved, ...arrangeRows(missing.map((id) => ({
      i: id, minW: 2, ...defaultSize(charts.find((chart) => String(chart.id) === id), bp),
    })), bp, bottom)]];
  }));
}

export function appendCharts(existing, charts, custom = breakpoints) {
  const layouts = getLayouts(existing);
  const batch = Object.fromEntries(breakpoints.map((bp) => {
    const items = charts.map((chart) => ({ i: String(chart.id), ...defaultSize(chart, bp) }));
    return [bp, charts.length > 1 ? autoArrange(items, charts, bp) : arrangeRows(items, bp)];
  }));
  const order = visualOrder(batch.lg).map((item) => item.i);
  const placed = deriveLayouts(batch, order, custom);
  const result = {};
  breakpoints.forEach((bp) => {
    const bottom = layouts[bp].reduce((value, item) => Math.max(value, item.y + item.h), 0);
    placed[bp].forEach(({ i, x, y, w, h }) => {
      result[i] ||= {};
      result[i][bp] = [x, y + bottom, w, h];
    });
  });
  return result;
}

export function deriveLayouts(layouts, order, custom = breakpoints) {
  const result = { ...layouts };
  const main = new Map((layouts.lg || []).map((item) => [String(item.i), item]));
  breakpoints.filter((bp) => bp !== "lg" && !custom.includes(bp)).forEach((bp) => {
    const items = order.flatMap((id) => {
      const item = main.get(String(id));
      if (!item) return [];
      const w = ["xs", "xxs"].includes(bp) ? cols[bp] : Math.max(2,
        Math.min(cols[bp], Math.floor((item.x + item.w) * cols[bp] / cols.lg) - Math.floor(item.x * cols[bp] / cols.lg)));
      return [{ ...item, w }];
    });
    result[bp] = tidyLayout(arrangeRows(items, bp), bp);
  });
  return result;
}

export function validateLayout(items, bp, previous = []) {
  if (!cols[bp] || !Array.isArray(items)) throw Object.assign(new Error("Invalid dashboard layout."), { statusCode: 400 });
  const saved = new Map(previous.map((item) => [String(item.i), item]));
  const unchanged = (item) => {
    const old = saved.get(String(item?.i));
    return old && ["x", "y", "w", "h"].every((field) => old[field] === item[field]);
  };
  const ids = new Set();
  // ponytail: pair checks are quadratic; use a spatial index for thousands of widgets.
  items.forEach((item, index) => {
    if (!item || ids.has(String(item.i))
      || (!unchanged(item) && (![item.x, item.y, item.w, item.h].every(Number.isInteger)
        || item.x < 0 || item.y < 0 || item.w < 2 || item.h < 1 || item.x + item.w > cols[bp]))
      || items.slice(0, index).some((other) => !(unchanged(item) && unchanged(other)) && overlap(item, other))) {
      throw Object.assign(new Error(`Some widgets overlap or do not fit on ${labels[bp]}. Use Tidy or Auto-arrange before saving.`), { statusCode: 400 });
    }
    ids.add(String(item.i));
  });
}
