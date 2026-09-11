import { cols } from "../../../shared/dashboard/layout.mjs";

export function placeNewWidget(existingLayout, widget, bp) {
  const bottom = (existingLayout || []).reduce((value, item) => Math.max(value, item.y + item.h), 0);
  return { x: 0, y: bottom, w: ["xs", "xxs"].includes(bp) ? cols[bp] : widget.w, h: widget.h };
}
