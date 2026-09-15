import React, { Children, useState } from "react";
import PropTypes from "prop-types";
import { Table } from "@heroui/react";

import HeroPaginationNav from "../../components/HeroPaginationNav";

import { ACTIVITY_PAGE_SIZE as PAGE_SIZE, getActivityPage } from "./activityPagination";

function ActivityEmptyState({ description, title }) {
  return (
    <div className="rounded-3xl border border-divider bg-surface px-4 py-5">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-foreground-500">{description}</p>
    </div>
  );
}

ActivityEmptyState.propTypes = {
  description: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

function ActivityList({ children, label = "Activity" }) {
  const rows = Children.toArray(children);
  const [pagination, setPagination] = useState({ firstKey: null, page: 1 });
  const firstKey = rows[0]?.key;
  const { page, start, totalPages } = getActivityPage(
    pagination.firstKey === firstKey ? pagination.page : 1,
    rows.length
  );

  return (
    <Table className="overflow-hidden rounded-3xl border border-divider shadow-none">
      <Table.ScrollContainer>
        <Table.Content aria-label={label} className="min-w-[760px]">
          <Table.Header>
            <Table.Column id="activity" isRowHeader>{label}</Table.Column>
            <Table.Column id="details">Details</Table.Column>
            <Table.Column id="actions" className="text-right">Actions</Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.slice(start, start + PAGE_SIZE).map((row) => (
              <Table.Row id={row.key} key={row.key}>
                <Table.Cell>{row}</Table.Cell>
                <Table.Cell className="max-w-lg whitespace-normal text-sm text-muted">
                  {row.props.meta || "—"}
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-2">
                    {row.props.actions}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      <Table.Footer className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3">
        <span className="text-sm text-muted" aria-live="polite">
          {rows.length ? start + 1 : 0}–{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}
        </span>
        {totalPages > 1 ? (
          <HeroPaginationNav
            ariaLabel={`${label} pagination`}
            onPageChange={(nextPage) => setPagination({ firstKey, page: nextPage })}
            page={page}
            totalPages={totalPages}
          />
        ) : null}
      </Table.Footer>
    </Table>
  );
}

ActivityList.propTypes = {
  children: PropTypes.node.isRequired,
  label: PropTypes.string,
};

function ActivityListRow({ icon, title }) {
  return (
    <div className="flex max-w-md items-center gap-3 py-1">
      {icon ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-divider bg-surface-secondary/40">
          {icon}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-2 whitespace-normal">{title}</div>
    </div>
  );
}

ActivityListRow.propTypes = {
  actions: PropTypes.node,
  icon: PropTypes.node,
  meta: PropTypes.node,
  title: PropTypes.node.isRequired,
};

export {
  ActivityEmptyState,
  ActivityList,
  ActivityListRow,
};
