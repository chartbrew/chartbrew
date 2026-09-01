import React from "react";
import PropTypes from "prop-types";
import { Button } from "@heroui/react";
import { LuCheck, LuPencil } from "react-icons/lu";

function PreviewRow({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-foreground">{value}</dd>
    </div>
  );
}

PreviewRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
};

function getActionTitle(actionType) {
  const isCreate = actionType?.endsWith(".create");
  if (actionType?.startsWith("metric_monitor.")) {
    return isCreate ? "Create watched metric" : "Change watched metric";
  }
  return isCreate ? "Schedule KPI review" : "Change KPI review";
}

function getConfirmLabel(actionType) {
  const isCreate = actionType?.endsWith(".create");
  if (actionType?.startsWith("metric_monitor.")) {
    return isCreate ? "Create watched metric" : "Save watch changes";
  }
  return isCreate ? "Schedule KPI review" : "Save review changes";
}

function getAppliedLabel(actionType) {
  return actionType?.endsWith(".create") ? "Created" : "Updated";
}

function formatDeliveryTime(value, timezone) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch (_error) {
    return date.toLocaleString();
  }
}

function MetricPreview({ preview }) {
  const source = [preview.source?.dashboard, preview.source?.chart].filter(Boolean).join(" · ");
  return (
    <dl className="flex flex-col gap-2">
      <PreviewRow label="Name" value={preview.name} />
      <PreviewRow label="Source" value={source} />
      <PreviewRow label="Chart value" value={preview.calculation} />
      <PreviewRow label="Calculation" value={preview.calculationBehaviorLabel} />
      <PreviewRow label="Comparison" value={preview.comparisonLabel} />
      <PreviewRow label="Better result" value={preview.healthyDirectionLabel} />
      <PreviewRow label="Show changes" value={preview.thresholdLabel} />
      <PreviewRow label="First result" value={preview.firstResultState} />
      {preview.defaultReason ? (
        <PreviewRow label="Why this setup" value={preview.defaultReason} />
      ) : null}
    </dl>
  );
}

MetricPreview.propTypes = {
  preview: PropTypes.object.isRequired,
};

function KpiReviewPreview({ preview }) {
  const coverage = `${preview.eligibleMetricCount || 0} ready, ${preview.waitingMetricCount || 0} waiting`;
  return (
    <dl className="flex flex-col gap-2">
      <PreviewRow label="Recipient" value={preview.recipient} />
      <PreviewRow label="Scope" value={preview.scopeLabel} />
      <PreviewRow label="Content" value={preview.contentModeLabel} />
      <PreviewRow label="Schedule" value={preview.scheduleLabel} />
      <PreviewRow label="Timezone" value={preview.timezone} />
      <PreviewRow
        label="First delivery"
        value={formatDeliveryTime(preview.nextDeliveryAt, preview.timezone)}
      />
      <PreviewRow label="Metrics" value={coverage} />
      <PreviewRow label="Health issues" value={preview.activeHealthCount || 0} />
    </dl>
  );
}

KpiReviewPreview.propTypes = {
  preview: PropTypes.object.isRequired,
};

function AiActionPreviewCard({
  action,
  isLoading = false,
  isApplied = false,
  onChange,
  onConfirm,
}) {
  const isMetric = action.actionType?.startsWith("metric_monitor.");
  return (
    <section className="mt-4 rounded-xl border border-divider bg-surface p-4" aria-label={getActionTitle(action.actionType)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{getActionTitle(action.actionType)}</h3>
        {isApplied ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <LuCheck size={14} aria-hidden />
            {getAppliedLabel(action.actionType)}
          </span>
        ) : null}
      </div>

      {isMetric ? (
        <MetricPreview preview={action.preview} />
      ) : (
        <KpiReviewPreview preview={action.preview} />
      )}

      {action.warnings?.length > 0 ? (
        <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-warning">
          {action.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}

      {!isApplied ? (
        <>
          <p className="mt-3 text-xs text-muted">Nothing changes until you confirm.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              isDisabled={isLoading}
              isPending={isLoading}
              onPress={() => onConfirm(action)}
              size="sm"
              variant="primary"
            >
              <LuCheck size={15} aria-hidden />
              {getConfirmLabel(action.actionType)}
            </Button>
            <Button
              isDisabled={isLoading}
              onPress={() => onChange(action)}
              size="sm"
              variant="secondary"
            >
              <LuPencil size={14} aria-hidden />
              Change settings
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

AiActionPreviewCard.propTypes = {
  action: PropTypes.shape({
    actionId: PropTypes.string.isRequired,
    actionType: PropTypes.string.isRequired,
    preview: PropTypes.object.isRequired,
    warnings: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  isApplied: PropTypes.bool,
  isLoading: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

export default AiActionPreviewCard;
