import React from "react";
import PropTypes from "prop-types";
import { Pagination } from "@heroui/react";

import { cn } from "../modules/utils";
import { getPaginationPageNumbers } from "../modules/getPaginationPageNumbers";

/**
 * HeroUI v3 Pagination (Previous / page links / Next) with ellipsis for many pages.
 */
function HeroPaginationNav({
  page,
  totalPages,
  onPageChange,
  size = "sm",
  className,
  ariaLabel,
}) {
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotal);
  const items = getPaginationPageNumbers(safePage, safeTotal);

  return (
    <Pagination
      className={cn("flex flex-wrap items-center gap-1", className)}
      size={size}
      aria-label={ariaLabel}
    >
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            isDisabled={safePage <= 1}
            onPress={() => onPageChange(safePage - 1)}
          >
            <Pagination.PreviousIcon />
          </Pagination.Previous>
        </Pagination.Item>
        {items.map((item, i) => (
          item === "ellipsis" ? (
            <Pagination.Item key={`ellipsis-${i}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={item}>
              <Pagination.Link
                isActive={item === safePage}
                onPress={() => onPageChange(item)}
              >
                {item}
              </Pagination.Link>
            </Pagination.Item>
          )
        ))}
        <Pagination.Item>
          <Pagination.Next
            isDisabled={safePage >= safeTotal}
            onPress={() => onPageChange(safePage + 1)}
          >
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

HeroPaginationNav.propTypes = {
  page: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};

export default HeroPaginationNav;
