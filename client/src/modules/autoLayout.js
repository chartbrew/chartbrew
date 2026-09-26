import { breakpoints, cols, defaultSize, getLayouts, overlap, visualOrder } from "../../../shared/dashboard/layout.mjs";

export function getLayoutPreviewGeometry(availableWidth, width, height) {
  const scale = availableWidth > 0 && width > 0 ? Math.min(1, availableWidth / width) : 1;
  return { scale, height: height * scale };
}

export function placeNewWidget(existingLayout, widget, bp) {
  const bottom = (existingLayout || []).reduce((value, item) => Math.max(value, item.y + item.h), 0);
  return { x: 0, y: bottom, w: ["xs", "xxs"].includes(bp) ? cols[bp] : widget.w, h: widget.h };
}

export function reserveChartLayout(charts) {
  const layouts = getLayouts(charts);
  return Object.fromEntries(breakpoints.map((bp) => {
    const items = layouts[bp];
    const last = visualOrder(items).at(-1);
    const size = { ...defaultSize({}, bp), h: ["xs", "xxs"].includes(bp) ? 3 : 2 };
    const next = last && { x: last.x + last.w, y: last.y, ...size };
    const position = next && next.x + next.w <= cols[bp] && !items.some((item) => overlap(item, next))
      ? next : placeNewWidget(items, size, bp);
    return [bp, [position.x, position.y, position.w, position.h]];
  }));
}
