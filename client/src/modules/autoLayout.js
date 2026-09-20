import { cols } from "../../../shared/dashboard/layout.mjs";

export function getLayoutPreviewGeometry(availableWidth, width, height) {
  const scale = availableWidth > 0 && width > 0 ? Math.min(1, availableWidth / width) : 1;
  return { scale, height: height * scale };
}

export function placeNewWidget(existingLayout, widget, bp) {
  const bottom = (existingLayout || []).reduce((value, item) => Math.max(value, item.y + item.h), 0);
  return { x: 0, y: bottom, w: ["xs", "xxs"].includes(bp) ? cols[bp] : widget.w, h: widget.h };
}
