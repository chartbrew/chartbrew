/**
 * Build page entries for HeroUI v3 Pagination (1-based current page).
 * Mirrors the ellipsis pattern from https://v3.heroui.com/docs/react/components/pagination
 */
export function getPaginationPageNumbers(page, totalPages) {
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotal);
  const pages = [];

  if (safeTotal <= 7) {
    for (let i = 1; i <= safeTotal; i++) {
      pages.push(i);
    }
    return pages;
  }

  pages.push(1);

  if (safePage > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, safePage - 1);
  const end = Math.min(safeTotal - 1, safePage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (safePage < safeTotal - 2) {
    pages.push("ellipsis");
  }

  pages.push(safeTotal);

  return pages;
}
