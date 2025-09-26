import { cols } from "./layoutBreakpoints";
import { cloneDeep } from "lodash";

function cloneItems(items) {
  return cloneDeep(items);
}

function rectanglesOverlap(a, b) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  return !(ax2 <= b.x || bx2 <= a.x || ay2 <= b.y || by2 <= a.y);
}

function clampItemToGrid(item, bpCols) {
  const clamped = cloneDeep(item);
  if (clamped.w > bpCols) clamped.w = bpCols;
  if (clamped.x < 0) clamped.x = 0;
  if (clamped.y < 0) clamped.y = 0;
  if (clamped.x + clamped.w > bpCols) {
    clamped.x = Math.max(0, bpCols - clamped.w);
  }
  return clamped;
}

function findLeftmostX(item, placed, bpCols) {
  let x = 0;
  const limit = Math.max(0, bpCols - item.w);
  for (x = 0; x <= limit; x += 1) {
    const test = { ...item, x };
    const hasCollision = placed.some((p) => rectanglesOverlap(test, p));
    if (!hasCollision) return x;
  }
  return Math.max(0, Math.min(item.x, limit));
}

function moveUp(item, others) {
  let moved = { ...item };
  while (moved.y > 0) {
    const test = { ...moved, y: moved.y - 1 };
    const collides = others.some((o) => rectanglesOverlap(test, o));
    if (collides) break;
    moved = test;
  }
  return moved;
}

function normalizeAndCompact(items, bpCols) {
  const normalized = cloneItems(items).map((it) => clampItemToGrid(it, bpCols));
  // Stable order by y, then x, then i to make deterministic
  normalized.sort((a, b) => (a.y - b.y) || (a.x - b.x) || `${a.i}`.localeCompare(`${b.i}`));

  const placed = [];
  normalized.forEach((it) => {
    const candidate = placeGreedy(it, placed, bpCols);
    placed.push(candidate);
  });

  // Final stable sort
  placed.sort((a, b) => (a.y - b.y) || (a.x - b.x) || `${a.i}`.localeCompare(`${b.i}`));

  // Stretch trailing gaps on each row so the last item fills row end
  const stretched = stretchTrailingGaps(placed, bpCols);
  return stretched;
}

function placeGreedy(item, placed, bpCols) {
  const clamped = clampItemToGrid(item, bpCols);
  const maxX = Math.max(0, bpCols - clamped.w);

  // Scan from top row down to the item's current row
  for (let y = 0; y <= clamped.y; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const test = { ...clamped, x, y };
      const collides = placed.some((p) => rectanglesOverlap(test, p));
      if (!collides) {
        return test;
      }
    }
  }

  // Fallback: keep y, slide leftmost then move up if possible
  const leftX = findLeftmostX(clamped, placed, bpCols);
  const positioned = { ...clamped, x: leftX };
  return moveUp(positioned, placed);
}

function stretchTrailingGaps(items, bpCols) {
  const cloned = cloneItems(items);
  // Group by exact y (rows)
  const rowsMap = {};
  cloned.forEach((it) => {
    const key = `${it.y}`;
    if (!rowsMap[key]) rowsMap[key] = [];
    rowsMap[key].push(it);
  });

  Object.keys(rowsMap).forEach((key) => {
    const row = rowsMap[key].sort((a, b) => a.x - b.x);
    const last = row[row.length - 1];
    const rightEdge = last.x + last.w;
    const gap = bpCols - rightEdge;
    if (gap > 0) {
      const originalW = Math.max(1, last.w);
      const maxExtension = Math.max(1, Math.floor(originalW / 2));
      const apply = Math.min(gap, maxExtension);
      last.w = originalW + apply;
    }
  });

  return cloned;
}

export function tidyLayout(layout, widgets, bp) {
  const bpCols = cols[bp] || 12;
  const items = Array.isArray(layout) ? layout : [];
  // Force single column on mobile breakpoints
  if (bp === "xs" || bp === "xxs") {
    // Stack items vertically full width, preserving item heights
    const ordered = cloneItems(items).sort((a, b) => (a.y - b.y) || (a.x - b.x) || `${a.i}`.localeCompare(`${b.i}`));
    let cursorY = 0;
    const stacked = ordered.map((it) => {
      const h = Math.max(1, it.h || 1);
      const placed = { ...it, x: 0, y: cursorY, w: bpCols, h };
      cursorY += h;
      return placed;
    });
    return stacked;
  }
  // MVP: simple normalize + compact pass left-to-right and up.
  // Future: implement gap-row scanning, stretching, equalization per spec.
  return normalizeAndCompact(items, bpCols);
}

export function placeNewWidget(existingLayout, widget, bp) {
  const bpCols = cols[bp] || 12;
  const items = Array.isArray(existingLayout) ? existingLayout : [];
  const w = (bp === "xs" || bp === "xxs") ? bpCols : Math.max(1, Math.min(widget.w || 2, bpCols));
  const h = Math.max(1, widget.h || 2);

  if (items.length === 0) {
    return { x: 0, y: 0, w, h };
  }

  const placed = cloneItems(items);

  // Scan rows from 0 to a safe upper bound
  const maxY = placed.reduce((acc, it) => Math.max(acc, it.y + it.h), 0);
  const upper = maxY + 50; // generous bound
  if (bp === "xs" || bp === "xxs") {
    // Always stack to bottom full width
    return { x: 0, y: maxY, w, h };
  }
  for (let y = 0; y <= upper; y += 1) {
    for (let x = 0; x <= bpCols - w; x += 1) {
      const candidate = { x, y, w, h };
      const collision = placed.some((it) => rectanglesOverlap(candidate, it));
      if (!collision) {
        return candidate;
      }
    }
  }

  // Fallback at bottom
  const bottom = placed.reduce((acc, it) => Math.max(acc, it.y + it.h), 0);
  return { x: 0, y: bottom, w, h };
}

export default {
  tidyLayout,
  placeNewWidget,
};


