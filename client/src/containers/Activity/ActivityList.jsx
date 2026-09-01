import React from "react";
import PropTypes from "prop-types";

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

function ActivityList({ children }) {
  return (
    <div className="divide-y divide-divider overflow-hidden rounded-3xl border border-divider bg-surface">
      {children}
    </div>
  );
}

ActivityList.propTypes = {
  children: PropTypes.node.isRequired,
};

function ActivityListRow({ actions, icon, meta, title }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 flex-row items-start gap-3">
        {icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-divider bg-surface-secondary/40">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-row flex-wrap items-center gap-2">{title}</div>
          {meta ? <div className="mt-1 text-sm text-muted">{meta}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-row items-center gap-2 md:self-center">
          {actions}
        </div>
      ) : null}
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
