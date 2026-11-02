export const ACTIVITY_PAGE_SIZE = 10;

export function getActivityPage(page, total) {
  const totalPages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return {
    page: currentPage,
    start: (currentPage - 1) * ACTIVITY_PAGE_SIZE,
    totalPages,
  };
}
