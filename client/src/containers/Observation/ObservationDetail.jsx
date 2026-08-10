import React, { useEffect, useState } from "react";
import {
  Button, Chip, Dropdown, Spinner,
} from "@heroui/react";
import {
  LuBookmark,
  LuBookmarkCheck,
  LuChartNoAxesColumnIncreasing,
  LuCheck,
  LuClock,
  LuEllipsis,
  LuExternalLink,
  LuEyeOff,
  LuShare2,
  LuThumbsDown,
  LuThumbsUp,
  LuTrendingDown,
  LuTrendingUp,
} from "react-icons/lu";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  exploreObservationDrivers,
  getObservation,
  resolveObservation,
  sendObservationFeedback,
  updateObservationPreference,
} from "../../api/observations";
import {
  formatAbsoluteDelta,
  formatMetricValue,
  formatRelativeChange,
  formatTimeAgo,
} from "../../modules/observationFormat";
import { selectTeam } from "../../slices/team";
import { selectUser } from "../../slices/user";
import ObservationInvestigation from "../Ai/ObservationInvestigation";

const EDIT_ROLES = new Set(["projectAdmin", "projectEditor", "teamAdmin", "teamOwner"]);
const NOT_USEFUL_REASONS = [
  { code: "expected_change", label: "Expected change" },
  { code: "too_small", label: "Too small" },
  { code: "incorrect_context", label: "Wrong comparison" },
  { code: "already_known", label: "Already knew this" },
  { code: "not_actionable", label: "Not actionable" },
];

function formatPeriod(period) {
  if (!period?.start || !period?.end) return "Period unavailable";
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(new Date(period.start))} – ${formatter.format(new Date(period.end))}`;
}

function getComparisonDescription(observation) {
  if (observation.comparisonLabel) return observation.comparisonLabel;
  return `Earlier result · ${formatPeriod(observation.comparisonPeriod)}`;
}

function getComparisonBasis(observation) {
  return observation.comparisonLabel || "Earlier result";
}

function getCoverageLabel(value) {
  if (!Number.isFinite(value)) return "Not available";
  if (value >= 0.99) return "Complete";
  if (value >= 0.9) return "Mostly complete";
  return "Some data missing";
}

function getEvidenceWidth(value, currentValue, baselineValue) {
  const maximum = Math.max(Math.abs(Number(currentValue)), Math.abs(Number(baselineValue)));
  if (!Number.isFinite(maximum) || maximum === 0) return 0;
  return Math.min(100, (Math.abs(Number(value)) / maximum) * 100);
}

function ObservationDetail() {
  const { observationId } = useParams();
  const navigate = useNavigate();
  const team = useSelector(selectTeam);
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(true);
  const [observation, setObservation] = useState(null);
  const [driverAnalysis, setDriverAnalysis] = useState(null);
  const [driverLoading, setDriverLoading] = useState(false);
  const [feedbackPending, setFeedbackPending] = useState(null);
  const [resolvePending, setResolvePending] = useState(false);
  const [showFeedbackReasons, setShowFeedbackReasons] = useState(false);
  const teamRole = team?.TeamRoles?.find((role) => role.user_id === user.id)?.role;
  const canEdit = EDIT_ROLES.has(teamRole);
  const isSnoozed = observation?.preference?.snoozedUntil
    && new Date(observation.preference.snoozedUntil) > new Date();

  useEffect(() => {
    if (!team?.id || !observationId) return;
    setLoading(true);
    getObservation(team.id, observationId)
      .then(async (result) => {
        setObservation(result);
        if (!result.preference.readAt) {
          await updateObservationPreference(team.id, observationId, { read: true });
          setObservation((current) => ({
            ...current,
            preference: { ...current.preference, readAt: new Date().toISOString() },
          }));
          window.dispatchEvent(new CustomEvent("cb:activity-updated"));
        }
      })
      .catch(() => setObservation(null))
      .finally(() => setLoading(false));
  }, [team?.id, observationId]);

  const updatePreference = async (values, message) => {
    try {
      const preference = await updateObservationPreference(team.id, observationId, values);
      setObservation((current) => ({ ...current, preference }));
      window.dispatchEvent(new CustomEvent("cb:activity-updated"));
      if (message) toast.success(message);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const feedback = async (verdict, reasonCode) => {
    setFeedbackPending(reasonCode || verdict);
    try {
      const savedFeedback = await sendObservationFeedback(
        team.id,
        observationId,
        { reasonCode, verdict }
      );
      setObservation((current) => ({ ...current, feedback: savedFeedback }));
      setShowFeedbackReasons(verdict === "not_relevant");
      toast.success("Feedback saved");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setFeedbackPending(null);
    }
  };

  const setResolved = async (resolved) => {
    setResolvePending(true);
    try {
      const updated = await resolveObservation(team.id, observationId, resolved);
      setObservation((current) => ({ ...current, ...updated }));
      window.dispatchEvent(new CustomEvent("cb:activity-updated"));
      const openDestination = observation?.impact === "positive"
        ? "Notable changes"
        : "Needs attention";
      toast.success(resolved ? "Moved to Past changes" : `Moved to ${openDestination}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setResolvePending(false);
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: observation.title, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied");
      }
    } catch (error) {
      if (error.name !== "AbortError") toast.error("Could not share this change");
    }
  };

  const exploreDrivers = async () => {
    setDriverLoading(true);
    try {
      setDriverAnalysis(await exploreObservationDrivers(team.id, observationId));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDriverLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading change" />
      </div>
    );
  }
  if (!observation) {
    return (
      <div className="rounded-3xl border border-divider bg-content1 px-4 py-5">
        <p className="font-medium">This change is not available</p>
        <Button className="mt-3" onPress={() => navigate("/activity")} size="sm" variant="secondary">
          Back to activity
        </Button>
      </div>
    );
  }

  const isIncrease = observation.direction === "increase";
  const changeSign = isIncrease ? "+" : "−";
  const impactTextClass = observation.impact === "positive"
    ? "text-success"
    : observation.impact === "negative"
      ? "text-danger"
      : "text-foreground";
  const impactBgClass = observation.impact === "positive"
    ? "bg-success/20"
    : observation.impact === "negative"
      ? "bg-danger/20"
      : "bg-accent/20";
  const impactBarClass = observation.impact === "positive"
    ? "bg-success"
    : observation.impact === "negative"
      ? "bg-danger"
      : "bg-accent";
  const currentWidth = getEvidenceWidth(
    observation.currentValue,
    observation.currentValue,
    observation.baselineValue
  );
  const baselineWidth = getEvidenceWidth(
    observation.baselineValue,
    observation.currentValue,
    observation.baselineValue
  );
  const metricName = observation.monitor?.name || "This metric";
  const completeness = Number(observation.evidence?.completeness);
  const valuesUsed = Number(observation.evidence?.sourceBucketCount || 0)
    + Number(observation.evidence?.sourceCheckpointCount || 0);
  const openStatusLabel = observation.impact === "positive"
    ? "Notable change"
    : "Needs attention";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {observation.project?.name || "Workspace"}
          </p>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${impactBgClass} ${impactTextClass}`}>
              {isIncrease
                ? <LuTrendingUp size={19} aria-hidden />
                : <LuTrendingDown size={19} aria-hidden />}
            </div>
            <h1 className="min-w-0 font-tw text-2xl font-semibold leading-tight md:text-3xl">
              {observation.title}
            </h1>
          </div>
          <div className="mt-4 flex flex-row flex-wrap items-center gap-2">
            <Chip
              color={observation.status === "resolved" || observation.impact === "positive"
                ? "success"
                : "warning"}
              variant="soft"
            >
              <Chip.Label>
                {observation.status === "resolved" ? "Resolved" : openStatusLabel}
              </Chip.Label>
            </Chip>
            {observation.monitor ? (
              <Chip color={observation.monitor.active ? "accent" : "default"} variant="soft">
                <Chip.Label>
                  {observation.monitor.active ? "Watched" : "No longer watched"}
                </Chip.Label>
              </Chip>
            ) : null}
            {observation.corrected ? (
              <Chip color="warning" variant="soft">
                <Chip.Label>Corrected</Chip.Label>
              </Chip>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <LuClock size={15} aria-hidden />
              {observation.status === "resolved" && observation.resolvedAt
                ? `Resolved ${formatTimeAgo(observation.resolvedAt)}`
                : `Last detected ${formatTimeAgo(observation.lastDetectedAt)}`}
            </span>
            {observation.preference.dismissedAt ? (
              <Chip size="sm" variant="soft"><Chip.Label>Hidden from Home</Chip.Label></Chip>
            ) : null}
            {isSnoozed ? (
              <Chip size="sm" variant="soft"><Chip.Label>Snoozed on Home</Chip.Label></Chip>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit ? (
            <Button
              isPending={resolvePending}
              onPress={() => setResolved(observation.status !== "resolved")}
              variant="primary"
            >
              <LuCheck size={17} aria-hidden />
              {observation.status === "resolved" ? "Reopen" : "Resolve"}
            </Button>
          ) : null}
          <Dropdown aria-label="Change actions">
            <Dropdown.Trigger
              aria-label="More change actions"
              className="flex size-10 items-center justify-center rounded-3xl border border-divider bg-surface text-foreground transition-colors hover:bg-content2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <LuEllipsis size={19} aria-hidden />
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu>
                <Dropdown.Item
                  id="save"
                  onPress={() => updatePreference(
                    { saved: !observation.preference.savedAt },
                    observation.preference.savedAt
                      ? "Removed from saved changes"
                      : "Change saved"
                  )}
                  textValue={observation.preference.savedAt ? "Remove from saved" : "Save change"}
                >
                  {observation.preference.savedAt
                    ? <LuBookmarkCheck size={17} aria-hidden />
                    : <LuBookmark size={17} aria-hidden />}
                  {observation.preference.savedAt ? "Remove from saved" : "Save change"}
                </Dropdown.Item>
                <Dropdown.Item id="share" onPress={share} textValue="Share change">
                  <LuShare2 size={17} aria-hidden />
                  Share change
                </Dropdown.Item>
                <Dropdown.Item
                  id="snooze"
                  onPress={() => updatePreference(
                    {
                      snoozedUntil: isSnoozed
                        ? null
                        : new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
                    },
                    isSnoozed ? "Change restored on Home" : "Hidden from Home for 24 hours"
                  )}
                  textValue={isSnoozed ? "Show on Home" : "Snooze on Home for 24 hours"}
                >
                  <LuClock size={17} aria-hidden />
                  {isSnoozed ? "Show on Home" : "Snooze on Home for 24 hours"}
                </Dropdown.Item>
                <Dropdown.Item
                  id="dismiss"
                  onPress={() => updatePreference(
                    { dismissed: !observation.preference.dismissedAt },
                    observation.preference.dismissedAt
                      ? "Change restored on Home"
                      : "Change hidden from Home"
                  )}
                  showDivider
                  textValue={observation.preference.dismissedAt
                    ? "Show on Home"
                    : "Dismiss from Home"}
                >
                  <LuEyeOff size={17} aria-hidden />
                  {observation.preference.dismissedAt ? "Show on Home" : "Dismiss from Home"}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          aria-labelledby="change-evidence-heading"
          className="rounded-3xl border border-divider bg-content1 p-5 md:p-6 lg:col-start-1 lg:row-start-1"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted" id="change-evidence-heading">
              Change
            </h2>
            <span className="text-sm text-muted">
              {observation.comparisonLabel || formatPeriod(observation.currentPeriod)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <p className={`font-tw text-4xl font-semibold leading-none md:text-5xl ${impactTextClass}`}>
              {changeSign}{formatRelativeChange(observation.relativeDelta)}
            </p>
            <Chip
              color={observation.impact === "positive"
                ? "success"
                : observation.impact === "negative"
                  ? "danger"
                  : "default"}
              size="sm"
              variant="soft"
            >
              <Chip.Label>
                {changeSign}{formatAbsoluteDelta(
                  observation.absoluteDelta,
                  observation.unit,
                  observation.monitor?.valueFormat
                )} absolute
              </Chip.Label>
            </Chip>
          </div>
          <p className="mt-4 text-sm leading-6 text-foreground-600">
            {metricName} moved from{" "}
            <span className="font-medium text-foreground">
              {formatMetricValue(
                observation.baselineValue,
                observation.unit,
                observation.monitor?.valueFormat
              )}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {formatMetricValue(
                observation.currentValue,
                observation.unit,
                observation.monitor?.valueFormat
              )}
            </span>.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="text-muted">Current</span>
                <span className="font-medium">
                  {formatMetricValue(
                    observation.currentValue,
                    observation.unit,
                    observation.monitor?.valueFormat
                  )}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-content3">
                <div
                  className={`h-full rounded-full ${impactBarClass}`}
                  style={{ width: `${currentWidth}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="text-muted">Comparison</span>
                <span className="font-medium">
                  {formatMetricValue(
                    observation.baselineValue,
                    observation.unit,
                    observation.monitor?.valueFormat
                  )}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-content3">
                <div
                  className="h-full rounded-full bg-default-300"
                  style={{ width: `${baselineWidth}%` }}
                />
              </div>
            </div>
          </div>

          <p className="mt-5 border-t border-divider pt-4 text-xs text-muted">
            {getComparisonDescription(observation)}
          </p>
        </section>

        <aside className="overflow-hidden rounded-3xl border border-divider bg-content1 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <section className="p-5" aria-labelledby="comparison-details-heading">
            <h2 className="font-tw text-base font-semibold" id="comparison-details-heading">
              Comparison details
            </h2>
            <dl className="mt-4 divide-y divide-divider text-sm">
              <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                <dt className="text-muted">Compared with</dt>
                <dd className="text-right font-medium">{getComparisonBasis(observation)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted">Values used</dt>
                <dd className="font-medium">
                  {valuesUsed || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted">Data coverage</dt>
                <dd className="text-right font-medium">{getCoverageLabel(completeness)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                <dt className="text-muted">Checked</dt>
                <dd className="text-right font-medium">
                  {observation.monitor?.lastSampledAt
                    ? formatTimeAgo(observation.monitor.lastSampledAt)
                    : "—"}
                </dd>
              </div>
            </dl>
          </section>

          {observation.chart ? (
            <section className="border-t border-divider p-5" aria-labelledby="source-chart-heading">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Source chart
              </p>
              <h2 className="mt-1 truncate font-tw text-lg font-semibold" id="source-chart-heading">
                {observation.chart.name}
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {canEdit ? (
                  <Button
                    className="w-full"
                    onPress={() => navigate(
                      `/dashboard/${observation.project.id}/chart/${observation.chart.id}/edit`
                    )}
                    variant="primary"
                  >
                    Open chart
                    <LuExternalLink size={16} aria-hidden />
                  </Button>
                ) : null}
                <Button
                  className="w-full"
                  onPress={() => navigate(`/dashboard/${observation.project.id}`)}
                  variant={canEdit ? "outline" : "primary"}
                >
                  Open dashboard
                </Button>
              </div>
            </section>
          ) : null}

          <section className="border-t border-divider p-5" aria-labelledby="usefulness-heading">
            <h2 className="text-sm font-medium" id="usefulness-heading">
              Was this change useful?
            </h2>
            <div className="mt-3 flex flex-row gap-2">
              <Button
                aria-pressed={observation.feedback?.verdict === "relevant"}
                isDisabled={Boolean(feedbackPending)}
                isPending={feedbackPending === "relevant"}
                onPress={() => feedback("relevant", null)}
                size="sm"
                fullWidth
                variant={observation.feedback?.verdict === "relevant" ? "secondary" : "outline"}
              >
                <LuThumbsUp size={16} aria-hidden />
                Useful
              </Button>
              <Button
                aria-pressed={observation.feedback?.verdict === "not_relevant"}
                isDisabled={Boolean(feedbackPending)}
                onPress={() => setShowFeedbackReasons(true)}
                size="sm"
                fullWidth
                variant={observation.feedback?.verdict === "not_relevant" ? "secondary" : "outline"}
              >
                <LuThumbsDown size={16} aria-hidden />
                Not useful
              </Button>
            </div>
            {showFeedbackReasons || observation.feedback?.verdict === "not_relevant" ? (
              <div className="mt-4 border-t border-divider pt-4">
                <p className="text-xs text-muted">What made it unhelpful?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {NOT_USEFUL_REASONS.map((reason) => (
                    <Button
                      aria-pressed={observation.feedback?.reasonCode === reason.code}
                      isDisabled={Boolean(feedbackPending)}
                      isPending={feedbackPending === reason.code}
                      key={reason.code}
                      onPress={() => feedback("not_relevant", reason.code)}
                      size="sm"
                      variant={observation.feedback?.reasonCode === reason.code
                        ? "secondary"
                        : "outline"}
                    >
                      {reason.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </aside>

        <section className="rounded-3xl border border-divider bg-content1 p-5 md:p-6 lg:col-start-1 lg:row-start-2">
          <h2 className="font-tw text-lg font-semibold">What changed?</h2>
          <p className="mt-3 text-sm leading-6 text-foreground-600">{observation.summary}</p>
          <div className="mt-4 flex flex-row">
            <Button
              isPending={driverLoading}
              onPress={exploreDrivers}
              size="sm"
              variant="secondary"
            >
              <LuChartNoAxesColumnIncreasing size={16} aria-hidden />
              Explore drivers
            </Button>
          </div>
          {driverAnalysis?.status === "not_enough_evidence" ? (
            <p className="mt-4 border-t border-divider pt-4 text-sm text-muted">
              {driverAnalysis.message}
            </p>
          ) : null}
          {driverAnalysis?.status === "ready" ? (
            <div className="mt-5 border-t border-divider pt-4">
              <p className="text-sm font-medium">{driverAnalysis.message}</p>
              <div className="mt-2 divide-y divide-divider">
                {driverAnalysis.segments.map((segment) => (
                  <div
                    className="flex flex-row items-center justify-between gap-3 py-3"
                    key={segment.segment}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{segment.segment}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatMetricValue(
                          segment.comparison,
                          observation.unit,
                          observation.monitor?.valueFormat
                        )} to{" "}
                        {formatMetricValue(
                          segment.current,
                          observation.unit,
                          observation.monitor?.valueFormat
                        )}
                      </p>
                    </div>
                    <Chip size="sm" variant="soft">
                      <Chip.Label>
                        {formatRelativeChange(segment.movementShare)} of movement
                      </Chip.Label>
                    </Chip>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-divider bg-content1 p-5 md:p-6 lg:col-start-1 lg:row-start-3">
          <h2 className="font-tw text-lg font-semibold">Investigate this change</h2>
          <div className="mt-4">
            <ObservationInvestigation observationId={observation.id} teamId={team.id} />
          </div>
        </section>
      </div>
    </main>
  );
}

export default ObservationDetail;
